const jwt = require('jsonwebtoken');
require('dotenv').config();

// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN
// Verifica que el token JWT sea válido antes de acceder
// a rutas protegidas (admin o empleado)
// ============================================================

// Verificar que el token existe y es válido
const verificarToken = (req, res, next) => {
  // El token viene en el header "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded; // Guardamos los datos del usuario para usarlos en la ruta
    next(); // Continuamos con la siguiente función
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

// Solo permite acceso a administradores
const soloAdmin = (req, res, next) => {
  verificarToken(req, res, () => {
    if (req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede realizar esta acción.' });
    }
    next();
  });
};

// Solo permite acceso a empleados
const soloEmpleado = (req, res, next) => {
  verificarToken(req, res, () => {
    if (req.usuario.rol !== 'empleado') {
      return res.status(403).json({ error: 'Acceso solo para empleados.' });
    }
    next();
  });
};

module.exports = { verificarToken, soloAdmin, soloEmpleado };
