-- ============================================================
-- SCHEMA DE BASE DE DATOS — App Fichaje Martínez Sánchez Gasóleos
-- Ejecutar este SQL en Supabase > SQL Editor
-- ============================================================

-- Extensión para UUIDs automáticos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: admins
-- Solo habrá un administrador (el de la empresa)
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cif         VARCHAR(20) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  empresa     VARCHAR(255) NOT NULL DEFAULT 'Martínez Sánchez Gasóleos',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: centros
-- Los 6 centros de trabajo (gasolineras)
-- ============================================================
CREATE TABLE IF NOT EXISTS centros (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     VARCHAR(255) NOT NULL,
  direccion  TEXT,
  localidad  VARCHAR(100),
  activo     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: empleados
-- Los 26 empleados de la empresa
-- ============================================================
CREATE TABLE IF NOT EXISTS empleados (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dni_nie      VARCHAR(20) UNIQUE NOT NULL,
  nombre       VARCHAR(100) NOT NULL,
  apellidos    VARCHAR(200) NOT NULL,
  password     VARCHAR(255) NOT NULL,
  movil        VARCHAR(20),
  email        VARCHAR(255),
  centro_id    UUID REFERENCES centros(id) ON DELETE SET NULL,
  puesto       VARCHAR(150),
  activo       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: horarios
-- El administrador asigna el horario mensual a cada empleado
-- dias es un JSON con la estructura por día de la semana
-- ============================================================
CREATE TABLE IF NOT EXISTS horarios (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id  UUID REFERENCES empleados(id) ON DELETE CASCADE NOT NULL,
  mes          INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio         INTEGER NOT NULL,
  dias         JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empleado_id, mes, anio)
);

-- ============================================================
-- TABLA: fichajes
-- Registro de cada entrada y salida
-- ============================================================
CREATE TABLE IF NOT EXISTS fichajes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id  UUID REFERENCES empleados(id) ON DELETE CASCADE NOT NULL,
  tipo         VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_fichajes_empleado ON fichajes(empleado_id);
CREATE INDEX IF NOT EXISTS idx_fichajes_fecha ON fichajes(fecha);
CREATE INDEX IF NOT EXISTS idx_empleados_centro ON empleados(centro_id);
CREATE INDEX IF NOT EXISTS idx_horarios_empleado ON horarios(empleado_id);

-- ============================================================
-- DATO INICIAL: Administrador por defecto
-- IMPORTANTE: Cambiar CIF y contraseña después de crear las tablas
-- La contraseña se almacenará hasheada desde la app, pero aquí
-- insertamos la hash de "admin123" para el primer acceso
-- ============================================================
INSERT INTO admins (cif, password, empresa)
VALUES (
  'B12345678',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Martínez Sánchez Gasóleos'
) ON CONFLICT (cif) DO NOTHING;
