const pool = require('../database/db');

async function migrate() {
  try {
    console.log('Añadiendo columna horas_anuales a la tabla contratos...');
    await pool.query('ALTER TABLE contratos ADD COLUMN IF NOT EXISTS horas_anuales DECIMAL(10,2)');
    console.log('Migración completada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('Error en la migración:', err);
    process.exit(1);
  }
}

migrate();
