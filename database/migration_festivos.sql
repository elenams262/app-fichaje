-- ============================================================
-- MIGRACIÓN: Días Festivos por Centro
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

ALTER TABLE centros ADD COLUMN IF NOT EXISTS festivos JSONB DEFAULT '[]';
