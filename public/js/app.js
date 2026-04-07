// ============================================================
// app.js — Controlador principal de la aplicación
// Gestiona la navegación entre vistas, login/logout y utilidades
// ============================================================

const App = (() => {
  let usuarioActual = null;

  // ============================================================
  // INICIALIZACIÓN
  // ============================================================
  const init = async () => {
    // Pequeña pausa para mostrar el splash
    await new Promise(r => setTimeout(r, 1200));

    // Comprobar si ya hay sesión guardada
    const token = localStorage.getItem('token');
    const usuario = localStorage.getItem('usuario');

    if (token && usuario) {
      usuarioActual = JSON.parse(usuario);
      mostrarApp();
      if (usuarioActual.rol === 'admin') {
        mostrarVistaAdmin();
      } else {
        mostrarVistaEmpleado();
      }
    } else {
      mostrarApp();
      mostrarVista('login');
    }

    bindEventos();
    hideSplash();
  };

  // Ocultar el splash y mostrar la app
  const hideSplash = () => {
    const splash = document.getElementById('splash');
    splash.classList.add('fade-out');
    setTimeout(() => splash.classList.add('hidden'), 500);
    document.getElementById('app').classList.remove('hidden');
  };

  const mostrarApp = () => {
    document.getElementById('app').classList.remove('hidden');
  };

  // ============================================================
  // NAVEGACIÓN ENTRE VISTAS
  // ============================================================
  const mostrarVista = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const vista = document.getElementById(`view-${id}`);
    if (vista) vista.classList.add('active');

    // Mostrar/ocultar header
    const header = document.getElementById('app-header');
    const needsHeader = ['admin', 'empleado'].includes(id);
    header.classList.toggle('visible', needsHeader);
    document.getElementById('main-content').classList.toggle('with-header', needsHeader);
    document.getElementById('main-content').classList.toggle('with-bottom-nav', id === 'empleado');
  };

  const mostrarVistaEmpleado = () => {
    mostrarVista('empleado');
    document.getElementById('header-title').textContent = 'MSG Gasóleos';
    document.getElementById('header-user').textContent =
      `${usuarioActual.nombre} ${usuarioActual.apellidos}`;
    document.getElementById('btn-sidebar').classList.add('hidden');
    Empleado.init(usuarioActual);
    Empleado.bindFichar();
  };

  const mostrarVistaAdmin = () => {
    mostrarVista('admin');
    document.getElementById('header-title').textContent = 'Panel Admin';
    document.getElementById('header-user').textContent = 'Administrador';
    document.getElementById('btn-sidebar').classList.remove('hidden');
    Admin.init();
  };

  // ============================================================
  // EVENTOS
  // ============================================================
  const bindEventos = () => {
    // Botones de selección de login
    document.getElementById('btn-login-admin').addEventListener('click', () => mostrarVista('login-admin'));
    document.getElementById('btn-login-empleado').addEventListener('click', () => mostrarVista('login-empleado'));
    document.getElementById('back-from-admin').addEventListener('click', () => mostrarVista('login'));
    document.getElementById('back-from-empleado').addEventListener('click', () => mostrarVista('login'));

    // Formulario login admin
    document.getElementById('form-login-admin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-admin');
      const errEl = document.getElementById('error-admin');
      const cif = document.getElementById('admin-cif').value.trim();
      const password = document.getElementById('admin-password').value;

      btn.classList.add('loading'); btn.disabled = true;
      errEl.classList.add('hidden');

      try {
        const data = await API.loginAdmin(cif, password);
        guardarSesion(data);
        mostrarVistaAdmin();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
      } finally {
        btn.classList.remove('loading'); btn.disabled = false;
      }
    });

    // Formulario login empleado
    document.getElementById('form-login-empleado').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-empleado');
      const errEl = document.getElementById('error-empleado');
      const dni_nie = document.getElementById('emp-dni').value.trim();
      const password = document.getElementById('emp-password').value;

      btn.classList.add('loading'); btn.disabled = true;
      errEl.classList.add('hidden');

      try {
        const data = await API.loginEmpleado(dni_nie, password);
        guardarSesion(data);
        mostrarVistaEmpleado();
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
      } finally {
        btn.classList.remove('loading'); btn.disabled = false;
      }
    });

    // Botones de logout
    document.getElementById('btn-logout').addEventListener('click', logout);

    // Toggle mostrar/ocultar contraseña
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    // Modal
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) closeModal();
    });
  };

  // ============================================================
  // SESIÓN
  // ============================================================
  const guardarSesion = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    usuarioActual = data.usuario;
  };

  const logout = () => {
    Empleado.destroy();
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    usuarioActual = null;
    mostrarVista('login');
    // Limpiar formularios
    document.getElementById('form-login-admin').reset();
    document.getElementById('form-login-empleado').reset();
    document.getElementById('btn-sidebar').classList.add('hidden');
  };

  // ============================================================
  // MODAL
  // ============================================================
  const openModal = (title, body, buttons = []) => {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    buttons.forEach(btn => {
      const el = document.createElement('button');
      el.textContent = btn.text;
      el.className = btn.cls || 'btn-outline';
      el.addEventListener('click', btn.action);
      footer.appendChild(el);
    });
    document.getElementById('modal-overlay').classList.remove('hidden');
    // Foco en el primer input del modal
    setTimeout(() => {
      const input = document.querySelector('#modal-body input');
      if (input) input.focus();
    }, 100);
  };

  const closeModal = () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-footer').innerHTML = '';
  };

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================
  const showToast = (msg, tipo = 'info', duracion = 3000) => {
    const contenedor = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = msg;
    contenedor.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duracion);
  };

  return { init, mostrarVista, logout, openModal, closeModal, showToast };
})();

// Arrancar la app cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());
