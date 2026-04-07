# App de Fichaje — Martínez Sánchez Gasóleos

Sistema de control de presencia para empleados de Martínez Sánchez Gasóleos.

## Tecnologías

- **Backend:** Node.js + Express 5
- **Base de datos:** PostgreSQL (Supabase)
- **Frontend:** HTML + CSS + JavaScript (PWA)
- **Auth:** JWT

## Instalación local

```bash
# Instalar dependencias
npm install

# Crear el archivo .env con las variables (ver .env.example)
# Ejecutar el schema SQL en Supabase

# Configurar el administrador
node scripts/setup-admin.js

# Arrancar en desarrollo
npm run dev
```

## Variables de entorno necesarias

```
DATABASE_URL=postgresql://...
JWT_SECRET=clave_secreta_larga
PORT=3000
NODE_ENV=development
```

## Acceso

- **Administrador:** CIF de la empresa + contraseña
- **Empleado:** DNI/NIE + contraseña asignada por el admin
