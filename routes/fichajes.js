const express = require('express');
const pool = require('../database/db');
const { verificarToken, soloEmpleado } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// POST /api/fichajes/fichar
// El empleado ficha — el sistema detecta si es entrada o salida
// ============================================================
router.post('/fichar', soloEmpleado, async (req, res) => {
  const empleadoId = req.usuario.id;
  const ahora = new Date();
  
  // ============================================================
  // GESTIÓN DE ZONA HORARIA (España/Madrid)
  // ============================================================
  const tzn = 'Europe/Madrid';
  
  // 1. Obtener la fecha actual en formato YYYY-MM-DD en Madrid
  const formatterDate = new Intl.DateTimeFormat('en-CA', { timeZone: tzn, year: 'numeric', month: '2-digit', day: '2-digit' });
  const hoy = formatterDate.format(ahora); 

  // 2. Obtener el día de la semana en español en Madrid
  const formatterDay = new Intl.DateTimeFormat('es-ES', { timeZone: tzn, weekday: 'long' });
  const diaKey = formatterDay.format(ahora).toLowerCase(); // "lunes", "martes", "miércoles"...

  // 3. Obtener la hora actual en Madrid (HH:MM)
  const formatterTime = new Intl.DateTimeFormat('es-ES', { timeZone: tzn, hour: '2-digit', minute: '2-digit', hour12: false });
  const horaActualStr = formatterTime.format(ahora);
  const [horaHoid, minHoy] = horaActualStr.split(':').map(Number);
  const horaActualNum = horaHoid * 60 + minHoy;

  try {
    // 1. Comprobar si está de licencia
    const licenciaResult = await pool.query(
      `SELECT causa FROM licencias_permisos 
       WHERE empleado_id = $1 AND fecha_inicio <= $2 AND fecha_fin >= $2`,
      [empleadoId, hoy]
    );

    if (licenciaResult.rows.length > 0) {
      return res.status(400).json({ error: `No puedes fichar: Estás en periodo de ${licenciaResult.rows[0].causa}.` });
    }

    // 2. Obtener el horario y el horario fijo del empleado
    const empData = await pool.query(
      `SELECT e.horario_fijo, e.horario_fijo_inicio, h.dias 
       FROM empleados e
       LEFT JOIN horarios h ON e.id = h.empleado_id AND h.fecha_inicio <= $2 AND h.fecha_fin >= $2
       WHERE e.id = $1`,
      [empleadoId, hoy]
    );

    if (empData.rows.length === 0) {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }

    const { dias, horario_fijo, horario_fijo_inicio } = empData.rows[0];
    const diaSinTilde = diaKey.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let horarioHoy = null;
    
    // Prioridad 1: Horario semanal específico
    if (dias) {
      horarioHoy = (dias[diaKey] || dias[diaSinTilde]);
    }

    // Prioridad 2: Horario fijo (si aplica la fecha de inicio)
    if (!horarioHoy && horario_fijo && horario_fijo_inicio) {
      if (hoy >= horario_fijo_inicio.toISOString().split('T')[0]) {
        horarioHoy = (horario_fijo[diaKey] || horario_fijo[diaSinTilde]);
      }
    }

    if (!horarioHoy) {
      return res.status(400).json({ error: 'No puedes fichar: No tienes un turno programado para hoy.' });
    }

    // Ver el último fichaje del empleado de HOY
    const ultimoFichaje = await pool.query(
      `SELECT tipo FROM fichajes 
       WHERE empleado_id = $1 AND fecha = $2 
       ORDER BY timestamp DESC LIMIT 1`,
      [empleadoId, hoy]
    );

    // Determinar el tipo: si el último fue "entrada" → ahora es "salida" y viceversa
    let tipo;
    if (ultimoFichaje.rows.length === 0) {
      tipo = 'entrada';
    } else if (ultimoFichaje.rows[0].tipo === 'entrada') {
      tipo = 'salida';
    } else {
      // Si el último ya fue salida, no permitimos volver a fichar en el mismo día
      return res.status(400).json({ 
        error: 'Ya has completado tu jornada de hoy. Solo se permite un fichaje de entrada y salida al día.' 
      });
    }

    // 3. Validar hora según el tipo de fichaje
    if (tipo === 'entrada') {
      const [hEntrada, mEntrada] = horarioHoy.entrada.split(':').map(Number);
      const horaEntradaNum = hEntrada * 60 + mEntrada;
      if (horaActualNum < horaEntradaNum) {
        return res.status(400).json({ 
          error: `No puedes fichar todavía. Tu hora de entrada es a las ${horarioHoy.entrada}.` 
        });
      }
    } else {
      const [hSalida, mSalida] = horarioHoy.salida.split(':').map(Number);
      const horaSalidaNum = hSalida * 60 + mSalida;
      if (horaActualNum < horaSalidaNum) {
        return res.status(400).json({ 
          error: `No puedes fichar la salida todavía. Tu hora de salida es a las ${horarioHoy.salida}.` 
        });
      }
    }

    // Calcular minutos extra si es salida
    let minutosExtra = 0;
    if (tipo === 'salida' && horarioHoy.salida) {
      const [hSalProgramada, mSalProgramada] = horarioHoy.salida.split(':').map(Number);
      const minutosProgramados = hSalProgramada * 60 + mSalProgramada;
      
      // Solo si ficha DESPUÉS de su hora de salida
      if (horaActualNum > minutosProgramados) {
        minutosExtra = horaActualNum - minutosProgramados;
      }
    }

    // Registrar el fichaje
    const result = await pool.query(
      `INSERT INTO fichajes (empleado_id, tipo, timestamp, fecha, minutos_extra)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [empleadoId, tipo, ahora.toISOString(), hoy, minutosExtra]
    );

    res.status(201).json({
      fichaje: result.rows[0],
      tipo,
      hora: ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      minutosExtra,
      mensaje: tipo === 'entrada' ? '✅ Entrada registrada correctamente' : '✅ Salida registrada correctamente'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el fichaje.' });
  }
});

// ============================================================
// GET /api/fichajes/estado
// El empleado consulta su estado actual (dentro o fuera)
// ============================================================
router.get('/estado', soloEmpleado, async (req, res) => {
  const empleadoId = req.usuario.id;
  const tzn = 'Europe/Madrid';
  const ahora = new Date();
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: tzn, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

  try {
    // Comprobar licencia hoy
    const licenciaResult = await pool.query(
      `SELECT causa FROM licencias_permisos 
       WHERE empleado_id = $1 AND fecha_inicio <= $2 AND fecha_fin >= $2`,
      [empleadoId, hoy]
    );
    const licenciaActual = licenciaResult.rows.length > 0 ? licenciaResult.rows[0].causa : null;

    const result = await pool.query(
      `SELECT tipo, timestamp FROM fichajes 
       WHERE empleado_id = $1 AND fecha = $2 
       ORDER BY timestamp DESC LIMIT 1`,
      [empleadoId, hoy]
    );

    const fichajesToday = await pool.query(
      `SELECT tipo, timestamp FROM fichajes 
       WHERE empleado_id = $1 AND fecha = $2 
       ORDER BY timestamp ASC`,
      [empleadoId, hoy]
    );

    // Estado actual: si el último fichaje fue "entrada" → está dentro
    const ultimo = result.rows[0];
    const estaEnTrabajo = ultimo && ultimo.tipo === 'entrada';
    const turnoCompletado = ultimo && ultimo.tipo === 'salida';
    const proximoTipo = turnoCompletado ? null : (estaEnTrabajo ? 'salida' : 'entrada');
    // Calcular total minutos extra acumulados
    const extraResult = await pool.query(
      `SELECT SUM(minutos_extra) as total FROM fichajes 
       WHERE empleado_id = $1`,
      [empleadoId]
    );
    const acumuladoTotal = parseInt(extraResult.rows[0].total || 0);

    res.json({
      estaEnTrabajo,
      turnoCompletado,
      proximoTipo,
      acumuladoMes: acumuladoTotal, // Mantenemos el nombre de la propiedad para no romper el frontend
      ultimo: ultimo || null,
      fichajesHoy: fichajesToday.rows,
      licenciaActual // Se enviará null o el string de la causa
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el estado.' });
  }
});

// ============================================================
// GET /api/fichajes/historial
// El empleado ve su historial de fichajes
// ============================================================
router.get('/historial', soloEmpleado, async (req, res) => {
  const empleadoId = req.usuario.id;
  const { mes, anio } = req.query;

  try {
    let query = `
      SELECT id, tipo, timestamp, fecha, minutos_extra
      FROM fichajes
      WHERE empleado_id = $1
    `;
    let params = [empleadoId];

    if (mes && anio) {
      query += ` AND EXTRACT(MONTH FROM fecha) = $2 AND EXTRACT(YEAR FROM fecha) = $3`;
      params.push(parseInt(mes), parseInt(anio));
    }

    query += ' ORDER BY timestamp DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el historial.' });
  }
});

// ============================================================
// GET /api/fichajes/horario
// El empleado ve su horario del mes actual
// ============================================================
router.get('/horario', soloEmpleado, async (req, res) => {
  const empleadoId = req.usuario.id;
  const ahora = new Date();
  const mes = req.query.mes || (ahora.getMonth() + 1);
  const anio = req.query.anio || ahora.getFullYear();

  try {
    // Obtener centro, festivos y horario fijo del empleado
    const empResult = await pool.query(
      'SELECT centro_id, horario_fijo, horario_fijo_inicio FROM empleados WHERE id = $1', 
      [empleadoId]
    );
    const { centro_id: centroId, horario_fijo, horario_fijo_inicio } = empResult.rows[0];

    let festivos = [];
    if (centroId) {
      const centroResult = await pool.query('SELECT festivos FROM centros WHERE id = $1', [centroId]);
      festivos = centroResult.rows[0]?.festivos || [];
    }

    const result = await pool.query(
      `SELECT * FROM horarios 
       WHERE empleado_id = $1 
         AND ((EXTRACT(MONTH FROM fecha_inicio) = $2 AND EXTRACT(YEAR FROM fecha_inicio) = $3)
           OR (EXTRACT(MONTH FROM fecha_fin) = $2 AND EXTRACT(YEAR FROM fecha_fin) = $3))`,
      [empleadoId, parseInt(mes), parseInt(anio)]
    );

    res.json({
      festivos,
      horarios: result.rows,
      horario_fijo,
      horario_fijo_inicio
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el horario.' });
  }
});

// ============================================================
// GET /api/fichajes/licencias
// El empleado ve sus licencias y vacaciones
// ============================================================
router.get('/licencias', soloEmpleado, async (req, res) => {
  const empleadoId = req.usuario.id;
  try {
    const result = await pool.query(
      'SELECT id, anio, causa, fecha_inicio, fecha_fin FROM licencias_permisos WHERE empleado_id = $1 ORDER BY fecha_inicio DESC',
      [empleadoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las licencias.' });
  }
});

// ============================================================
// GET /api/fichajes/contratos
// El empleado ve sus contratos
// ============================================================
router.get('/contratos', soloEmpleado, async (req, res) => {
  const empleadoId = req.usuario.id;
  try {
    const result = await pool.query(
      `SELECT ct.*, c.nombre AS centro_nombre
       FROM contratos ct
       LEFT JOIN centros c ON ct.centro_id = c.id
       WHERE ct.empleado_id = $1
       ORDER BY ct.fecha_inicio DESC`,
      [empleadoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los contratos.' });
  }
});

module.exports = router;
