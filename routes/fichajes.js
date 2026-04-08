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
  const hoy = ahora.toISOString().split('T')[0]; // "2026-04-07"

  try {
    // Comprobar si está de licencia
    const licenciaResult = await pool.query(
      `SELECT causa FROM licencias_permisos 
       WHERE empleado_id = $1 AND fecha_inicio <= $2 AND fecha_fin >= $2`,
      [empleadoId, hoy]
    );

    if (licenciaResult.rows.length > 0) {
      return res.status(400).json({ error: `No puedes fichar: Estás en periodo de ${licenciaResult.rows[0].causa}.` });
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
    if (ultimoFichaje.rows.length === 0 || ultimoFichaje.rows[0].tipo === 'salida') {
      tipo = 'entrada';
    } else {
      tipo = 'salida';
    }

    // Registrar el fichaje
    const result = await pool.query(
      `INSERT INTO fichajes (empleado_id, tipo, timestamp, fecha)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [empleadoId, tipo, ahora.toISOString(), hoy]
    );

    res.status(201).json({
      fichaje: result.rows[0],
      tipo,
      hora: ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
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
  const hoy = new Date().toISOString().split('T')[0];

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
    const estaEnTrabajo = result.rows.length > 0 && result.rows[0].tipo === 'entrada';
    const proximoTipo = estaEnTrabajo ? 'salida' : 'entrada';

    res.json({
      estaEnTrabajo,
      proximoTipo,
      ultimo: result.rows[0] || null,
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
      SELECT id, tipo, timestamp, fecha
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
    // Obtener el centro del empleado para sus festivos
    const empResult = await pool.query('SELECT centro_id FROM empleados WHERE id = $1', [empleadoId]);
    const centroId = empResult.rows[0]?.centro_id;
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
      horarios: result.rows
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
