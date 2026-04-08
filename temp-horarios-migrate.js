const pool = require('./database/db');

async function migrate() {
  try {
    console.log("Renombrando/Eliminando antigua tabla de horarios...");
    await pool.query('DROP TABLE IF EXISTS horarios CASCADE;');

    console.log("Creando nueva tabla de horarios por semanas...");
    await pool.query(`
      CREATE TABLE horarios (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        empleado_id  UUID REFERENCES empleados(id) ON DELETE CASCADE,
        fecha_inicio DATE NOT NULL,
        fecha_fin    DATE NOT NULL,
        dias         JSONB NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(empleado_id, fecha_inicio, fecha_fin)
      );
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_horarios_empleado ON horarios(empleado_id);`);
    await pool.query(`ALTER TABLE horarios ENABLE ROW LEVEL SECURITY;`);

    console.log("✅ Migración de base de datos terminada");
  } catch(e) {
    console.error("Error", e);
  } finally {
    process.exit(0);
  }
}
migrate();
