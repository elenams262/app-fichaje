// ============================================================
// empleado.js — Lógica del panel de empleado
// ============================================================

const Empleado = (() => {
  let clockInterval = null;
  const DIAS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Inicializar el panel del empleado
  const init = async (usuario) => {
    rellenarInfoEmpleado(usuario);
    iniciarReloj();
    initBottomNav();
    await cargarEstado();
    cargarSelectoresHistorial();
  };

  // Muestra el nombre, centro y puesto en la cabecera de fichar
  const rellenarInfoEmpleado = (usuario) => {
    const hora = new Date().getHours();
    let saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
    document.getElementById('fichar-greeting').textContent = saludo + ',';
    document.getElementById('fichar-name').textContent =
      `${usuario.nombre} ${usuario.apellidos}`;
    document.getElementById('fichar-centro').textContent =
      usuario.centro_nombre || 'Sin centro asignado';
    document.getElementById('fichar-puesto').textContent =
      usuario.puesto || '';
  };

  // Reloj en tiempo real
  const iniciarReloj = () => {
    const actualizar = () => {
      const ahora = new Date();
      const h = String(ahora.getHours()).padStart(2,'0');
      const m = String(ahora.getMinutes()).padStart(2,'0');
      const s = String(ahora.getSeconds()).padStart(2,'0');
      const el = document.getElementById('fichar-clock');
      if (el) el.textContent = `${h}:${m}:${s}`;

      const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const meses = ['enero','febrero','marzo','abril','mayo','junio',
                     'julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const elFecha = document.getElementById('fichar-date');
      if (elFecha) {
        elFecha.textContent = `${dias[ahora.getDay()]}, ${ahora.getDate()} de ${meses[ahora.getMonth()]} de ${ahora.getFullYear()}`;
      }
    };
    actualizar();
    clockInterval = setInterval(actualizar, 1000);
  };

  // Cargar estado actual (dentro/fuera) y fichajes de hoy
  const cargarEstado = async () => {
    try {
      const data = await API.getEstado();
      actualizarUI(data);
    } catch (e) {
      App.showToast('Error al cargar estado', 'error');
    }
  };

  // Actualizar la UI según si está dentro o fuera
  const actualizarUI = (data) => {
    const badge = document.getElementById('fichar-status-badge');
    const statusText = document.getElementById('fichar-status-text');
    const btn = document.getElementById('btn-fichar');
    const btnText = document.getElementById('btn-fichar-text');

    if (data.estaEnTrabajo) {
      badge.className = 'fichar-status-badge dentro';
      statusText.textContent = 'En el trabajo';
      btn.className = 'btn-fichar salida';
      btnText.textContent = 'SALIDA';
    } else {
      badge.className = 'fichar-status-badge fuera';
      statusText.textContent = 'Fuera del trabajo';
      btn.className = 'btn-fichar entrada';
      btnText.textContent = 'ENTRADA';
    }
    btn.disabled = false;

    // Mostrar fichajes de hoy
    const contenedor = document.getElementById('fichajes-hoy');
    if (data.fichajesHoy && data.fichajesHoy.length > 0) {
      contenedor.innerHTML = '<div class="historial-day-label" style="margin-bottom:10px">Fichajes de hoy</div>' +
        data.fichajesHoy.map(f => {
          const hora = new Date(f.timestamp).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
          return `<div class="fichaje-item-hoy">
            <span class="fichaje-tipo-tag ${f.tipo}">${f.tipo.toUpperCase()}</span>
            <span class="fichaje-hora">${hora}</span>
          </div>`;
        }).join('');
    } else {
      contenedor.innerHTML = '';
    }
  };

  // Acción de fichar
  const fichar = async () => {
    const btn = document.getElementById('btn-fichar');
    btn.disabled = true;
    try {
      const res = await API.fichar();
      App.showToast(res.mensaje, 'success');
      await cargarEstado();
    } catch (e) {
      App.showToast(e.message, 'error');
      btn.disabled = false;
    }
  };

  // Selector de mes/año para el historial
  const cargarSelectoresHistorial = () => {
    const ahora = new Date();
    const selMes = document.getElementById('hist-mes');
    const selAnio = document.getElementById('hist-anio');
    if (!selMes || !selAnio) return;

    MESES_ES.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = m;
      if (i === ahora.getMonth()) opt.selected = true;
      selMes.appendChild(opt);
    });

    for (let y = ahora.getFullYear(); y >= ahora.getFullYear() - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      selAnio.appendChild(opt);
    }
  };

  // Cargar historial del empleado
  const cargarHistorial = async () => {
    const mes = document.getElementById('hist-mes').value;
    const anio = document.getElementById('hist-anio').value;
    const contenedor = document.getElementById('historial-list');
    contenedor.innerHTML = '<div class="loading-inline"><div class="spinner"></div></div>';

    try {
      const data = await API.getHistorial(mes, anio);
      if (!data || data.length === 0) {
        contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>No hay fichajes en este período</p></div>';
        return;
      }

      // Agrupar por fecha
      const grupos = {};
      data.forEach(f => {
        if (!grupos[f.fecha]) grupos[f.fecha] = [];
        grupos[f.fecha].push(f);
      });

      const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      contenedor.innerHTML = Object.entries(grupos).map(([fecha, fichajes]) => {
        const d = new Date(fecha + 'T12:00:00');
        const diaLabel = `${diasSemana[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`;
        const rows = fichajes.map(f => {
          const hora = new Date(f.timestamp).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
          return `<div class="historial-row">
            <span class="fichaje-tipo-tag ${f.tipo}">${f.tipo.toUpperCase()}</span>
            <span class="fichaje-hora td-muted">${hora}</span>
          </div>`;
        }).join('');
        return `<div class="historial-day-group">
          <div class="historial-day-label">${diaLabel}</div>
          ${rows}
        </div>`;
      }).join('');

    } catch (e) {
      contenedor.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
    }
  };

  // Cargar horario del empleado
  const cargarHorario = async () => {
    const contenedor = document.getElementById('horario-display');
    contenedor.innerHTML = '<div class="loading-inline"><div class="spinner"></div></div>';

    try {
      const data = await API.getHorario();
      if (!data.dias || Object.keys(data.dias).length === 0) {
        contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><p>No tienes horario asignado para este mes</p></div>';
        return;
      }

      const orden = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
      contenedor.innerHTML = orden.map(dia => {
        const info = data.dias[dia] || data.dias[dia.normalize('NFD').replace(/[\u0300-\u036f]/g,'')];
        if (!info) return `<div class="horario-row">
          <span class="horario-dia" style="text-transform:capitalize">${dia}</span>
          <span class="horario-libre">Libre</span>
        </div>`;
        return `<div class="horario-row">
          <span class="horario-dia" style="text-transform:capitalize">${dia}</span>
          <span class="horario-horas">${info.entrada} — ${info.salida}</span>
        </div>`;
      }).join('');

    } catch (e) {
      contenedor.innerHTML = `<div class="empty-state"><p>Error al cargar horario</p></div>`;
    }
  };

  // Navegación entre tabs del empleado
  const initBottomNav = () => {
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.emp-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // Cargar datos según la pestaña
        if (tabId === 'tab-historial') cargarHistorial();
        if (tabId === 'tab-horario') cargarHorario();
      });
    });
  };

  // Botón de fichar
  const bindFichar = () => {
    document.getElementById('btn-fichar').addEventListener('click', fichar);
    document.getElementById('btn-filtrar-hist').addEventListener('click', cargarHistorial);
  };

  const destroy = () => {
    if (clockInterval) clearInterval(clockInterval);
  };

  return { init, bindFichar, destroy };
})();
