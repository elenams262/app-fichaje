const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../database/db');
const { soloAdmin } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas de este archivo requieren ser administrador
router.use(soloAdmin);

// ============================================================
// CENTROS DE TRABAJO
// ============================================================

router.get('/centros', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(e.id) AS total_empleados
      FROM centros c
      LEFT JOIN empleados e ON e.centro_id = c.id AND e.activo = true
      GROUP BY c.id
      ORDER BY c.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener centros.' });
  }
});

router.post('/centros', async (req, res) => {
  const { nombre, direccion, localidad, horarios } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre del centro es obligatorio.' });
  try {
    const result = await pool.query(
      'INSERT INTO centros (nombre, direccion, localidad, horarios) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, direccion || null, localidad || null, JSON.stringify(horarios || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el centro.' });
  }
});

router.put('/centros/:id', async (req, res) => {
  const { nombre, direccion, localidad, activo, horarios } = req.body;
  try {
    const result = await pool.query(
      `UPDATE centros SET nombre=$1, direccion=$2, localidad=$3, activo=$4, horarios=$5 WHERE id=$6 RETURNING *`,
      [nombre, direccion, localidad, activo, JSON.stringify(horarios || {}), req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Centro no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el centro.' });
  }
});

router.delete('/centros/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM centros WHERE id=$1', [req.params.id]);
    res.json({ message: 'Centro eliminado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el centro.' });
  }
});

// ============================================================
// EMPLEADOS
// ============================================================

router.get('/empleados', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.dni_nie, e.nss, e.nombre, e.apellidos, e.movil, e.email,
             e.puesto, e.activo, e.created_at,
             c.id AS centro_id, c.nombre AS centro_nombre
      FROM empleados e
      LEFT JOIN centros c ON e.centro_id = c.id
      ORDER BY e.apellidos, e.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener empleados.' });
  }
});

router.get('/empleados/centro/:centroId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.dni_nie, e.nss, e.nombre, e.apellidos, e.movil, e.email,
             e.puesto, e.activo, e.created_at, c.nombre AS centro_nombre
      FROM empleados e
      LEFT JOIN centros c ON e.centro_id = c.id
      WHERE e.centro_id = $1
      ORDER BY e.apellidos, e.nombre
    `, [req.params.centroId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener empleados del centro.' });
  }
});

router.get('/empleados/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.dni_nie, e.nss, e.nombre, e.apellidos, e.movil, e.email,
             e.puesto, e.activo, e.created_at,
             c.id AS centro_id, c.nombre AS centro_nombre
      FROM empleados e
      LEFT JOIN centros c ON e.centro_id = c.id
      WHERE e.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el empleado.' });
  }
});

router.post('/empleados', async (req, res) => {
  const { dni_nie, nombre, apellidos, password, movil, email, centro_id, puesto, nss } = req.body;
  if (!dni_nie || !nombre || !apellidos || !password) {
    return res.status(400).json({ error: 'DNI/NIE, nombre, apellidos y contraseña son obligatorios.' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO empleados (dni_nie, nombre, apellidos, password, movil, email, centro_id, puesto, nss)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, dni_nie, nss, nombre, apellidos, movil, email, puesto, activo, created_at`,
      [dni_nie.toUpperCase(), nombre, apellidos, passwordHash,
       movil || null, email || null, centro_id || null, puesto || null, nss || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un empleado con ese DNI/NIE.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear el empleado.' });
  }
});

router.put('/empleados/:id', async (req, res) => {
  const { nombre, apellidos, movil, email, centro_id, puesto, activo, password, nss } = req.body;
  try {
    let query, params;
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query = `UPDATE empleados SET nombre=$1, apellidos=$2, movil=$3, email=$4,
               centro_id=$5, puesto=$6, activo=$7, password=$8, nss=$9 WHERE id=$10
               RETURNING id, dni_nie, nss, nombre, apellidos, movil, email, puesto, activo`;
      params = [nombre, apellidos, movil, email, centro_id, puesto, activo, passwordHash, nss || null, req.params.id];
    } else {
      query = `UPDATE empleados SET nombre=$1, apellidos=$2, movil=$3, email=$4,
               centro_id=$5, puesto=$6, activo=$7, nss=$8 WHERE id=$9
               RETURNING id, dni_nie, nss, nombre, apellidos, movil, email, puesto, activo`;
      params = [nombre, apellidos, movil, email, centro_id, puesto, activo, nss || null, req.params.id];
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el empleado.' });
  }
});

// ============================================================
// CONTRATOS
// ============================================================

// GET /api/admin/contratos/:empleadoId — Contrato activo de un empleado
router.get('/contratos/:empleadoId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ct.*, c.nombre AS centro_nombre
       FROM contratos ct
       LEFT JOIN centros c ON ct.centro_id = c.id
       WHERE ct.empleado_id = $1
       ORDER BY ct.created_at DESC`,
      [req.params.empleadoId]
    );
    // Devolver el más reciente (activo) o null
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el contrato.' });
  }
});

// POST /api/admin/contratos — Crear o actualizar contrato
router.post('/contratos', async (req, res) => {
  const {
    empleado_id, centro_id, categoria_profesional, convenio,
    tipo_contrato, tipo_jornada, horas_semanales, fecha_inicio, fecha_fin
  } = req.body;

  if (!empleado_id) {
    return res.status(400).json({ error: 'El empleado es obligatorio.' });
  }

  try {
    // Desactivar contratos anteriores
    await pool.query(
      'UPDATE contratos SET activo = false WHERE empleado_id = $1',
      [empleado_id]
    );

    const result = await pool.query(
      `INSERT INTO contratos
         (empleado_id, centro_id, categoria_profesional, convenio,
          tipo_contrato, tipo_jornada, horas_semanales, fecha_inicio, fecha_fin, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [
        empleado_id,
        centro_id || null,
        categoria_profesional || null,
        convenio || null,
        tipo_contrato || null,
        tipo_jornada || null,
        horas_semanales || null,
        fecha_inicio || null,
        fecha_fin || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el contrato.' });
  }
});

// ============================================================
// HORARIOS
// ============================================================

router.get('/horarios/:empleadoId/:mes/:anio', async (req, res) => {
  const { empleadoId, mes, anio } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM horarios WHERE empleado_id=$1 AND mes=$2 AND anio=$3',
      [empleadoId, parseInt(mes), parseInt(anio)]
    );
    if (result.rows.length === 0) return res.json({ dias: {} });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el horario.' });
  }
});

router.post('/horarios', async (req, res) => {
  const { empleado_id, mes, anio, dias } = req.body;
  if (!empleado_id || !mes || !anio || !dias) {
    return res.status(400).json({ error: 'Faltan datos del horario.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO horarios (empleado_id, mes, anio, dias)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (empleado_id, mes, anio)
       DO UPDATE SET dias = EXCLUDED.dias
       RETURNING *`,
      [empleado_id, mes, anio, JSON.stringify(dias)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el horario.' });
  }
});

// ============================================================
// FICHAJES (Admin)
// ============================================================

router.get('/fichajes', async (req, res) => {
  const { empleado_id, centro_id, fecha_inicio, fecha_fin } = req.query;
  try {
    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (empleado_id) { conditions.push(`f.empleado_id = $${paramIndex++}`); params.push(empleado_id); }
    if (centro_id) { conditions.push(`e.centro_id = $${paramIndex++}`); params.push(centro_id); }
    if (fecha_inicio) { conditions.push(`f.fecha >= $${paramIndex++}`); params.push(fecha_inicio); }
    if (fecha_fin) { conditions.push(`f.fecha <= $${paramIndex++}`); params.push(fecha_fin); }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(`
      SELECT f.id, f.tipo, f.timestamp, f.fecha,
             e.nombre, e.apellidos, e.dni_nie, e.puesto,
             c.nombre AS centro_nombre
      FROM fichajes f
      JOIN empleados e ON f.empleado_id = e.id
      LEFT JOIN centros c ON e.centro_id = c.id
      ${whereClause}
      ORDER BY f.timestamp DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener fichajes.' });
  }
});

// ============================================================
// LICENCIAS Y PERMISOS
// ============================================================

router.get('/licencias/:empleadoId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM licencias_permisos WHERE empleado_id = $1 ORDER BY fecha_inicio DESC',
      [req.params.empleadoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las licencias.' });
  }
});

router.post('/licencias', async (req, res) => {
  const { empleado_id, anio, causa, fecha_inicio, fecha_fin } = req.body;
  
  if (!empleado_id || !anio || !causa || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para la licencia.' });
  }

  // Verificar solapamiento básico (si se necesita en un futuro, se añade validación más estricta aquí)
  try {
    const result = await pool.query(
      `INSERT INTO licencias_permisos (empleado_id, anio, causa, fecha_inicio, fecha_fin) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [empleado_id, anio, causa, fecha_inicio, fecha_fin]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la licencia.' });
  }
});

router.delete('/licencias/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM licencias_permisos WHERE id = $1', [req.params.id]);
    res.json({ message: 'Licencia eliminada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la licencia.' });
  }
});

module.exports = router;
