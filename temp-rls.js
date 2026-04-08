const pool = require('./database/db');

async function enableRLS() {
  const tables = [
    'admins',
    'centros',
    'empleados',
    'contratos',
    'horarios',
    'fichajes',
    'licencias_permisos'
  ];

  try {
    for (const table of tables) {
      console.log(`Habilitando Row Level Security (RLS) en: ${table}...`);
      await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      console.log(`✅ RLS activado en ${table}`);
    }
    console.log("¡Todo listo! Seguridad actualizada.");
  } catch (err) {
    console.error("Error al activar RLS:", err);
  } finally {
    process.exit(0);
  }
}

enableRLS();
