const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
require('dotenv').config();

const router = express.Router();

// ============================================================
// POST /api/auth/login-admin
// El administrador entra con CIF + contraseña
// ============================================================
router.post('/login-admin', async (req, res) => {
  const { cif, password } = req.body;

  if (!cif || !password) {
    return res.status(400).json({ error: 'CIF y contraseña son obligatorios.' });
  }

  try {
    // Buscar al administrador por su CIF
    const result = await pool.query(
      'SELECT * FROM admins WHERE cif = $1',
      [cif.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'CIF o contraseña incorrectos.' });
    }

    const admin = result.rows[0];

    // bcrypt.compare compara la contraseña con la versión hasheada guardada
    // Nunca guardamos contraseñas en texto plano — solo el hash
    const passwordValida = await bcrypt.compare(password, admin.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'CIF o contraseña incorrectos.' });
    }

    // Crear el token JWT — expira en 8 horas
    const token = jwt.sign(
      { id: admin.id, cif: admin.cif, rol: 'admin', empresa: admin.empresa },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: admin.id,
        rol: 'admin',
        empresa: admin.empresa,
        cif: admin.cif
      }
    });

  } catch (err) {
    console.error('Error en login-admin:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ============================================================
// POST /api/auth/login-empleado
// El empleado entra con DNI/NIE + contraseña
// ============================================================
router.post('/login-empleado', async (req, res) => {
  const { dni_nie, password } = req.body;

  if (!dni_nie || !password) {
    return res.status(400).json({ error: 'DNI/NIE y contraseña son obligatorios.' });
  }

  try {
    // Buscar al empleado por DNI/NIE, trayendo también el nombre del centro
    const result = await pool.query(
      `SELECT e.*, c.nombre AS centro_nombre 
       FROM empleados e
       LEFT JOIN centros c ON e.centro_id = c.id
       WHERE e.dni_nie = $1 AND e.activo = true`,
      [dni_nie.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'DNI/NIE o contraseña incorrectos.' });
    }

    const empleado = result.rows[0];

    const passwordValida = await bcrypt.compare(password, empleado.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'DNI/NIE o contraseña incorrectos.' });
    }

    // Token JWT con datos del empleado — expira en 12 horas
    const token = jwt.sign(
      {
        id: empleado.id,
        dni_nie: empleado.dni_nie,
        rol: 'empleado',
        nombre: empleado.nombre,
        apellidos: empleado.apellidos,
        centro_id: empleado.centro_id,
        centro_nombre: empleado.centro_nombre
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      usuario: {
        id: empleado.id,
        rol: 'empleado',
        nombre: empleado.nombre,
        apellidos: empleado.apellidos,
        dni_nie: empleado.dni_nie,
        puesto: empleado.puesto,
        centro_nombre: empleado.centro_nombre
      }
    });

  } catch (err) {
    console.error('Error en login-empleado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
