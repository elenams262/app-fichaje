const { Pool } = require('pg');
require('dotenv').config();

// Pool de conexiones a PostgreSQL (Supabase)
// Un "pool" mantiene varias conexiones abiertas y las reutiliza
// para no tener que conectar/desconectar en cada petición
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necesario para Supabase
  }
});

// Verificar conexión al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
  } else {
    console.log('✅ Conectado a la base de datos (Supabase)');
    release();
  }
});

module.exports = pool;
