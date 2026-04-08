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
      App.openModal('Aviso sobre tu fichaje', `<p style="text-align:center; padding: 10px;">${e.message}</p>`, [
        { text: 'Entendido', cls: 'btn-primary', action: () => App.closeModal() }
      ]);
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
  const cargarHorario = async (mes = new Date().getMonth() + 1, anio = new Date().getFullYear()) => {
    const contenedor = document.getElementById('horario-display');
    contenedor.innerHTML = '<div class="loading-inline"><div class="spinner"></div></div>';

    try {
      // Pedir todas las semanas que tocan en este mes
      const dataSemanas = await API.getHorario(mes, anio);
      
      const primerDia = new Date(anio, mes - 1, 1);
      const ultimoDia = new Date(anio, mes, 0); 
      const numDias = ultimoDia.getDate();
      
      let offset = primerDia.getDay() || 7; 
      offset -= 1; 
      
      let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:0 5px;">
        <h4 style="margin:0; font-size:16px;">${MESES_ES[mes - 1]} ${anio}</h4>
        <div>
          <button class="btn-icon" onclick="Empleado.cambiarMesHorario(-1, ${mes}, ${anio})" style="background:var(--bg-body); border-radius:4px; padding:5px;">◀</button>
          <button class="btn-icon" onclick="Empleado.cambiarMesHorario(1, ${mes}, ${anio})" style="background:var(--bg-body); border-radius:4px; padding:5px; margin-left:5px;">▶</button>
        </div>
      </div>`;

      html += `<div style="display:grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align:center;">`;
      const cabeceras = ['L','M','X','J','V','S','D'];
      cabeceras.forEach(c => html += `<div style="font-weight:bold; color:var(--text-dim); font-size:12px; margin-bottom:4px;">${c}</div>`);
      
      for(let i = 0; i < offset; i++) {
         html += `<div></div>`;
      }
      
      const nomDias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
      
      const hoyStr = new Date();
      // Ajuste timezone manual para String sin desfase de hora, usamos util local
      const offsetHoy = hoyStr.getTimezoneOffset() * 60000;
      const localHoy = (new Date(hoyStr - offsetHoy)).toISOString().split('T')[0];

      for(let d = 1; d <= numDias; d++) {
         const dActual = new Date(Date.UTC(anio, mes - 1, d)); // Usar UTC para evitar baile por daylight savings
         const numDiaSem = dActual.getUTCDay();
         const keyDiaSem = nomDias[numDiaSem];
         
         const strDate = dActual.toISOString().split('T')[0]; 
         
         const semAplica = Array.isArray(dataSemanas) ? dataSemanas.find(s => {
            return strDate >= s.fecha_inicio.split('T')[0] && strDate <= s.fecha_fin.split('T')[0];
         }) : null;
         
         let contenidoHoras = `<span style="color:var(--text-dim)">Libre</span>`;
         let bgColor = 'var(--bg-card)';
         
         if(semAplica && semAplica.dias) {
             const keyReal = keyDiaSem === 'miercoles' ? 'miércoles' : keyDiaSem;
             const h = semAplica.dias[keyReal] || semAplica.dias[keyDiaSem] || null;
             if(h) {
                 contenidoHoras = `<b style="color:var(--primary-color); font-size:11px">${h.entrada}</b><br><b style="color:var(--text-color); font-size:11px">${h.salida}</b>`;
                 bgColor = 'var(--bg-body)';
             }
         }

         const isHoy = strDate === localHoy;
         const bordeActivo = isHoy ? `border: 2px solid var(--primary-color);` : `border: 1px solid var(--border-color);`;

         html += `<div style="position:relative; background:${bgColor}; border-radius:6px; ${bordeActivo} padding:20px 2px 5px 2px; min-height:65px; display:flex; align-items:center; justify-content:center; flex-direction:column; font-size:11px;">
             <div style="position:absolute; top:2px; right:4px; font-size:11px; font-weight:bold; color:var(--text-dim)">${d}</div>
             ${contenidoHoras}
         </div>`;
      }
      
      html += `</div>`;
      contenedor.innerHTML = html;

    } catch (e) {
      contenedor.innerHTML = `<div class="empty-state"><p>Error al cargar el calendario mensual. Inténtalo de nuevo más tarde.</p></div>`;
    }
  };

  const cambiarMesHorario = (delta, mesActual, anioActual) => {
     let m = mesActual + delta;
     let a = anioActual;
     if(m > 12) { m = 1; a++; }
     if(m < 1) { m = 12; a--; }
     cargarHorario(m, a);
  };

  // Cargar licencias del empleado
  const cargarLicencias = async () => {
    const contenedor = document.getElementById('licencias-list');
    contenedor.innerHTML = '<div class="loading-inline"><div class="spinner"></div></div>';

    try {
      const data = await API.getLicenciasEmpleado();
      if (!data || data.length === 0) {
        contenedor.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏖️</div><p>No tienes licencias o vacaciones registradas</p></div>';
        return;
      }

      const ahora = new Date();
      ahora.setHours(0, 0, 0, 0);

      const html = data.map(lic => {
        const inicio = new Date(lic.fecha_inicio);
        const fin = new Date(lic.fecha_fin);
        inicio.setHours(0, 0, 0, 0);
        fin.setHours(0, 0, 0, 0);

        let estadoClass = '';
        let estadoTxt = '';

        if (ahora > fin) {
          estadoClass = 'past';
          estadoTxt = 'Pasada';
        } else if (ahora >= inicio && ahora <= fin) {
          estadoClass = 'active';
          estadoTxt = 'Activa ahora';
        } else {
          estadoClass = 'future';
          estadoTxt = 'Próxima';
        }

        const fInicioStr = inicio.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const fFinStr = fin.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

        return `
          <div class="licencia-card-emp ${estadoClass}">
            <div class="lic-info">
              <span class="lic-causa">${lic.causa}</span>
              <span class="lic-fechas">${fInicioStr} — ${fFinStr}</span>
            </div>
            <div class="lic-status-badge">${estadoTxt}</div>
          </div>
        `;
      }).join('');

      contenedor.innerHTML = `<div class="licencias-grid-emp">${html}</div>`;

    } catch (e) {
      contenedor.innerHTML = `<div class="empty-state"><p>Error al cargar licencias: ${e.message}</p></div>`;
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
        if (tabId === 'tab-licencias') cargarLicencias();
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

  return { init, bindFichar, destroy, cambiarMesHorario };
})();
