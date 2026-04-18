export const UI = {
    renderNav(materias) {
        const list = document.getElementById('nav-subjects-list');
        list.innerHTML = materias.map(m => `
            <div class="nav-item" onclick="app.showView('subject', '${m.nombre}')">
                <div class="color-dot" style="background-color: ${m.color};"></div>
                ${m.nombre}
            </div>
        `).join('');
    },

    renderSelectMaterias(materias) {
        const select = document.getElementById('materia-select');
        select.innerHTML = materias.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');
    },

    renderDashboard(actividades, materiasStore) {
        const container = document.getElementById('dash-all');
        container.innerHTML = actividades.map(a => this.createCard(a, materiasStore)).join('');
    },

    renderSubjectDetail(actividades, materiasStore, promedio) {
        const avgDisplay = document.querySelector('#subject-average span');
        if(promedio) {
            avgDisplay.innerText = promedio;
            document.getElementById('subject-average').style.display = 'flex';
        } else {
            document.getElementById('subject-average').style.display = 'none';
        }

        document.getElementById('subject-exams').innerHTML = actividades.filter(a => a.tipo === 'Examen').map(a => this.createCard(a, materiasStore)).join('');
        document.getElementById('subject-tasks').innerHTML = actividades.filter(a => a.tipo === 'Tarea').map(a => this.createCard(a, materiasStore)).join('');
        document.getElementById('subject-others').innerHTML = actividades.filter(a => a.tipo === 'Otro').map(a => this.createCard(a, materiasStore)).join('');
    },

    actualizarBotonesFiltro(materiaFiltroCompletadas) {
        document.getElementById('btn-filtro-pendientes').classList.toggle('active', !materiaFiltroCompletadas);
        document.getElementById('btn-filtro-completadas').classList.toggle('active', materiaFiltroCompletadas);
    },

    obtenerInfoFecha(fechaStr, completada) {
        if(completada) return { texto: "✅ Finalizada", urgente: false };
        if(!fechaStr) return { texto: "Sin fecha", urgente: false };
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const fechaT = new Date(fechaStr + 'T00:00:00'); 
        const diffDias = Math.ceil((fechaT - hoy) / (1000 * 60 * 60 * 24));
        
        if(diffDias === 0) return { texto: "🚨 VENCE HOY", urgente: true };
        if(diffDias === 1) return { texto: "⚠️ Vence Mañana", urgente: true };
        if(diffDias === 2) return { texto: "⏳ Faltan 2 días", urgente: true };
        if(diffDias < 0) return { texto: `❌ Atrasada ${Math.abs(diffDias)}d`, urgente: true };
        return { texto: `📅 Faltan ${diffDias} días`, urgente: false };
    },

    createCard(a, materiasStore) {
        const mat = materiasStore.find(m => m.nombre === a.materia);
        const color = mat ? mat.color : '#ccc';
        const infoFecha = this.obtenerInfoFecha(a.fecha, a.completada);
        const statusClass = a.completada ? 'completed' : (infoFecha.urgente ? 'urgent' : '');
        const difIcon = a.dificultad === 'Fácil' ? '🟢 Baja' : (a.dificultad === 'Medio' ? '🟡 Media' : '🔴 Alta');
        
        const countSub = a.subtareas.length;
        const countDone = a.subtareas.filter(s => s.completada).length;
        const subTxt = countSub > 0 ? `(${countDone}/${countSub})` : '';

        // Insignia de nota visible en el header de la tarjeta
        const badgeCalificacion = (a.calificacion && a.calificacion.toString().trim() !== '') ? `<div class="grade-badge">🏆 Nota: ${a.calificacion.toString().toUpperCase()}</div>` : '';

        const htmlSubtareas = a.subtareas.map((sub, index) => `
            <div class="subtask-item ${sub.completada ? 'done' : ''}">
                <input type="checkbox" ${sub.completada ? 'checked' : ''} onchange="app.toggleSubtarea(${a.id}, ${index})">
                <span style="flex:1;">${sub.texto}</span>
                <button class="btn-del-sub" onclick="app.eliminarSubtarea(${a.id}, ${index})"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        return `
            <div class="card ${statusClass}" style="border-left-color: ${color};">
                <div class="badges-container">
                    <span class="badge-date">${infoFecha.texto}</span>
                    <div style="display:flex; gap:12px; align-items:center;">
                        ${badgeCalificacion}
                        <span class="badge-diff">⚡ ${difIcon}</span>
                        <input type="checkbox" class="big-checkbox" title="Completada" ${a.completada ? 'checked' : ''} onchange="app.toggleCompletada(${a.id})">
                    </div>
                </div>
                
                <h4 style="margin: 5px 0; font-size:1.2rem;">${a.titulo}</h4>
                <div style="display:flex; align-items:center; gap:5px; font-size:0.9rem; font-weight:bold; color:${color};">
                    <div class="color-dot" style="background-color: ${color};"></div>
                    ${a.materia} <span style="color:var(--text-muted); font-weight:normal;">• ${a.tipo}</span>
                </div>
                
                <button id="btn-detalles-${a.id}" class="btn-toggle-details" onclick="app.toggleDetalles(${a.id})">
                    Ver detalles y pasos ${subTxt} 🔽
                </button>

                <div id="detalles-${a.id}" class="card-details">
                    ${a.notas ? `<p style="font-size:0.95rem; color:var(--text-main); white-space: pre-wrap; margin:0 0 15px 0; background:#f9fafb; padding:12px; border-radius:8px;">${a.notas}</p>` : ''}
                    
                    <div>
                        <strong style="font-size:0.9rem; color:var(--text-muted);">PASOS / CHECKLIST:</strong>
                        <div style="margin-top:10px;">${htmlSubtareas}</div>
                        <div class="add-subtask-wrapper">
                            <input type="text" id="subtask-input-${a.id}" placeholder="Añadir paso..." onkeypress="if(event.key==='Enter') app.agregarSubtarea(${a.id})">
                            <button onclick="app.agregarSubtarea(${a.id})">+</button>
                        </div>
                    </div>
                    
                    <div class="card-actions" style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:15px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                        <!-- Botón para asignar nota manualmente (Ideal para tareas calificadas o correcciones) -->
                        <button onclick="app.editarCalificacion(${a.id})" style="color:#d97706; background:#fef3c7; border-radius:6px; padding:8px 12px;"><i class="fas fa-medal"></i> Asignar Nota</button>
                        
                        <div style="display:flex; gap:15px;">
                            <button onclick="app.abrirFormulario(${a.id})" style="color:var(--primary);"><i class="fas fa-pen"></i> Editar</button>
                            <button onclick="app.eliminarActividad(${a.id})" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};