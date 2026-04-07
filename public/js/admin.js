// ============================================================
// admin.js — Lógica del panel de administrador
// ============================================================

const Admin = (() => {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  let centros = [];
  let empleados = [];

  // Inicializar el panel de administrador
  const init = async () => {
    initSidebar();
    initNavItems();
    await cargarDashboard();
    await Promise.all([cargarCentros(), cargarEmpleados()]);
    initHorarioEditor();
    initFichajesAdmin();
  };

  // ============================================================
  // SIDEBAR
  // ============================================================
  const initSidebar = () => {
    const btnSidebar = document.getElementById('btn-sidebar');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btnClose = document.getElementById('sidebar-close');
    const btnLogout = document.getElementById('btn-logout-sidebar');

    const open = () => { sidebar.classList.add('open'); overlay.classList.add('visible'); };
    const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); };

    btnSidebar?.addEventListener('click', open);
    overlay?.addEventListener('click', close);
    btnClose?.addEventListener('click', close);
    btnLogout?.addEventListener('click', () => App.logout());
  };

  // Navegación entre secciones del admin
  const initNavItems = () => {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        mostrarSeccion(view);
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        // Cerrar sidebar en móvil
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('visible');
      });
    });
  };

  const mostrarSeccion = (id) => {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  };

  // ============================================================
  // DASHBOARD
  // ============================================================
  const cargarDashboard = async () => {
    const hoy = new Date();
    document.getElementById('dashboard-fecha').textContent =
      hoy.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long', year:'numeric'});

    try {
      const [emps, cts, fichajes] = await Promise.all([
        API.getEmpleados(),
        API.getCentros(),
        API.getFichajesAdmin({ fecha_inicio: hoy.toISOString().split('T')[0], fecha_fin: hoy.toISOString().split('T')[0] })
      ]);

      document.getElementById('stat-empleados').textContent = emps.filter(e => e.activo).length;
      document.getElementById('stat-centros').textContent = cts.filter(c => c.activo).length;

      const entradas = fichajes.filter(f => f.tipo === 'entrada');
      const salidas = fichajes.filter(f => f.tipo === 'salida');
      document.getElementById('stat-entradas-hoy').textContent = entradas.length;
      document.getElementById('stat-salidas-hoy').textContent = salidas.length;

      // Últimos 10 fichajes
      const contenedor = document.getElementById('dashboard-fichajes');
      if (fichajes.length === 0) {
        contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>Sin fichajes hoy</p></div>';
      } else {
        contenedor.innerHTML = fichajes.slice(0, 10).map(f => {
          const hora = new Date(f.timestamp).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
          return `<div class="fichaje-dashboard-row">
            <div>
              <div class="fichaje-emp-name">${f.nombre} ${f.apellidos}</div>
              <div class="fichaje-emp-sub">${f.centro_nombre || '—'} · ${f.puesto || '—'}</div>
            </div>
            <div class="fichaje-time-info">
              <div class="fichaje-time">${hora}</div>
              <span class="badge ${f.tipo === 'entrada' ? 'badge-green' : 'badge-red'}">${f.tipo.toUpperCase()}</span>
            </div>
          </div>`;
        }).join('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ============================================================
  // CENTROS
  // ============================================================
  const cargarCentros = async () => {
    try {
      centros = await API.getCentros();
      renderCentros();
      actualizarSelectCentros();
    } catch (e) { console.error(e); }
  };

  const renderCentros = () => {
    const contenedor = document.getElementById('centros-list');
    if (!contenedor) return;
    if (centros.length === 0) {
      contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏠</div><p>No hay centros creados. Crea el primero.</p></div>';
      return;
    }
    contenedor.innerHTML = centros.map(c => `
      <div class="centro-card">
        <div class="centro-card-icon">⛽</div>
        <div class="centro-card-name">${c.nombre}</div>
        <div class="centro-card-dir">${[c.direccion, c.localidad].filter(Boolean).join(' · ') || 'Sin dirección'}</div>
        <div class="centro-card-footer">
          <span class="centro-card-count">${c.total_empleados || 0} empleado${c.total_empleados != 1 ? 's' : ''}</span>
          <div class="centro-card-actions">
            <button class="btn-icon" onclick="Admin.editarCentroModal('${c.id}')" title="Editar">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon btn-logout" onclick="Admin.eliminarCentroConfirm('${c.id}','${c.nombre}')" title="Eliminar">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
    document.getElementById('btn-nuevo-centro').onclick = () => modalNuevoCentro();
  };

  const modalNuevoCentro = (centro = null) => {
    const esEdicion = !!centro;
    App.openModal(
      esEdicion ? 'Editar centro' : 'Nuevo centro de trabajo',
      `<form id="form-centro" class="form">
        <div class="form-group"><label>Nombre del centro *</label>
          <input type="text" id="c-nombre" value="${centro?.nombre||''}" required placeholder="Ej: Gasolinera Repsol Norte" /></div>
        <div class="form-group"><label>Dirección</label>
          <input type="text" id="c-dir" value="${centro?.direccion||''}" placeholder="Calle, número..." /></div>
        <div class="form-group"><label>Localidad</label>
          <input type="text" id="c-loc" value="${centro?.localidad||''}" placeholder="Ciudad o municipio" /></div>
      </form>`,
      [
        { text: 'Cancelar', cls: 'btn-outline', action: () => App.closeModal() },
        { text: esEdicion ? 'Guardar cambios' : 'Crear centro', cls: 'btn-primary',
          action: async () => {
            const nombre = document.getElementById('c-nombre').value.trim();
            if (!nombre) { App.showToast('El nombre es obligatorio', 'error'); return; }
            const payload = {
              nombre,
              direccion: document.getElementById('c-dir').value,
              localidad: document.getElementById('c-loc').value,
              activo: true
            };
            try {
              if (esEdicion) await API.editarCentro(centro.id, payload);
              else await API.crearCentro(payload);
              App.closeModal();
              App.showToast(esEdicion ? 'Centro actualizado' : 'Centro creado', 'success');
              await cargarCentros();
            } catch (e) { App.showToast(e.message, 'error'); }
          }
        }
      ]
    );
  };

  const editarCentroModal = async (id) => {
    const centro = centros.find(c => c.id === id);
    if (centro) modalNuevoCentro(centro);
  };

  const eliminarCentroConfirm = (id, nombre) => {
    App.openModal('Eliminar centro', `<p>¿Seguro que quieres eliminar <strong>${nombre}</strong>? Esta acción no se puede deshacer.</p>`,
      [
        { text: 'Cancelar', cls: 'btn-outline', action: () => App.closeModal() },
        { text: 'Eliminar', cls: 'btn-primary', action: async () => {
          try {
            await API.eliminarCentro(id);
            App.closeModal();
            App.showToast('Centro eliminado', 'success');
            await cargarCentros();
          } catch (e) { App.showToast(e.message, 'error'); }
        }}
      ]
    );
  };

  // Actualizar el select de centros en formularios
  const actualizarSelectCentros = () => {
    ['filtro-centro', 'f-centro'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const val = sel.value;
      const opts = centros.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
      sel.innerHTML = `<option value="">Todos los centros</option>${opts}`;
      sel.value = val;
    });
  };

  // ============================================================
  // EMPLEADOS
  // ============================================================
  const cargarEmpleados = async () => {
    try {
      empleados = await API.getEmpleados();
      renderEmpleados(empleados);
      actualizarSelectEmpleados();
    } catch (e) { console.error(e); }
  };

  const renderEmpleados = (lista) => {
    const contenedor = document.getElementById('empleados-list');
    if (!contenedor) return;
    if (!lista || lista.length === 0) {
      contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👤</div><p>No hay empleados. Crea el primero.</p></div>';
      return;
    }
    contenedor.innerHTML = `<table>
      <thead><tr>
        <th>Nombre</th><th>DNI/NIE</th><th>Centro</th><th>Puesto</th>
        <th>Contacto</th><th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody>
        ${lista.map(e => `<tr>
          <td><strong>${e.apellidos}, ${e.nombre}</strong></td>
          <td class="td-muted">${e.dni_nie}</td>
          <td class="td-muted">${e.centro_nombre || '—'}</td>
          <td class="td-muted">${e.puesto || '—'}</td>
          <td class="td-muted">${e.movil || ''}<br/><span style="font-size:12px">${e.email||''}</span></td>
          <td><span class="badge ${e.activo ? 'badge-green' : 'badge-red'}">${e.activo ? 'Activo' : 'Inactivo'}</span></td>
          <td>
            <div class="td-actions">
              <button class="btn-icon" onclick="Admin.editarEmpleadoModal('${e.id}')" title="Editar">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;

    // Buscador
    document.getElementById('filtro-empleado').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtrado = empleados.filter(emp =>
        `${emp.nombre} ${emp.apellidos} ${emp.dni_nie}`.toLowerCase().includes(q)
      );
      renderEmpleados(filtrado);
    });

    document.getElementById('filtro-centro').addEventListener('change', (e) => {
      const cid = e.target.value;
      const filtrado = cid ? empleados.filter(emp => emp.centro_id === cid) : empleados;
      renderEmpleados(filtrado);
    });

    document.getElementById('btn-nuevo-empleado').onclick = () => modalNuevoEmpleado();
  };

  const getFormEmpleado = (emp = null) => {
    const centrosOpts = centros.map(c =>
      `<option value="${c.id}" ${emp?.centro_id === c.id ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');
    return `<form id="form-empleado" class="form">
      <div class="form-row">
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" id="emp-nombre" value="${emp?.nombre||''}" required placeholder="Nombre" />
        </div>
        <div class="form-group">
          <label>Apellidos *</label>
          <input type="text" id="emp-apellidos" value="${emp?.apellidos||''}" required placeholder="Apellidos" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>DNI / NIE *</label>
          <input type="text" id="emp-dni-nie" value="${emp?.dni_nie||''}" ${emp?'readonly':''} required placeholder="12345678A" />
        </div>
        <div class="form-group">
          <label>Contraseña ${emp?'(dejar vacío = no cambiar)':'*'}</label>
          <input type="password" id="emp-pwd" placeholder="${emp?'Nueva contraseña (opcional)':'Contraseña inicial'}" ${!emp?'required':''} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Móvil</label>
          <input type="tel" id="emp-movil" value="${emp?.movil||''}" placeholder="6XX XXX XXX" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="emp-email" value="${emp?.email||''}" placeholder="correo@ejemplo.com" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Centro de trabajo</label>
          <select id="emp-centro" class="select-full">
            <option value="">Sin centro</option>${centrosOpts}
          </select>
        </div>
        <div class="form-group">
          <label>Puesto de trabajo</label>
          <input type="text" id="emp-puesto" value="${emp?.puesto||''}" placeholder="Ej: Expendedor, Encargado..." />
        </div>
      </div>
      ${emp ? `<div class="form-group">
        <label>Estado</label>
        <select id="emp-activo" class="select-full">
          <option value="true" ${emp.activo?'selected':''}>Activo</option>
          <option value="false" ${!emp.activo?'selected':''}>Inactivo</option>
        </select>
      </div>` : ''}
    </form>`;
  };

  const modalNuevoEmpleado = () => {
    App.openModal('Nuevo empleado', getFormEmpleado(), [
      { text: 'Cancelar', cls: 'btn-outline', action: () => App.closeModal() },
      { text: 'Crear empleado', cls: 'btn-primary', action: async () => {
        const payload = {
          nombre: document.getElementById('emp-nombre').value.trim(),
          apellidos: document.getElementById('emp-apellidos').value.trim(),
          dni_nie: document.getElementById('emp-dni-nie').value.trim(),
          password: document.getElementById('emp-pwd').value,
          movil: document.getElementById('emp-movil').value.trim(),
          email: document.getElementById('emp-email').value.trim(),
          centro_id: document.getElementById('emp-centro').value || null,
          puesto: document.getElementById('emp-puesto').value.trim()
        };
        if (!payload.nombre || !payload.apellidos || !payload.dni_nie || !payload.password) {
          App.showToast('Rellena los campos obligatorios', 'error'); return;
        }
        try {
          await API.crearEmpleado(payload);
          App.closeModal();
          App.showToast('Empleado creado correctamente', 'success');
          await cargarEmpleados();
        } catch (e) { App.showToast(e.message, 'error'); }
      }}
    ]);
  };

  const editarEmpleadoModal = async (id) => {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;
    App.openModal('Editar empleado', getFormEmpleado(emp), [
      { text: 'Cancelar', cls: 'btn-outline', action: () => App.closeModal() },
      { text: 'Guardar cambios', cls: 'btn-primary', action: async () => {
        const payload = {
          nombre: document.getElementById('emp-nombre').value.trim(),
          apellidos: document.getElementById('emp-apellidos').value.trim(),
          movil: document.getElementById('emp-movil').value.trim(),
          email: document.getElementById('emp-email').value.trim(),
          centro_id: document.getElementById('emp-centro').value || null,
          puesto: document.getElementById('emp-puesto').value.trim(),
          activo: document.getElementById('emp-activo').value === 'true'
        };
        const pwd = document.getElementById('emp-pwd').value;
        if (pwd) payload.password = pwd;
        try {
          await API.editarEmpleado(id, payload);
          App.closeModal();
          App.showToast('Empleado actualizado', 'success');
          await cargarEmpleados();
        } catch (e) { App.showToast(e.message, 'error'); }
      }}
    ]);
  };

  const actualizarSelectEmpleados = () => {
    ['horario-empleado-sel','f-empleado'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const opts = empleados.map(e =>
        `<option value="${e.id}">${e.apellidos}, ${e.nombre} (${e.dni_nie})</option>`
      ).join('');
      sel.innerHTML = id === 'f-empleado'
        ? `<option value="">Todos</option>${opts}`
        : opts;
    });
  };

  // ============================================================
  // HORARIOS (Admin)
  // ============================================================
  const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  let horarioActual = {};

  const initHorarioEditor = () => {
    const selMes = document.getElementById('horario-mes-sel');
    const selAnio = document.getElementById('horario-anio-sel');
    if (!selMes || !selAnio) return;

    const ahora = new Date();
    MESES.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1; opt.textContent = m;
      if (i === ahora.getMonth()) opt.selected = true;
      selMes.appendChild(opt);
    });
    for (let y = ahora.getFullYear() + 1; y >= ahora.getFullYear() - 1; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === ahora.getFullYear()) opt.selected = true;
      selAnio.appendChild(opt);
    }

    document.getElementById('btn-cargar-horario').addEventListener('click', cargarHorarioEditor);
    document.getElementById('btn-guardar-horario').addEventListener('click', guardarHorario);
  };

  const cargarHorarioEditor = async () => {
    const empId = document.getElementById('horario-empleado-sel').value;
    const mes = document.getElementById('horario-mes-sel').value;
    const anio = document.getElementById('horario-anio-sel').value;
    if (!empId) { App.showToast('Selecciona un empleado', 'error'); return; }

    try {
      const data = await API.getHorarioAdmin(empId, mes, anio);
      horarioActual = data.dias || {};
      renderHorarioEditor();
      document.getElementById('horario-editor').classList.remove('hidden');
      document.getElementById('horario-actions').classList.remove('hidden');
    } catch (e) { App.showToast(e.message, 'error'); }
  };

  const renderHorarioEditor = () => {
    const contenedor = document.getElementById('horario-editor');
    contenedor.innerHTML = `<div class="horario-editor-title">Define el horario por día de la semana</div>` +
      DIAS.map(dia => {
        const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
        const info = horarioActual[diaKey] || horarioActual[dia] || null;
        const activo = !!info;
        return `<div class="horario-dia-row" id="row-${dia}">
          <div class="horario-dia-label">
            <div class="toggle-dia ${activo?'on':''}" data-dia="${dia}" onclick="Admin.toggleDia('${dia}')"></div>
            ${diaKey}
          </div>
          <input type="time" class="time-input" id="h-entrada-${dia}" value="${info?.entrada||'07:00'}" ${!activo?'disabled':''} />
          <input type="time" class="time-input" id="h-salida-${dia}" value="${info?.salida||'15:00'}" ${!activo?'disabled':''} />
          <span style="font-size:12px;color:var(--text-dim)">${activo?'activo':'libre'}</span>
        </div>`;
      }).join('');
  };

  const toggleDia = (dia) => {
    const toggle = document.querySelector(`[data-dia="${dia}"]`);
    const eActivo = toggle.classList.toggle('on');
    document.getElementById(`h-entrada-${dia}`).disabled = !eActivo;
    document.getElementById(`h-salida-${dia}`).disabled = !eActivo;
  };

  const guardarHorario = async () => {
    const empId = document.getElementById('horario-empleado-sel').value;
    const mes = parseInt(document.getElementById('horario-mes-sel').value);
    const anio = parseInt(document.getElementById('horario-anio-sel').value);

    const dias = {};
    DIAS.forEach(dia => {
      const toggle = document.querySelector(`[data-dia="${dia}"]`);
      if (toggle && toggle.classList.contains('on')) {
        const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
        dias[diaKey] = {
          entrada: document.getElementById(`h-entrada-${dia}`)?.value || '07:00',
          salida: document.getElementById(`h-salida-${dia}`)?.value || '15:00'
        };
      }
    });

    try {
      await API.guardarHorario({ empleado_id: empId, mes, anio, dias });
      App.showToast('Horario guardado correctamente', 'success');
    } catch (e) { App.showToast(e.message, 'error'); }
  };

  // ============================================================
  // FICHAJES ADMIN
  // ============================================================
  const initFichajesAdmin = () => {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('f-desde').value = hoy;
    document.getElementById('f-hasta').value = hoy;

    document.getElementById('btn-filtrar-fichajes').addEventListener('click', cargarFichajesAdmin);
    document.getElementById('btn-export-excel').addEventListener('click', exportarExcel);
    document.getElementById('btn-export-pdf').addEventListener('click', exportarPDF);
  };

  let fichajesData = [];

  const cargarFichajesAdmin = async () => {
    const filtros = {};
    const empId = document.getElementById('f-empleado').value;
    const centroId = document.getElementById('f-centro').value;
    const desde = document.getElementById('f-desde').value;
    const hasta = document.getElementById('f-hasta').value;

    if (empId) filtros.empleado_id = empId;
    if (centroId) filtros.centro_id = centroId;
    if (desde) filtros.fecha_inicio = desde;
    if (hasta) filtros.fecha_fin = hasta;

    const contenedor = document.getElementById('fichajes-admin-list');
    contenedor.innerHTML = '<div class="loading-inline"><div class="spinner"></div></div>';

    try {
      fichajesData = await API.getFichajesAdmin(filtros);
      if (fichajesData.length === 0) {
        contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>No hay fichajes con esos filtros</p></div>';
        return;
      }
      contenedor.innerHTML = `<table>
        <thead><tr>
          <th>Empleado</th><th>DNI/NIE</th><th>Centro</th><th>Tipo</th>
          <th>Fecha</th><th>Hora</th>
        </tr></thead>
        <tbody>
          ${fichajesData.map(f => {
            const dt = new Date(f.timestamp);
            return `<tr>
              <td><strong>${f.apellidos}, ${f.nombre}</strong><br/><span class="td-muted" style="font-size:12px">${f.puesto||''}</span></td>
              <td class="td-muted">${f.dni_nie}</td>
              <td class="td-muted">${f.centro_nombre||'—'}</td>
              <td><span class="badge ${f.tipo==='entrada'?'badge-green':'badge-red'}">${f.tipo.toUpperCase()}</span></td>
              <td class="td-muted">${dt.toLocaleDateString('es-ES')}</td>
              <td class="td-muted">${dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    } catch (e) {
      contenedor.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
    }
  };

  // ============================================================
  // EXPORTACIÓN
  // ============================================================
  const exportarExcel = () => {
    if (!fichajesData || fichajesData.length === 0) {
      App.showToast('No hay datos para exportar. Aplica los filtros primero.', 'error'); return;
    }
    const headers = ['Empleado','DNI/NIE','Centro','Puesto','Tipo','Fecha','Hora'];
    const rows = fichajesData.map(f => {
      const dt = new Date(f.timestamp);
      return [
        `${f.apellidos}, ${f.nombre}`,
        f.dni_nie, f.centro_nombre||'', f.puesto||'', f.tipo.toUpperCase(),
        dt.toLocaleDateString('es-ES'), dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fichajes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    App.showToast('Excel descargado', 'success');
  };

  const exportarPDF = () => {
    if (!fichajesData || fichajesData.length === 0) {
      App.showToast('No hay datos para exportar. Aplica los filtros primero.', 'error'); return;
    }
    const head = `<html><head><meta charset="utf-8">
    <title>Fichajes MSG Gasóleos</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
      h1{color:#f59e0b;font-size:18px;margin-bottom:4px}
      p{color:#666;font-size:12px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f59e0b;color:#0f1724;padding:8px;text-align:left;font-weight:bold}
      td{padding:7px 8px;border-bottom:1px solid #eee}
      tr:nth-child(even){background:#f9f9f9}
    </style></head><body>
    <h1>Registros de Fichaje — Martínez Sánchez Gasóleos</h1>
    <p>Generado: ${new Date().toLocaleString('es-ES')}</p>
    <table><thead><tr>
      <th>Empleado</th><th>DNI/NIE</th><th>Centro</th><th>Tipo</th><th>Fecha</th><th>Hora</th>
    </tr></thead><tbody>`;
    const body = fichajesData.map(f => {
      const dt = new Date(f.timestamp);
      const color = f.tipo === 'entrada' ? '#10b981' : '#ef4444';
      return `<tr>
        <td>${f.apellidos}, ${f.nombre}</td>
        <td>${f.dni_nie}</td><td>${f.centro_nombre||'—'}</td>
        <td><strong style="color:${color}">${f.tipo.toUpperCase()}</strong></td>
        <td>${dt.toLocaleDateString('es-ES')}</td>
        <td>${dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</td>
      </tr>`;
    }).join('');
    const html = head + body + '</tbody></table></body></html>';
    const w = window.open('','_blank');
    w.document.write(html); w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  return {
    init, cargarDashboard,
    editarCentroModal, eliminarCentroConfirm,
    editarEmpleadoModal, toggleDia
  };
})();
