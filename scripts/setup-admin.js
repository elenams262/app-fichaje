// Script para crear/actualizar el administrador en la base de datos
// Ejecutar con: node scripts/setup-admin.js

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../database/db');

// ============================================================
// CAMBIA ESTOS VALORES POR LOS REALES DE LA EMPRESA
// ============================================================
const ADMIN_CIF = 'B12345678';          // ← Pon el CIF real aquí
const ADMIN_PASSWORD = 'MiPasswordSegura2026!'; // ← Pon la contraseña real aquí
const ADMIN_EMPRESA = 'Martínez Sánchez Gasóleos';
// ============================================================

async function setupAdmin() {
  try {
    console.log('🔧 Configurando administrador...');
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Eliminar el admin de prueba si existe
    await pool.query("DELETE FROM admins WHERE cif = 'B12345678' AND empresa = 'Martínez Sánchez Gasóleos'");

    // Insertar el admin real
    const result = await pool.query(
      `INSERT INTO admins (cif, password, empresa)
       VALUES ($1, $2, $3)
       ON CONFLICT (cif) DO UPDATE SET password = EXCLUDED.password, empresa = EXCLUDED.empresa
       RETURNING id, cif, empresa`,
      [ADMIN_CIF.toUpperCase(), hash, ADMIN_EMPRESA]
    );

    console.log('✅ Administrador configurado correctamente:');
    console.log(`   CIF: ${result.rows[0].cif}`);
    console.log(`   Empresa: ${result.rows[0].empresa}`);
    console.log('');
    console.log('🔐 Guarda bien la contraseña — no se puede recuperar, solo resetear.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

setupAdmin();
