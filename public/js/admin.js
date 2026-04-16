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

    // Conectar el botón SIEMPRE, independientemente de si hay centros
    const btnNuevo = document.getElementById('btn-nuevo-centro');
    if (btnNuevo) btnNuevo.onclick = () => modalNuevoCentro();

    if (centros.length === 0) {
      contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏠</div><p>No hay centros creados. Crea el primero.</p></div>';
      return;
    }
    contenedor.innerHTML = centros.map(c => `
      <div class="centro-card">
        <div class="centro-card-icon">⛽</div>
        <div class="centro-card-name">${c.nombre}</div>
        <div class="centro-card-dir">${[c.direccion, c.localidad].filter(Boolean).join(' · ') || 'Sin dirección'}</div>
        ${Object.keys(c.horarios||{}).length > 0 ? `<div class="centro-card-schedule" style="font-size:12px; color:var(--text-dim); margin-top:8px;">🕒 Horario configurado </div>` : `<div style="font-size:12px; color:var(--text-dim); margin-top:8px;">⚠️ Sin horario especificado</div>`}
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

  const getFormCentro = (centro = null) => {
    const diasArray = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
    const h = centro?.horarios || {};
    
    const rowsHorario = diasArray.map(dia => {
      const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
      const info = h[diaKey] || h[dia] || null;
      const activo = !!info;
      return `<div class="horario-dia-row">
        <div class="horario-dia-label">
          <div class="toggle-dia ${activo?'on':''}" data-cdia="${dia}" onclick="const t=this; t.classList.toggle('on'); const act=t.classList.contains('on'); document.getElementById('ch-entrada-${dia}').disabled=!act; document.getElementById('ch-salida-${dia}').disabled=!act;"></div>
          ${diaKey}
        </div>
        <input type="time" class="time-input" id="ch-entrada-${dia}" value="${info?.entrada||'07:00'}" ${!activo?'disabled':''} />
        <input type="time" class="time-input" id="ch-salida-${dia}" value="${info?.salida||'15:00'}" ${!activo?'disabled':''} />
        <span style="font-size:12px;color:var(--text-dim)">${activo?'activo':'cerrado'}</span>
      </div>`;
    }).join('');

    return `
    <div class="modal-tabs">
      <button class="modal-tab active" data-tab-target="tab-c-datos">🏠 Datos del centro</button>
      <button class="modal-tab" data-tab-target="tab-c-horario">🕒 Horario</button>
      ${centro ? `<button class="modal-tab" data-tab-target="tab-c-festivos">🚩 Festivos</button>` : ''}
      ${centro ? `<button class="modal-tab" data-tab-target="tab-c-cuadrante">📅 Cuadrante mensual</button>` : ''}
    </div>
    <div id="tab-c-datos" class="modal-tab-panel active" style="padding-top:15px;">
      <form id="form-centro" class="form">
        <div class="form-group"><label>Nombre del centro *</label>
          <input type="text" id="c-nombre" value="${centro?.nombre||''}" required placeholder="Ej: Gasolinera Repsol Norte" /></div>
        <div class="form-group"><label>Dirección</label>
          <input type="text" id="c-dir" value="${centro?.direccion||''}" placeholder="Calle, número..." /></div>
        <div class="form-group"><label>Localidad</label>
          <input type="text" id="c-loc" value="${centro?.localidad||''}" placeholder="Ciudad o municipio" /></div>
        ${centro ? `<div class="form-group"><label>Estado</label>
          <select id="c-activo" class="select-full">
            <option value="true" ${centro.activo?'selected':''}>Activo</option>
            <option value="false" ${!centro.activo?'selected':''}>Inactivo</option>
          </select></div>` : ''}
      </form>
    </div>
    <div id="tab-c-horario" class="modal-tab-panel" style="padding-top:15px;">
      <div class="horario-editor-title">Define el horario de apertura del centro</div>
      ${rowsHorario}
    </div>
    ${centro ? `
    <div id="tab-c-festivos" class="modal-tab-panel" style="padding-top:15px;">
      <div class="horario-editor-title">Gestionar días festivos del centro</div>
      <div style="background:var(--bg-3); padding:12px; border-radius:8px; margin-bottom:15px;">
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Fecha</label>
            <input type="date" id="fes-fecha" />
          </div>
          <div class="form-group" style="flex:2">
            <label>Nombre del festivo</label>
            <input type="text" id="fes-nombre" placeholder="Ej: Navidad, Fiesta Local..." />
          </div>
        </div>
        <button type="button" class="btn-primary btn-sm" onclick="Admin.añadirFestivoModal()" style="margin-top:10px;">Añadir Festivo</button>
      </div>
      <div id="fes-list-container" class="custom-scrollbar" style="max-height:200px; overflow-y:auto;">
        ${(centro.festivos || []).length === 0 ? '<p style="color:var(--text-dim); text-align:center; font-size:13px; padding:10px;">No hay festivos registrados</p>' : `
        <table style="font-size:13px;">
          <thead><tr><th>Fecha</th><th>Nombre</th><th>Acciones</th></tr></thead>
          <tbody id="fes-tbody">
            ${centro.festivos.sort((a,b) => a.fecha.localeCompare(b.fecha)).map((f, i) => `
              <tr>
                <td>${f.fecha}</td>
                <td>${f.nombre}</td>
                <td style="text-align:right">
                   <button class="btn-icon" onclick="Admin.quitarFestivoModal(${i})" title="Eliminar"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 6l-1 14H6L5 6"></path><circle cx="12" cy="12" r="10"/></svg></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>` : ''}
    ${centro ? `
    <div id="tab-c-cuadrante" class="modal-tab-panel" style="padding-top:15px; margin-bottom: -15px;">
      <div class="horario-editor-title">Vista de cuadrantes de la plantilla del centro</div>
      <div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">
        <select id="cua-mes" class="select-full" style="width:120px;">
          ${MESES.map((m,i) => `<option value="${i+1}" ${i===new Date().getMonth()?'selected':''}>${m}</option>`).join('')}
        </select>
        <select id="cua-anio" class="select-full" style="width:100px;">
          ${[new Date().getFullYear()-1, new Date().getFullYear(), new Date().getFullYear()+1].map(a => `<option value="${a}" ${a===new Date().getFullYear()?'selected':''}>${a}</option>`).join('')}
        </select>
        <button class="btn-primary" type="button" onclick="Admin.cargarCuadranteCentro('${centro.id}')" style="padding: 10px;">Cargar Cuadrante</button>
      </div>
      <div id="cua-container" class="custom-scrollbar" style="overflow-x:auto; background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; min-height:100px; padding-bottom:10px;">
        <div class="empty-state"><p>Selecciona un mes y pulsa Cargar Cuadrante</p></div>
      </div>
    </div>` : ''}`;
  };

  let festivosTemp = [];

  const modalNuevoCentro = (centro = null) => {
    const esEdicion = !!centro;
    festivosTemp = centro?.festivos ? [...centro.festivos] : [];
    App.openModal(
      esEdicion ? 'Editar centro' : 'Nuevo centro de trabajo',
      getFormCentro(centro),
      [
        { text: 'Cancelar', cls: 'btn-outline', action: () => App.closeModal() },
        { text: esEdicion ? 'Guardar cambios' : 'Crear centro', cls: 'btn-primary',
          action: async () => {
            const nombre = document.getElementById('c-nombre').value.trim();
            if (!nombre) { App.showToast('El nombre es obligatorio', 'error'); return; }
            
            const diasArray = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
            const horarios = {};
            diasArray.forEach(dia => {
              const toggle = document.querySelector(`[data-cdia="${dia}"]`);
              if (toggle && toggle.classList.contains('on')) {
                const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
                horarios[diaKey] = {
                  entrada: document.getElementById(`ch-entrada-${dia}`).value || '07:00',
                  salida: document.getElementById(`ch-salida-${dia}`).value || '15:00'
                };
              }
            });

            const payload = {
              nombre,
              direccion: document.getElementById('c-dir').value,
              localidad: document.getElementById('c-loc').value,
              activo: esEdicion ? document.getElementById('c-activo').value === 'true' : true,
              horarios,
              festivos: festivosTemp
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
    setTimeout(initModalTabs, 50);
  };

  const cargarCuadranteCentro = async (centroId) => {
    const mes = document.getElementById('cua-mes').value;
    const anio = document.getElementById('cua-anio').value;
    const contenedor = document.getElementById('cua-container');
    
    contenedor.innerHTML = '<div style="padding: 20px;" class="loading-inline"><div class="spinner"></div></div>';
    
    try {
      const data = await API.getCuadranteCentro(centroId, mes, anio);
      const resFestivos = data.festivos || [];
      const datosGrid = data.cuadrante || [];

      if(datosGrid.length === 0) {
         contenedor.innerHTML = '<div class="empty-state"><p>No hay empleados activos asignados a este centro.</p></div>';
         return;
      }

      const numDias = new Date(anio, mes, 0).getDate();
      const nomDiasShort = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];
      
      let html = `<table style="width:100%; border-collapse:collapse; font-size:11px; text-align:center; min-width:${numDias*36+150}px;">`;
      
      html += `<thead><tr>
         <th style="padding:8px; border:1px solid var(--border-color); border-top:none; border-left:none; text-align:left; background:var(--bg-body); position:sticky; left:0; z-index:2; min-width:140px; box-shadow: 2px 0 5px rgba(0,0,0,0.05);">Empleado</th>`;
      for(let d=1; d<=numDias; d++) {
         const dStr = `${anio}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
         const fesDay = resFestivos.find(f => f.fecha === dStr);
         const ds = new Date(anio, mes-1, d).getDay();
         const color = fesDay ? 'color:var(--white);' : ((ds===0||ds===6) ? 'color:var(--danger-color)' : 'color:var(--text-color)');
         const bg = fesDay ? 'background:var(--red);' : 'background:var(--bg-body);';
         const bStyle = d === numDias ? 'border-right:none;' : '';
         const title = fesDay ? `title="${fesDay.nombre}"` : '';
         html += `<th ${title} style="padding:4px; border:1px solid var(--border-color); ${bStyle} border-top:none; ${bg}"><div style="${color}; font-weight:normal; font-size:10px;">${nomDiasShort[ds]}</div><div style="${color}">${d}</div></th>`;
      }
      html += `</tr></thead><tbody>`;
      
      const fullDiasArray = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];

      datosGrid.forEach((fila, fidx) => {
         const emp = fila.empleado;
         const ultimaFila = fidx === datosGrid.length - 1 ? 'border-bottom:none;' : '';
         html += `<tr><td style="padding:8px; border:1px solid var(--border-color); border-left:none; ${ultimaFila} text-align:left; font-weight:600; position:sticky; left:0; background:var(--bg-card); z-index:1; box-shadow: 2px 0 5px rgba(0,0,0,0.05); color:var(--text-color)">${emp.apellidos}, <span style="font-weight:normal">${emp.nombre}</span></td>`;
         
         for(let d=1; d<=numDias; d++) {
            const dateObj = new Date(Date.UTC(anio, mes-1, d));
            const strDate = dateObj.toISOString().split('T')[0];
            const numDS = dateObj.getUTCDay();
            const diaKey = fullDiasArray[numDS];
            
            const hAplica = fila.horarios.find(s => strDate >= s.fecha_inicio.split('T')[0] && strDate <= s.fecha_fin.split('T')[0]);
            let turAplica = null;
            
            // Prioridad 1: Horario semanal específico
            if (hAplica && hAplica.dias) {
               const k = diaKey === 'miercoles' ? 'miércoles' : diaKey;
               turAplica = hAplica.dias[k] || hAplica.dias[diaKey];
            } 
            // Prioridad 2: Horario fijo (si aplica)
            else if (emp.horario_fijo && emp.horario_fijo_inicio) {
               const inicioFijoStr = emp.horario_fijo_inicio.split('T')[0];
               if (strDate >= inicioFijoStr) {
                  let hFijoSemana = emp.horario_fijo;
                  if (emp.horario_fijo.ciclo && Array.isArray(emp.horario_fijo.semanas)) {
                     const dInicio = new Date(inicioFijoStr);
                     const dHoy = new Date(strDate);
                     const diffMs = dHoy.getTime() - dInicio.getTime();
                     const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                     const semIdx = Math.floor(diffDias / 7) % emp.horario_fijo.ciclo;
                     hFijoSemana = emp.horario_fijo.semanas[semIdx] || {};
                  }
                  const k = diaKey === 'miercoles' ? 'miércoles' : diaKey;
                  turAplica = hFijoSemana[k] || hFijoSemana[diaKey];
               }
            }

            let casillaTxt = '<span style="color:var(--border-color); cursor:default;" title="Libre">L</span>';
            let bg = numDS === 0 || numDS === 6 ? 'background: rgba(0,0,0,0.02);' : '';
            
            // Si es festivo, marcar celda
            const esFes = resFestivos.find(f => f.fecha === strDate);
            if(esFes) bg = 'background:rgba(239,68,68,0.05);';

            if(turAplica) {
               const entradaFull = turAplica.entrada;
               const salidaFull = turAplica.salida;
               const obsIcon = turAplica.observaciones ? `<span style="display:inline-block; width:4px; height:4px; border-radius:50%; background:var(--accent); margin-left:2px; vertical-align:middle;" title="${turAplica.observaciones}"></span>` : '';
               casillaTxt = `<strong style="color:var(--primary-color); cursor:help; font-size:10px;" title="${entradaFull} - ${salidaFull} ${turAplica.observaciones?('· '+turAplica.observaciones):''}">${entradaFull}-${salidaFull}</strong>${obsIcon}`;
               if(!esFes) bg = 'background:rgba(16,185,129,0.08);';
            }
            const bStyle2 = d === numDias ? 'border-right:none;' : '';
            html += `<td style="padding:4px; border:1px solid var(--border-color); ${bStyle2} ${ultimaFila} ${bg}">${casillaTxt}</td>`;
         }
         html += `</tr>`;
      });
      
      html += `</tbody></table>`;
      contenedor.innerHTML = html;
      
    } catch(err) {
      contenedor.innerHTML = `<div class="empty-state"><p>Error al generar el cuadrante: ${err.message}</p></div>`;
    }
  };

  const añadirFestivoModal = () => {
    const fecha = document.getElementById('fes-fecha').value;
    const nombre = document.getElementById('fes-nombre').value.trim();
    if(!fecha || !nombre) {
      App.showToast('Fecha y nombre son obligatorios', 'error');
      return;
    }
    if(festivosTemp.find(f => f.fecha === fecha)) {
      App.showToast('Ya existe un festivo en esa fecha', 'warning');
      return;
    }
    festivosTemp.push({ fecha, nombre });
    renderListaFestivos();
    document.getElementById('fes-fecha').value = '';
    document.getElementById('fes-nombre').value = '';
  };

  const quitarFestivoModal = (index) => {
    festivosTemp.splice(index, 1);
    renderListaFestivos();
  };

  const renderListaFestivos = () => {
    const container = document.getElementById('fes-list-container');
    if(!container) return;
    if(festivosTemp.length === 0) {
      container.innerHTML = '<p style="color:var(--text-dim); text-align:center; font-size:13px; padding:10px;">No hay festivos registrados</p>';
      return;
    }
    festivosTemp.sort((a,b) => a.fecha.localeCompare(b.fecha));
    container.innerHTML = `
      <table style="font-size:13px;">
        <thead><tr><th>Fecha</th><th>Nombre</th><th>Acciones</th></tr></thead>
        <tbody>
          ${festivosTemp.map((f, i) => `
            <tr>
              <td>${f.fecha}</td>
              <td>${f.nombre}</td>
              <td style="text-align:right">
                 <button class="btn-icon" onclick="Admin.quitarFestivoModal(${i})" title="Eliminar"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 6l-1 14H6L5 6"/><circle cx="12" cy="12" r="10"/></svg></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
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

    // Conectar el botón SIEMPRE
    const btnNuevo = document.getElementById('btn-nuevo-empleado');
    if (btnNuevo) btnNuevo.onclick = () => modalNuevoEmpleado();

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

  const getFormEmpleado = (emp = null, contratos = [], licencias = []) => {
    const contratoActivo = contratos.find(c => c.activo) || contratos[0] || null;
    const centrosOpts = centros.map(c =>
      `<option value="${c.id}" ${(emp?.centro_id === c.id || contratoActivo?.centro_id === c.id) ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

    return `
    <div class="modal-tabs">
      <button class="modal-tab active" data-tab-target="tab-personal">👤 Datos personales</button>
      <button class="modal-tab" data-tab-target="tab-contrato">📄 Contrato</button>
      ${emp ? `<button class="modal-tab" data-tab-target="tab-horario-fijo">🕒 Horario Fijo</button>` : ''}
      ${emp ? `<button class="modal-tab" data-tab-target="tab-licencias-admin">⏸️ Permisos</button>` : ''}
    </div>

    <!-- TAB 1: DATOS PERSONALES -->
    <div id="tab-personal" class="modal-tab-panel active">
      <form id="form-empleado" class="form">
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
            <label>Nº Seguridad Social</label>
            <input type="text" id="emp-nss" value="${emp?.nss||''}" placeholder="Ej: 28012345678" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Contraseña ${emp?'(vacío = no cambiar)':'*'}</label>
            <input type="password" id="emp-pwd" placeholder="${emp?'Nueva contraseña (opcional)':'Contraseña inicial'}" ${!emp?'required':''} />
          </div>
          <div class="form-group">
            <label>Móvil</label>
            <input type="tel" id="emp-movil" value="${emp?.movil||''}" placeholder="6XX XXX XXX" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="emp-email" value="${emp?.email||''}" placeholder="correo@ejemplo.com" />
          </div>
          <div class="form-group">
            <label>Centro de trabajo</label>
            <select id="emp-centro" class="select-full">
              <option value="">Sin centro</option>${centrosOpts}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Puesto de trabajo</label>
            <input type="text" id="emp-puesto" value="${emp?.puesto||''}" placeholder="Ej: Expendedor, Encargado..." />
          </div>
          ${emp ? `<div class="form-group">
            <label>Estado</label>
            <select id="emp-activo" class="select-full">
              <option value="true" ${emp.activo?'selected':''}>Activo</option>
              <option value="false" ${!emp.activo?'selected':''}>Inactivo</option>
            </select>
          </div>` : '<div class="form-group"></div>'}
        </div>
      </form>
    </div>

    <!-- TAB 2: CONTRATO -->
    <div id="tab-contrato" class="modal-tab-panel">
      ${emp ? `
      <div style="margin-bottom:20px;">
        <h4 style="font-size: 14px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
          Historial de contratos
          <button type="button" class="btn-primary btn-sm" onclick="Admin.mostrarFormNuevoContrato()">Añadir contrato</button>
        </h4>
        <div class="custom-scrollbar" style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
          ${contratos.length === 0 ? '<p style="padding:15px; color:var(--text-dim); font-size:13px; text-align:center;">No hay contratos registrados.</p>' : `
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="background:var(--bg-3); text-align:left;"><th style="padding:8px">Inicio</th><th style="padding:8px">Tipo</th><th style="padding:8px">Estado</th><th style="padding:8px"></th></tr></thead>
            <tbody>
              ${contratos.map(c => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px">${c.fecha_inicio ? c.fecha_inicio.split('T')[0] : '—'}</td>
                <td style="padding:8px">${c.tipo_contrato || '—'}</td>
                <td style="padding:8px"><span class="badge ${c.activo ? 'badge-green' : 'badge-red'}" style="font-size:10px">${c.activo ? 'ACTIVO' : 'HISTÓRICO'}</span></td>
                <td style="padding:8px; text-align:right;">
                  <button type="button" class="btn-icon" onclick="Admin.eliminarContratoModal('${c.id}', '${emp.id}')" title="Eliminar registro"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4h6v2"></path></svg></button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>`}
        </div>
      </div>` : ''}

      <div id="form-nuevo-contrato-container" style="${emp ? 'display:none; border-top: 1px solid var(--border); padding-top:15px;' : ''}">
        <h4 style="margin-bottom: 15px; font-size: 14px;">${emp ? 'Detalles del nuevo contrato' : 'Datos del contrato'}</h4>
        <form id="form-contrato" class="form">
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de contrato</label>
              <select id="ct-tipo" class="select-full">
                <option value="">Seleccionar...</option>
                <option value="Indefinido">Indefinido</option>
                <option value="Temporal">Temporal</option>
                <option value="Temporal por obra">Temporal por obra</option>
                <option value="Prácticas">Prácticas</option>
                <option value="Formación">Formación</option>
                <option value="Relevo">Relevo</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div class="form-group">
              <label>Centro (contrato)</label>
              <select id="ct-centro" class="select-full">
                <option value="">Sin asignar</option>${centrosOpts}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Categoría profesional</label>
              <input type="text" id="ct-categoria" placeholder="Ej: Técnico Nivel II" />
            </div>
            <div class="form-group">
              <label>Convenio colectivo</label>
              <input type="text" id="ct-convenio" placeholder="Ej: Convenio estaciones de servicio" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de jornada</label>
              <select id="ct-jornada" class="select-full">
                <option value="">Seleccionar...</option>
                <option value="Completa">Completa</option>
                <option value="Parcial">Parcial</option>
                <option value="Reducida">Reducida</option>
                <option value="Nocturna">Nocturna</option>
                <option value="Turnos">Turnos</option>
              </select>
            </div>
            <div class="form-group">
              <label>Horas semanales</label>
              <input type="number" id="ct-horas" placeholder="Ej: 40" min="1" max="60" step="0.5" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Fecha de inicio</label>
              <input type="date" id="ct-inicio" />
            </div>
            <div class="form-group">
              <label>Fecha de fin <span style="color:var(--text-dim);font-weight:400">(vacío = indefinido)</span></label>
              <input type="date" id="ct-fin" />
            </div>
          </div>
          ${emp ? `
          <div style="text-align:right; margin-top:10px;">
            <button type="button" class="btn-outline btn-sm" onclick="Admin.ocultarFormNuevoContrato()">Cancelar</button>
            <button type="button" class="btn-primary btn-sm" onclick="Admin.guardarNuevoContrato('${emp.id}')">Guardar Contrato</button>
          </div>` : ''}
        </form>
      </div>
    </div>
    
    <!-- TAB 3: HORARIO FIJO -->
    ${emp ? `
    <div id="tab-horario-fijo" class="modal-tab-panel">
      <div id="hf-editor-employee-container">
        ${getHFEditorHTML(emp.horario_fijo, emp.horario_fijo_inicio)}
      </div>
    </div>` : ''}
    </div>` : ''}
    
    <!-- TAB 4: LICENCIAS Y PERMISOS -->
    ${emp ? `
    <div id="tab-licencias-admin" class="modal-tab-panel">
      <div style="margin-bottom:15px; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 8px;">
        <h4 style="margin-bottom: 10px; font-size: 14px;">Añadir licencia o permiso</h4>
        <div class="form-row">
          <div class="form-group">
             <label>Causa</label>
             <select id="lic-causa" class="select-full">
               <option value="Incapacidad temporal">Incapacidad temporal</option>
               <option value="Permiso compensación horas">Permiso compensación horas</option>
               <option value="Permiso retribuido recuperable">Permiso retribuido recuperable</option>
               <option value="Vacaciones">Vacaciones</option>
             </select>
          </div>
          <div class="form-group">
            <label>Año</label>
            <input type="number" id="lic-anio" value="${new Date().getFullYear()}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Inicio</label><input type="date" id="lic-inicio" /></div>
          <div class="form-group"><label>Fin</label><input type="date" id="lic-fin" /></div>
        </div>
        <button type="button" class="btn-primary btn-sm" onclick="Admin.guardarLicenciaModal('${emp.id}')">Añadir Licencia</button>
      </div>
      <div>
        <h4 style="font-size: 14px; margin-bottom: 10px;">Licencias registradas</h4>
        ${licencias.length === 0 ? '<p style="color:var(--text-dim);font-size:13px">No hay licencias registradas para este empleado.</p>' : 
        `<table style="font-size:12px;">
          <thead><tr><th>Año</th><th>Causa</th><th>Fechas</th><th></th></tr></thead>
          <tbody>
            ${licencias.map(l => `<tr>
              <td>${l.anio}</td><td>${l.causa}</td>
              <td class="td-muted">${l.fecha_inicio.split('T')[0]} a ${l.fecha_fin.split('T')[0]}</td>
              <td style="text-align: right;"><button type="button" class="btn-icon" onclick="Admin.eliminarLicenciaModal('${l.id}', '${emp.id}')" title="Eliminar licencia"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4h6v2"></path></svg></button></td>
            </tr>`).join('')}
          </tbody>
        </table>`
        }
      </div>
    </div>` : ''}
    `;
  };

  // Leer los datos del formulario de empleado
  const leerDatosEmpleado = (esEdicion) => {
    const horario_fijo = {};
    ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'].forEach(dia => {
      const toggle = document.querySelector(`[data-hfdia="${dia}"]`);
      if (toggle && toggle.classList.contains('on')) {
        const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
        horario_fijo[diaKey] = {
          entrada: document.getElementById(`hf-entrada-${dia}`).value || '07:00',
          salida: document.getElementById(`hf-salida-${dia}`).value || '15:00'
        };
      }
    });

    const hfData = leerDatosHFEditor();
    
    return {
      nombre: document.getElementById('emp-nombre').value.trim(),
      apellidos: document.getElementById('emp-apellidos').value.trim(),
      dni_nie: document.getElementById('emp-dni-nie').value.trim(),
      password: document.getElementById('emp-pwd').value,
      movil: document.getElementById('emp-movil').value.trim(),
      email: document.getElementById('emp-email').value.trim(),
      centro_id: document.getElementById('emp-centro').value || null,
      puesto: document.getElementById('emp-puesto').value.trim(),
      nss: document.getElementById('emp-nss').value.trim(),
      horario_fijo: hfData.horario_fijo,
      horario_fijo_inicio: hfData.horario_fijo_inicio,
      ...(esEdicion ? { activo: document.getElementById('emp-activo').value === 'true' } : {})
    };
  };

  const leerDatosContrato = (empleadoId) => ({
    empleado_id: empleadoId,
    centro_id: document.getElementById('ct-centro').value || null,
    categoria_profesional: document.getElementById('ct-categoria').value.trim(),
    convenio: document.getElementById('ct-convenio').value.trim(),
    tipo_contrato: document.getElementById('ct-tipo').value,
    tipo_jornada: document.getElementById('ct-jornada').value,
    horas_semanales: document.getElementById('ct-horas').value || null,
    fecha_inicio: document.getElementById('ct-inicio').value || null,
    fecha_fin: document.getElementById('ct-fin').value || null
  });

  const initModalTabs = () => {
    document.querySelectorAll('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tabTarget).classList.add('active');
      });
    });
  };

  const modalNuevoEmpleado = () => {
    App.openModal('Nuevo empleado', getFormEmpleado(), [
      { text: 'Cancelar', cls: 'btn-outline', action: () => App.closeModal() },
      { text: 'Crear empleado', cls: 'btn-primary', action: async () => {
        const payload = leerDatosEmpleado(false);
        if (!payload.nombre || !payload.apellidos || !payload.dni_nie || !payload.password) {
          App.showToast('Rellena nombre, apellidos, DNI y contraseña', 'error'); return;
        }
        try {
          const nuevoEmp = await API.crearEmpleado(payload);
          // Guardar contrato si se han rellenado datos
          const ct = leerDatosContrato(nuevoEmp.id);
          if (ct.tipo_contrato || ct.fecha_inicio || ct.categoria_profesional) {
            await API.guardarContrato(ct).catch(() => {});
          }
          App.closeModal();
          App.showToast('Empleado creado correctamente', 'success');
          await cargarEmpleados();
        } catch (e) { App.showToast(e.message, 'error'); }
      }}
    ]);
    setTimeout(initModalTabs, 50);
  };

  const editarEmpleadoModal = async (id, tabActiva = 'tab-personal') => {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;
    // Cargar contrato y licencias existente en paralelo
    let contratos = [];
    let licencias = [];
    try { 
      const res = await Promise.all([
        API.getContrato(id).catch(() => []),
        API.getLicencias(id).catch(() => [])
      ]);
      contratos = Array.isArray(res[0]) ? res[0] : (res[0] ? [res[0]] : []);
      licencias = res[1] || [];
    } catch (_) {}
    App.openModal('Editar empleado', getFormEmpleado(emp, contratos, licencias), [
      { text: 'Cancelar', cls: 'btn-outline', action: () => App.closeModal() },
      { text: 'Guardar cambios', cls: 'btn-primary', action: async () => {
        const payload = leerDatosEmpleado(true);
        const pwd = document.getElementById('emp-pwd').value;
        if (pwd) payload.password = pwd;
        try {
          await API.editarEmpleado(id, payload);
          const ct = leerDatosContrato(id);
          await API.guardarContrato(ct).catch(() => {});
          App.closeModal();
          App.showToast('Empleado actualizado correctamente', 'success');
          await cargarEmpleados();
        } catch (e) { App.showToast(e.message, 'error'); }
      }}
    ]);
    setTimeout(() => {
      initModalTabs();
      if (emp) {
        bindHFEditorEvents(emp.horario_fijo);
        // Ajustar IDs para que leerDatosHFEditor funcione con los IDs estándar que usa el modal HF
        // pero que en este caso están dentro del modal de empleado
        const inicioEl = document.getElementById('hf-modal-inicio');
        if (!inicioEl) {
           // Si no se encuentran los IDs de hf-modal-* es que estamos usando los nombres genéricos
           // pero leerDatosHFEditor espera hf-modal-inicio/ciclo.
           // getHFEditorHTML ya usa hf-modal-* por defecto.
        }
      }
      if (tabActiva !== 'tab-personal') {
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.remove('active'));
        const targetTabBtn = document.querySelector(`[data-tab-target="${tabActiva}"]`);
        const targetPanel = document.getElementById(tabActiva);
        if (targetTabBtn && targetPanel) {
          targetTabBtn.classList.add('active');
          targetPanel.classList.add('active');
        }
      }
    }, 50);
  };

  const guardarLicenciaModal = async (empleadoId) => {
    const causa = document.getElementById('lic-causa').value;
    const anio = document.getElementById('lic-anio').value;
    const inicio = document.getElementById('lic-inicio').value;
    const fin = document.getElementById('lic-fin').value;

    if (!causa || !anio || !inicio || !fin) {
      App.showToast('Rellena todos los campos de la licencia', 'error');
      return;
    }
    try {
      await API.crearLicencia({
        empleado_id: empleadoId,
        anio: parseInt(anio),
        causa,
        fecha_inicio: inicio,
        fecha_fin: fin
      });
      App.showToast('Licencia añadida', 'success');
      editarEmpleadoModal(empleadoId, 'tab-licencias-admin');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  };

  const eliminarLicenciaModal = async (id, empleadoId) => {
    if(!confirm("¿Seguro que deseas eliminar esta licencia?")) return;
    try {
      await API.eliminarLicencia(id);
      App.showToast('Licencia eliminada', 'success');
      editarEmpleadoModal(empleadoId, 'tab-licencias-admin');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  };

  // FUNCIONES DE GESTIÓN DE CONTRATOS
  const mostrarFormNuevoContrato = () => {
    document.getElementById('form-nuevo-contrato-container').style.display = 'block';
    document.getElementById('form-contrato').reset();
  };

  const ocultarFormNuevoContrato = () => {
    document.getElementById('form-nuevo-contrato-container').style.display = 'none';
  };

  const guardarNuevoContrato = async (empleadoId) => {
    const ct = leerDatosContrato(empleadoId);
    if (!ct.tipo_contrato || !ct.fecha_inicio) {
      App.showToast('El tipo de contrato y la fecha de inicio son obligatorios', 'error');
      return;
    }
    try {
      await API.guardarContrato(ct);
      App.showToast('Contrato guardado correctamente', 'success');
      editarEmpleadoModal(empleadoId, 'tab-contrato');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
  };

  const eliminarContratoModal = async (id, empleadoId) => {
    if(!confirm("¿Seguro que deseas eliminar este registro de contrato?")) return;
    try {
      await API.eliminarContrato(id);
      App.showToast('Contrato eliminado', 'success');
      editarEmpleadoModal(empleadoId, 'tab-contrato');
    } catch (e) {
      App.showToast(e.message, 'error');
    }
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
  let horariosCargados = [];
  let semanasActuales = [];
  let semanaSeleccionada = null;

  const obtenerSemanasMes = (mes, anio) => {
    const semanas = [];
    let fecha = new Date(anio, mes - 1, 1);
    let diaSemana = fecha.getDay() || 7;
    fecha.setDate(fecha.getDate() - (diaSemana - 1));
    
    while (true) {
      let inicio = new Date(fecha);
      let fin = new Date(fecha);
      fin.setDate(fin.getDate() + 6);
      
      if (inicio.getMonth() > (mes-1) && inicio.getFullYear() >= anio) break;
      if (inicio.getFullYear() > anio) break;
      if (inicio.getMonth() !== (mes-1) && fin.getMonth() !== (mes-1)) {
          if(inicio.getTime() > new Date(anio, mes-1, 28).getTime()) break;
      }

      semanas.push({
        inicioStr: inicio.toISOString().split('T')[0],
        finStr: fin.toISOString().split('T')[0],
        label: `Del ${inicio.getDate()} ${MESES[inicio.getMonth()].substring(0,3)} al ${fin.getDate()} ${MESES[fin.getMonth()].substring(0,3)}`
      });
      fecha.setDate(fecha.getDate() + 7);
    }
    return semanas;
  };

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
    document.getElementById('btn-admin-configurer-hf')?.addEventListener('click', () => {
      const empId = document.getElementById('horario-empleado-sel').value;
      if (!empId) { App.showToast('Selecciona un empleado primero', 'warning'); return; }
      abrirModalHorarioFijo(empId);
    });
  };

  const cargarHorarioEditor = async () => {
    const empId = document.getElementById('horario-empleado-sel').value;
    const mes = parseInt(document.getElementById('horario-mes-sel').value);
    const anio = parseInt(document.getElementById('horario-anio-sel').value);
    if (!empId) { App.showToast('Selecciona un empleado', 'error'); return; }

    try {
      horariosCargados = await API.getHorarioAdmin(empId, mes, anio);
      semanasActuales = obtenerSemanasMes(mes, anio);
      
      renderSelectorSemanas();
      document.getElementById('horario-editor').classList.remove('hidden');
      document.getElementById('horario-actions').classList.add('hidden');
    } catch (e) { App.showToast(e.message, 'error'); }
  };

  const renderSelectorSemanas = () => {
    let html = '<div class="horario-editor-title" style="margin-bottom:10px;">Selecciona la semana a configurar:</div><div class="semanas-grid" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom: 20px;">';
    semanasActuales.forEach((sem, idx) => {
       const hor = horariosCargados.find(h => h.fecha_inicio.split('T')[0] === sem.inicioStr && h.fecha_fin.split('T')[0] === sem.finStr);
       const colorBadje = hor ? '#10b981' : '#ef4444';
       const textoBadge = hor ? '✔ Configurada' : '✖ Sin asignar';
       html += `<button class="btn-outline btn-semana" data-idx="${idx}" onclick="Admin.seleccionarSemana(${idx})" style="text-align:left; padding:8px 12px; height:auto; display:flex; flex-direction:column; align-items:flex-start;">
          <strong>${sem.label}</strong>
          <span style="color:${colorBadje};font-size:11px;margin-top:2px;">${textoBadge}</span>
       </button>`;
    });
    html += '</div>';
    
    let contenedorSelector = document.getElementById('horario-semanas-container');
    if(!contenedorSelector) {
        document.getElementById('horario-editor').insertAdjacentHTML('beforebegin', '<div id="horario-semanas-container"></div>');
        contenedorSelector = document.getElementById('horario-semanas-container');
    }
    contenedorSelector.innerHTML = html;
    document.getElementById('horario-editor').innerHTML = ''; // Limpiar hasta que se escoja semana
  };

  const seleccionarSemana = (idx) => {
     semanaSeleccionada = semanasActuales[idx];
     document.querySelectorAll('.btn-semana').forEach(b => {
         b.style.borderColor = 'var(--border-color)';
         b.style.backgroundColor = 'transparent';
     });
     const btnActivo = document.querySelector(`.btn-semana[data-idx="${idx}"]`);
     btnActivo.style.borderColor = 'var(--primary-color)';
     btnActivo.style.backgroundColor = 'rgba(245,158,11,0.05)';

     const hor = horariosCargados.find(h => h.fecha_inicio.split('T')[0] === semanaSeleccionada.inicioStr && h.fecha_fin.split('T')[0] === semanaSeleccionada.finStr);
     horarioActual = hor ? hor.dias : {};
     renderHorarioEditor();
     document.getElementById('horario-actions').classList.remove('hidden');
  };

  const renderHorarioEditor = () => {
    const contenedor = document.getElementById('horario-editor');
    contenedor.innerHTML = `<div class="horario-editor-title">Define los días del ${semanaSeleccionada.label}</div>` +
      DIAS.map(dia => {
        const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
        const info = horarioActual[diaKey] || horarioActual[dia] || null;
        const activo = !!info;
        return `<div class="horario-dia-row" id="row-${dia}">
          <div class="horario-dia-label">
            <div class="toggle-dia ${activo?'on':''}" data-dia="${dia}" onclick="Admin.toggleDia('${dia}')"></div>
            <span>${diaKey}</span>
          </div>
          <input type="time" class="time-input" id="h-entrada-${dia}" value="${info?.entrada||'07:00'}" ${!activo?'disabled':''} />
          <input type="time" class="time-input" id="h-salida-${dia}" value="${info?.salida||'15:00'}" ${!activo?'disabled':''} />
          <input type="text" class="obs-input" id="h-obs-${dia}" placeholder="Observaciones..." value="${info?.observaciones||''}" ${!activo?'disabled':''} />
          <span style="font-size:12px;color:var(--text-dim)">${activo?'activo':'libre'}</span>
        </div>`;
      }).join('');
  };

  const toggleDia = (dia) => {
    const toggle = document.querySelector(`[data-dia="${dia}"]`);
    const eActivo = toggle.classList.toggle('on');
    document.getElementById(`h-entrada-${dia}`).disabled = !eActivo;
    document.getElementById(`h-salida-${dia}`).disabled = !eActivo;
    document.getElementById(`h-obs-${dia}`).disabled = !eActivo;
  };

  const guardarHorario = async () => {
    if(!semanaSeleccionada) return;
    const empId = document.getElementById('horario-empleado-sel').value;

    const dias = {};
    DIAS.forEach(dia => {
      const toggle = document.querySelector(`[data-dia="${dia}"]`);
      if (toggle && toggle.classList.contains('on')) {
        const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
        dias[diaKey] = {
          entrada: document.getElementById(`h-entrada-${dia}`)?.value || '07:00',
          salida: document.getElementById(`h-salida-${dia}`)?.value || '15:00',
          observaciones: document.getElementById(`h-obs-${dia}`)?.value.trim() || ''
        };
      }
    });

    try {
      await API.guardarHorario({ 
        empleado_id: empId, 
        fecha_inicio: semanaSeleccionada.inicioStr, 
        fecha_fin: semanaSeleccionada.finStr, 
        dias 
      });
      App.showToast('Horario semanal guardado correctamente', 'success');
      cargarHorarioEditor(); // Recargar semanas
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

      // Calcular total extra
      const totalExtra = fichajesData.reduce((acc, f) => acc + (f.minutos_extra || 0), 0);
      const extraHeader = totalExtra > 0 ? `<div style="margin-bottom:15px; padding:12px; background:var(--orange-light); border-radius:10px; border:1px solid rgba(249,115,22,0.2); display:inline-block;">
        <span style="color:var(--orange); font-weight:700; font-size:13px;">TIEMPO EXTRA TOTAL: </span>
        <strong style="color:var(--orange); font-size:16px;">${Math.floor(totalExtra/60)}h ${totalExtra%60}min</strong>
      </div>` : '';

      if (fichajesData.length === 0) {
        contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>No hay fichajes con esos filtros</p></div>';
        return;
      }
      contenedor.innerHTML = extraHeader + `<table>
        <thead><tr>
          <th>Empleado</th><th>DNI/NIE</th><th>Centro</th><th>Tipo</th>
          <th>Extra</th><th>Fecha</th><th>Hora</th>
        </tr></thead>
        <tbody>
          ${fichajesData.map(f => {
            const dt = new Date(f.timestamp);
            const extraTag = f.minutos_extra > 0 ? `<span class="badge badge-extra">+${f.minutos_extra} min</span>` : '—';
            return `<tr>
              <td><strong>${f.apellidos}, ${f.nombre}</strong><br/><span class="td-muted" style="font-size:12px">${f.puesto||''}</span></td>
              <td class="td-muted">${f.dni_nie}</td>
              <td class="td-muted">${f.centro_nombre||'—'}</td>
              <td><span class="badge ${f.tipo==='entrada'?'badge-green':'badge-red'}">${f.tipo.toUpperCase()}</span></td>
              <td>${extraTag}</td>
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
    const headers = ['Empleado','DNI/NIE','Centro','Puesto','Tipo','Extra (min)','Fecha','Hora'];
    const rows = fichajesData.map(f => {
      const dt = new Date(f.timestamp);
      return [
        `${f.apellidos}, ${f.nombre}`,
        f.dni_nie, f.centro_nombre||'', f.puesto||'', f.tipo.toUpperCase(),
        f.minutos_extra || 0,
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
      <th>Empleado</th><th>DNI/NIE</th><th>Centro</th><th>Tipo</th><th>Extra</th><th>Fecha</th><th>Hora</th>
    </tr></thead><tbody>`;
    const body = fichajesData.map(f => {
      const dt = new Date(f.timestamp);
      const color = f.tipo === 'entrada' ? '#10b981' : '#ef4444';
      const extraTxt = f.minutos_extra > 0 ? `+${f.minutos_extra} min` : '—';
      return `<tr>
        <td>${f.apellidos}, ${f.nombre}</td>
        <td>${f.dni_nie}</td><td>${f.centro_nombre||'—'}</td>
        <td><strong style="color:${color}">${f.tipo.toUpperCase()}</strong></td>
        <td>${extraTxt}</td>
        <td>${dt.toLocaleDateString('es-ES')}</td>
        <td>${dt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</td>
      </tr>`;
    }).join('');
    const html = head + body + '</tbody></table></body></html>';
    const w = window.open('','_blank');
    w.document.write(html); w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  // ============================================================
  // GESTIÓN DE HORARIO FIJO (REUTILIZABLE)
  // ============================================================
  const abrirModalHorarioFijo = async (empleadoId) => {
    try {
      const emp = await API.getEmpleado(empleadoId);
      App.openModal(`Horario Fijo: ${emp.nombre} ${emp.apellidos}`, `
        <div id="hf-modal-container">
           ${getHFEditorHTML(emp.horario_fijo, emp.horario_fijo_inicio)}
        </div>
      `, [
        { text: 'Cancelar', cls: 'btn-outline', action: () => App.closeModal() },
        { text: 'Guardar Horario Fijo', cls: 'btn-primary', action: async () => {
             const payload = leerDatosHFEditor();
             try {
               await API.editarEmpleado(empleadoId, {
                 nombre: emp.nombre,
                 apellidos: emp.apellidos,
                 horario_fijo: payload.horario_fijo,
                 horario_fijo_inicio: payload.horario_fijo_inicio,
                 activo: emp.activo
               });
               App.showToast('Horario fijo actualizado', 'success');
               App.closeModal();
               // Si estamos en la vista de horarios, podríamos querer refrescar algo
               if (document.getElementById('admin-horarios').classList.contains('active')) {
                  // Opcional: recargar algo aquí
               }
               // Actualizar la lista local de empleados
               await cargarEmpleados();
             } catch(e) { App.showToast(e.message, 'error'); }
          }
        }
      ]);
      bindHFEditorEvents(emp.horario_fijo);
    } catch(e) { App.showToast(e.message, 'error'); }
  };

  const getHFEditorHTML = (hf, inicio) => {
    // Normalizar hf si es antiguo o nulo
    let ciclo = 1;
    let semanas = [{}];
    if (hf && hf.ciclo && Array.isArray(hf.semanas)) {
      ciclo = hf.ciclo;
      semanas = hf.semanas;
    } else if (hf) {
      semanas = [hf];
    }

    const inicioVal = inicio ? inicio.split('T')[0] : '';
    
    let html = `
      <div class="horario-editor-title">Configura el horario base que se aplicará cíclicamente</div>
      <div style="background:var(--bg-3); padding:15px; border-radius:10px; margin-bottom:20px; border:1px solid var(--border-color);">
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Fecha de activación</label>
            <input type="date" id="hf-modal-inicio" value="${inicioVal}" />
          </div>
          <div class="form-group" style="flex:1">
            <label>Ciclo (semanas)</label>
            <select id="hf-modal-ciclo" class="select-full">
              ${[1,2,3,4].map(n => `<option value="${n}" ${n===ciclo?'selected':''}>${n} ${n===1?'semana':'semanas'}</option>`).join('')}
            </select>
          </div>
        </div>
        <p style="font-size:11px; color:var(--text-dim); margin-top:8px;">
          El ciclo rotará cada 7 días a partir de la fecha de activación.
        </p>
      </div>
      
      <div class="modal-tabs" id="hf-semanas-tabs" style="${ciclo <= 1 ? 'display:none' : ''}">
        ${[1,2,3,4].map(n => `
          <button class="modal-tab ${n===1?'active':''}" data-hf-tab="${n}" style="${n > ciclo ? 'display:none' : ''}">Semana ${n}</button>
        `).join('')}
      </div>

      <div id="hf-semanas-containers">
        ${[1,2,3,4].map(n => `
          <div id="hf-semana-panel-${n}" class="modal-tab-panel hf-semana-panel ${n===1?'active':''}" style="${n > ciclo ? 'display:none' : ''}">
            ${DIAS.map(dia => {
              const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
              const semData = semanas[n-1] || {};
              const info = semData[diaKey] || semData[dia] || null;
              const activo = !!info;
              return `
                <div class="horario-dia-row">
                  <div class="horario-dia-label">
                    <div class="toggle-dia ${activo ? 'on' : ''}" data-hf-dia-toggle="${dia}" data-semana="${n}"></div>
                    <span>${diaKey}</span>
                  </div>
                  <input type="time" class="time-input" data-hf-entrada="${dia}" data-semana="${n}" value="${info?.entrada || '07:00'}" ${!activo ? 'disabled' : ''} />
                  <input type="time" class="time-input" data-hf-salida="${dia}" data-semana="${n}" value="${info?.salida || '15:00'}" ${!activo ? 'disabled' : ''} />
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
    return html;
  };

  const bindHFEditorEvents = (hfOriginal) => {
    const selCiclo = document.getElementById('hf-modal-ciclo');
    const tabsContainer = document.getElementById('hf-semanas-tabs');
    
    selCiclo.addEventListener('change', (e) => {
      const n = parseInt(e.target.value);
      tabsContainer.style.display = n > 1 ? 'flex' : 'none';
      
      // Mostrar/ocultar botones de tab
      document.querySelectorAll('[data-hf-tab]').forEach(btn => {
        const tNum = parseInt(btn.dataset.hfTab);
        btn.style.display = tNum <= n ? 'block' : 'none';
      });
      
      // Mostrar/ocultar paneles
      document.querySelectorAll('.hf-semana-panel').forEach(panel => {
        const pNum = parseInt(panel.id.split('-').pop());
        if (pNum > n) panel.classList.remove('active');
        // Si el panel activo desaparece, activar el 1
        if (pNum === 1 && !document.querySelector('.hf-semana-panel.active')) {
           panel.classList.add('active');
           document.querySelector('[data-hf-tab="1"]').classList.add('active');
        }
      });
    });

    // Eventos de tabs
    document.querySelectorAll('[data-hf-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = btn.dataset.hfTab;
        document.querySelectorAll('[data-hf-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.hf-semana-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`hf-semana-panel-${n}`).classList.add('active');
      });
    });

    // Eventos de toggle
    document.querySelectorAll('[data-hf-dia-toggle]').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const dia = toggle.dataset.hfDiaToggle;
        const sem = toggle.dataset.semana;
        const isOff = toggle.classList.toggle('on');
        document.querySelector(`[data-hf-entrada="${dia}"][data-semana="${sem}"]`).disabled = !isOff;
        document.querySelector(`[data-hf-salida="${dia}"][data-semana="${sem}"]`).disabled = !isOff;
      });
    });
  };

  const leerDatosHFEditor = () => {
    const ciclo = parseInt(document.getElementById('hf-modal-ciclo').value);
    const semanas = [];
    
    for (let n = 1; n <= ciclo; n++) {
      const diasSemana = {};
      DIAS.forEach(dia => {
        const toggle = document.querySelector(`[data-hf-dia-toggle="${dia}"][data-semana="${n}"]`);
        if (toggle && toggle.classList.contains('on')) {
          const diaKey = dia === 'miercoles' ? 'miércoles' : dia;
          diasSemana[diaKey] = {
            entrada: document.querySelector(`[data-hf-entrada="${dia}"][data-semana="${n}"]`).value || '07:00',
            salida: document.querySelector(`[data-hf-salida="${dia}"][data-semana="${n}"]`).value || '15:00'
          };
        }
      });
      semanas.push(diasSemana);
    }

    return {
      horario_fijo: { ciclo, semanas },
      horario_fijo_inicio: document.getElementById('hf-modal-inicio').value || null
    };
  };

  return {
    init, cargarDashboard,
    editarCentroModal, eliminarCentroConfirm, cargarCuadranteCentro,
    editarEmpleadoModal, toggleDia, seleccionarSemana,
    guardarLicenciaModal, eliminarLicenciaModal,
    mostrarFormNuevoContrato, ocultarFormNuevoContrato, guardarNuevoContrato, eliminarContratoModal,
    añadirFestivoModal, quitarFestivoModal,
    abrirModalHorarioFijo
  };
})();
