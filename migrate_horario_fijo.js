const pool = require('./database/db');

async function runMigration() {
  try {
    console.log('Running migration: adding horario_fijo and horario_fijo_inicio to empleados...');
    await pool.query(`
      ALTER TABLE empleados 
      ADD COLUMN IF NOT EXISTS horario_fijo JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS horario_fijo_inicio DATE DEFAULT NULL;
    `);
    console.log('✅ Migration successful');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during migration:', err);
    process.exit(1);
  }
}

runMigration();
