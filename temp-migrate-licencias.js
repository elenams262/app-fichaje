const pool = require('./database/db');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS licencias_permisos (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        empleado_id  UUID REFERENCES empleados(id) ON DELETE CASCADE NOT NULL,
        anio         INTEGER NOT NULL,
        causa        VARCHAR(100) NOT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_fin    DATE NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Crear índice para optimizar consultas de fichajes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_licencias_empleado_fechas ON licencias_permisos(empleado_id, fecha_inicio, fecha_fin);
    `);
    console.log("Migration successful: Table licencias_permisos created");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    process.exit(0);
  }
}

run();
