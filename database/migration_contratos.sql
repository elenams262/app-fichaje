-- ============================================================
-- MIGRACIÓN: Número de Seguridad Social + Tabla de Contratos
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Añadir NSS a la tabla empleados
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS nss VARCHAR(20);

-- ============================================================
-- TABLA: contratos
-- Cada empleado puede tener un contrato activo (o histórico)
-- ============================================================
CREATE TABLE IF NOT EXISTS contratos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empleado_id           UUID REFERENCES empleados(id) ON DELETE CASCADE NOT NULL,
  centro_id             UUID REFERENCES centros(id) ON DELETE SET NULL,
  categoria_profesional VARCHAR(200),
  convenio              VARCHAR(200),
  tipo_contrato         VARCHAR(100),
  tipo_jornada          VARCHAR(100),
  horas_semanales       DECIMAL(5,2),
  fecha_inicio          DATE,
  fecha_fin             DATE,
  activo                BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contratos_empleado ON contratos(empleado_id);
