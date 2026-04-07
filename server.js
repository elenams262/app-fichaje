const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar rutas (las iremos creando módulo a módulo)
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const fichajesRoutes = require('./routes/fichajes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARES
// Un middleware es código que se ejecuta ANTES de cada petición
// ============================================================

// CORS: permite que el navegador haga peticiones al servidor
// (necesario porque el frontend y el backend pueden estar en dominios diferentes)
app.use(cors());

// Parsear JSON: convierte el cuerpo de las peticiones a objetos JS
app.use(express.json());

// Servir archivos estáticos del frontend (HTML, CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// RUTAS DE LA API
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fichajes', fichajesRoutes);

// Ruta de salud: para verificar que el servidor está activo
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Servidor de fichajes activo',
    timestamp: new Date().toISOString()
  });
});

// Cualquier otra ruta devuelve el index.html (para que funcione la PWA)
// Express 5 requiere '/{*splat}' en lugar de '*'
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
  console.log(`📱 Modo: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
