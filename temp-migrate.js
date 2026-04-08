const pool = require('./database/db');

async function run() {
  try {
    await pool.query(`ALTER TABLE centros ADD COLUMN IF NOT EXISTS horarios JSONB NOT NULL DEFAULT '{}'`);
    console.log("Migration successful: Added 'horarios' to 'centros'");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    process.exit(0);
  }
}

run();
