// ============================================================
// api.js — Módulo de comunicación con el servidor
// Todas las llamadas HTTP pasan por aquí
// ============================================================

const API = (() => {
  const BASE = '/api';

  // Obtener el token guardado en localStorage
  const getToken = () => localStorage.getItem('token');

  // Headers estándar para peticiones autenticadas
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  });

  // Función base de fetch con manejo de errores
  const request = async (method, path, body = null, auth = true) => {
    const options = {
      method,
      headers: auth ? authHeaders() : { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(BASE + path, options);
    const data = await res.json();

    if (!res.ok) {
      // Si el token expiró, cerramos sesión
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        window.location.reload();
      }
      throw new Error(data.error || 'Error del servidor');
    }
    return data;
  };

  return {
    // AUTH
    loginAdmin: (cif, password) =>
      request('POST', '/auth/login-admin', { cif, password }, false),

    loginEmpleado: (dni_nie, password) =>
      request('POST', '/auth/login-empleado', { dni_nie, password }, false),

    // FICHAJES (Empleado)
    fichar: () => request('POST', '/fichajes/fichar'),
    getEstado: () => request('GET', '/fichajes/estado'),
    getHistorial: (mes, anio) =>
      request('GET', `/fichajes/historial?mes=${mes}&anio=${anio}`),
    getHorario: (mes, anio) =>
      request('GET', `/fichajes/horario?mes=${mes}&anio=${anio}`),

    // CENTROS (Admin)
    getCentros: () => request('GET', '/admin/centros'),
    crearCentro: (data) => request('POST', '/admin/centros', data),
    editarCentro: (id, data) => request('PUT', `/admin/centros/${id}`, data),
    eliminarCentro: (id) => request('DELETE', `/admin/centros/${id}`),

    // EMPLEADOS (Admin)
    getEmpleados: () => request('GET', '/admin/empleados'),
    getEmpleadosPorCentro: (centroId) =>
      request('GET', `/admin/empleados/centro/${centroId}`),
    getEmpleado: (id) => request('GET', `/admin/empleados/${id}`),
    crearEmpleado: (data) => request('POST', '/admin/empleados', data),
    editarEmpleado: (id, data) => request('PUT', `/admin/empleados/${id}`, data),

    // CONTRATOS (Admin)
    getContrato: (empleadoId) => request('GET', `/admin/contratos/${empleadoId}`),
    guardarContrato: (data) => request('POST', '/admin/contratos', data),

    // HORARIOS (Admin)
    getHorarioAdmin: (empleadoId, mes, anio) =>
      request('GET', `/admin/horarios/${empleadoId}/${mes}/${anio}`),
    guardarHorario: (data) => request('POST', '/admin/horarios', data),

    // FICHAJES (Admin)
    getFichajesAdmin: (filtros = {}) => {
      const params = new URLSearchParams(filtros).toString();
      return request('GET', `/admin/fichajes?${params}`);
    }
  };
})();
