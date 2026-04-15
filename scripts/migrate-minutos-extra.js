const pool = require('../database/db');

async function migrate() {
  try {
    console.log('Iniciando migración: añadir minutos_extra a fichajes...');
    await pool.query('ALTER TABLE fichajes ADD COLUMN IF NOT EXISTS minutos_extra INTEGER DEFAULT 0');
    console.log('✅ Migración completada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err);
    process.exit(1);
  }
}

migrate();
