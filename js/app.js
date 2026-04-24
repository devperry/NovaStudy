import { Store } from './store.js';
import { UI } from './ui.js';
import { Cloud } from './cloud.js';

const popSound = new Audio("data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq/wTEwQAAP4AAAAAEwAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExDkAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq/wTEwQAAP4AAAAAEwAAAANIAAAAAExBTUUzLjEwMKqq");
popSound.volume = 0.5;

const App = {
    editModeId: null, vistaAnterior: 'dashboard', materiaFiltroCompletadas: false,

    init() {
        Store.init();
        const savedTheme = localStorage.getItem('top1_theme') || 'default';
        this.cambiarTema(savedTheme);

        Cloud.initAuth(
            (userData) => {
                document.querySelector('.mobile-header').style.display = 'flex';
                UI.renderNav(Store.state.materias);
                UI.renderSelectMaterias(Store.state.materias);
                
                // Si es Admin, mostrar el botón secreto
                if (userData.role === 'admin') {
                    document.getElementById('nav-admin-btn').style.display = 'flex';
                }

                // Si es Admin o Premium, inyectar las tareas de la Nube
                if (userData.role === 'admin' || userData.role === 'premium') {
                    this.sincronizarTareasGlobales();
                }

                this.renderDashboard();
                this.showView('dashboard');
                UI.showDevCard();
            },
            () => {
                document.querySelector('.mobile-header').style.display = 'none';
                this.showView('auth');
            }
        );
    },

    // --- SINCRONIZACIÓN MÁGICA ---
    async sincronizarTareasGlobales() {
        const globalTasks = await Cloud.getGlobalTasks();
        let added = 0;
        
        globalTasks.forEach(gt => {
            // Revisamos si la tarea global ya existe en el celular
            const exists = Store.state.actividades.find(a => a.globalId === gt.globalId);
            if (!exists) {
                // Si no existe, la inyectamos a la memoria del celular
                Store.state.actividades.push({
                    id: Date.now() + Math.random(), // ID local
                    globalId: gt.globalId, // Marca de agua de la nube
                    titulo: gt.titulo,
                    materia: gt.materia,
                    tipo: gt.tipo,
                    fecha: gt.fecha,
                    dificultad: gt.dificultad,
                    notas: gt.notas,
                    completada: false,
                    calificacion: null,
                    subtareas:[],
                    tempSubtareas:[]
                });
                
                // Autocrear la materia en el celular del alumno si no la tiene
                Store.addMateria(gt.materia);
                added++;
            }
        });

        if (added > 0) {
            Store.save();
            UI.renderNav(Store.state.materias);
            this.refrescarVistaActual();
            console.log(`☁️ ${added} Tareas nuevas inyectadas desde la Nube.`);
        }
    },

    // --- PANEL ADMIN ---
    switchAdminTab(tab) {
        document.getElementById('tab-admin-users').classList.remove('active');
        document.getElementById('tab-admin-tasks').classList.remove('active');
        document.getElementById('tab-admin-' + tab).classList.add('active');
        
        document.getElementById('admin-users-sec').style.display = tab === 'users' ? 'block' : 'none';
        document.getElementById('admin-tasks-sec').style.display = tab === 'tasks' ? 'block' : 'none';
        
        if (tab === 'users') this.loadAdminUsers();
    },

    async loadAdminUsers() {
        const list = document.getElementById('admin-users-list');
        list.innerHTML = "<p>Cargando alumnos...</p>";
        const users = await Cloud.getAllUsers();
        
        list.innerHTML = users.map(u => `
            <div class="card" style="border-left-color: ${u.role === 'premium' ? '#fbbf24' : (u.role==='admin'?'#ef4444':'#9ca3af')};">
                <div style="display:flex; justify-content:space-between;">
                    <strong style="font-size:1.1rem;">${u.nombre}</strong>
                    <span style="font-size:0.8rem; background:#eee; padding:3px 6px; border-radius:4px;">${u.role.toUpperCase()}</span>
                </div>
                <p style="margin:5px 0; font-size:0.85rem; color:var(--text-muted);">${u.email}</p>
                ${u.role === 'premium' ? `<p style="margin:0 0 10px 0; font-size:0.8rem; color:#10b981;">✅ Vence: ${u.premiumHasta}</p>` : ''}
                
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button onclick="app.darPremium('${u.uid}', 7)" style="flex:1; background:#3b82f6; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;">+ 7 Días</button>
                    <button onclick="app.darPremium('${u.uid}', 30)" style="flex:1; background:#fbbf24; color:black; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;">+ 30 Días</button>
                    <button onclick="app.resetDevice('${u.uid}')" style="width:100%; margin-top:5px; background:var(--danger); color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-mobile-alt"></i> Reset Celular</button>
                </div>
            </div>
        `).join('');
    },

    async darPremium(uid, dias) {
        if (confirm(`¿Dar ${dias} días de Premium a este usuario? (Asegúrate de que ya te pagó)`)) {
            const nuevaFecha = await Cloud.grantPremium(uid, dias);
            alert(`✅ Premium activado hasta: ${nuevaFecha}`);
            this.loadAdminUsers();
        }
    },
    
    async resetDevice(uid) {
        if (confirm("¿Permitir que este usuario inicie sesión en un celular nuevo?")) {
            // Importamos la función updateDoc y doc de Firebase para hacerlo desde aquí
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            await updateDoc(doc(Cloud.db, "users", uid), { deviceId: "" });
            alert("✅ Dispositivo reseteado. El alumno ya puede iniciar sesión en su nuevo celular.");
            this.loadAdminUsers();
        }
    },

    async subirTareaGlobal() {
        const data = {
            titulo: document.getElementById('admin-titulo').value,
            materia: document.getElementById('admin-materia').value,
            tipo: document.getElementById('admin-tipo').value,
            fecha: document.getElementById('admin-fecha').value,
            dificultad: document.getElementById('admin-dificultad').value,
            notas: document.getElementById('admin-notas').value
        };
        if(!data.titulo || !data.materia || !data.fecha) return alert("Llena Título, Materia y Fecha.");
        
        await Cloud.addGlobalTask(data);
        alert("☁️ ¡Tarea Inyectada a todos los celulares Premium!");
        document.getElementById('admin-titulo').value = '';
        document.getElementById('admin-notas').value = '';
    },

    // --- LÓGICA DE FIREBASE Y USUARIOS ---
    async login() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        if(!email || !pass) return alert("Llena los campos");
        const res = await Cloud.login(email, pass);
        if(!res.success) alert(res.error);
    },

    async register() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        if(!email || !pass) return alert("Llena los campos");
        const nombre = prompt("¿Cómo te llamas?");
        if(!nombre) return;
        const res = await Cloud.register(email, pass, nombre);
        if(!res.success) alert(res.error);
    },

    logout() { if(confirm("¿Cerrar sesión?")) Cloud.logout(); },

    renderPremium() {
        const statusBox = document.getElementById('premium-status');
        const user = Cloud.userData;

        // Limpiar estilos previos que puedan causar bugs
        statusBox.style.background = "transparent";
        statusBox.style.border = "none";
        statusBox.style.padding = "0";

        if (user && (user.role === 'premium' || user.role === 'admin')) {
            statusBox.innerHTML = `
                <div class="card" style="text-align:center; padding: 30px; background: var(--card-bg); border: 2px solid #fbbf24;">
                    <i class="fas fa-crown" style="font-size: 3.5rem; color: #fbbf24; margin-bottom: 15px;"></i>
                    <h2 style="margin:0; color:var(--text-main);">¡Miembro VIP Activo!</h2>
                    <p style="color: var(--text-muted);">Sincronización en la nube activada.</p>
                    <div style="background: var(--bg); padding: 15px; border-radius: 10px; margin-top: 15px; border: 1px solid var(--border-color);">
                        <small style="color:var(--text-muted); font-weight:bold;">TU PLAN VENCE EL:</small><br>
                        <b style="font-size:1.3rem; color:var(--text-main);">${user.premiumHasta || 'ILIMITADO'}</b>
                    </div>
                </div>`;
            return;
        }

        // PÁGINA DE VENTAS ADAPTATIVA
        statusBox.innerHTML = `
            <div style="text-align:center; color: var(--text-main);">
                <ul style="text-align:left; list-style:none; padding:15px; margin-bottom:25px; background:var(--card-bg); border-radius:12px; border:1px solid var(--border-color);">
                    <li style="margin-bottom:12px; font-weight:500;"><i class="fas fa-check-circle" style="color:#10b981; margin-right:8px;"></i> ☁️ Tareas automáticas en la nube</li>
                    <li style="margin-bottom:12px; font-weight:500;"><i class="fas fa-check-circle" style="color:#10b981; margin-right:8px;"></i> 📚 Temas detallados de exámenes</li>
                    <li style="margin-bottom:12px; font-weight:500;"><i class="fas fa-check-circle" style="color:#10b981; margin-right:8px;"></i> 🎨 Temas y colores Premium</li>
                    <li style="margin-bottom:12px; font-weight:500;"><i class="fas fa-check-circle" style="color:#10b981; margin-right:8px;"></i> 🛡️ Soporte prioritario</li>
                </ul>

                <!-- Plan Semanal Adaptativo -->
                <div style="background:var(--card-bg); border:2px solid var(--border-color); padding:20px; border-radius:15px; margin-bottom:15px;">
                    <div style="color:var(--text-muted); font-size:0.8rem; font-weight:bold;">PLAN SEMANAL</div>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--text-main);">3.50 S/</div>
                    <div style="color:var(--text-muted); font-size:0.8rem;">7 días de acceso VIP</div>
                </div>

                <!-- Plan Mensual (Siempre destaca en oscuro/oro) -->
                <div style="background: linear-gradient(135deg, #1e2937, #000); padding:25px; border-radius:15px; border:2px solid #fbbf24; position:relative; color: white;">
                    <div style="position:absolute; top:-12px; right:15px; background:#fbbf24; color:black; font-size:0.7rem; font-weight:bold; padding:4px 10px; border-radius:20px;">MÁS POPULAR</div>
                    <div style="color:#fbbf24; font-size:0.8rem; font-weight:bold;">PLAN MENSUAL</div>
                    <div style="font-size:2.2rem; font-weight:800; color:white;">10.00 S/</div>
                    <div style="color:#aaa; font-size:0.8rem;">30 días (Ahorras 4 soles)</div>
                </div>

                <button onclick="window.open('https://wa.me/51tu_numero', '_blank')" style="width:100%; background:var(--primary); color:white; border:none; padding:20px; border-radius:12px; margin-top:25px; font-weight:bold; font-size:1.1rem; cursor:pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                    <i class="fab fa-whatsapp"></i> Activar con Migue
                </button>
            </div>
        `;
    },
    eliminarMateriaActual() {
        const nombre = document.getElementById('subject-name-display').innerText;
        if (confirm(`¿Estás seguro de eliminar "${nombre}"? Se borrarán todas las tareas y notas de esta materia.`)) {
            Store.deleteMateria(nombre);
            UI.renderNav(Store.state.materias);
            UI.renderSelectMaterias(Store.state.materias);
            this.showView('dashboard');
        }
    },
    // --- UI Y NAVEGACIÓN (Resto igual) ---
    cambiarTema(themeName) { document.body.setAttribute('data-theme', themeName); localStorage.setItem('top1_theme', themeName); },
    toggleMenu(forceClose = false) { const s = document.getElementById('sidebar'); if (forceClose) s.classList.remove('open'); else s.classList.toggle('open'); },
    showView(viewId, subjectName = null) {
        if (viewId !== 'form') this.vistaAnterior = (viewId === 'subject') ? subjectName : ((viewId === 'aspecto' || viewId === 'premium' || viewId === 'admin') ? viewId : 'dashboard');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const viewEl = document.getElementById('view-' + viewId);
        if(viewEl) viewEl.classList.add('active');
        document.getElementById('fab-add').style.display = (viewId === 'form' || viewId === 'aspecto' || viewId === 'premium' || viewId === 'admin' || viewId === 'auth') ? 'none' : 'flex';

        if (subjectName && viewId === 'subject') {
            document.getElementById('subject-name-display').innerText = subjectName;
            this.materiaFiltroCompletadas = false;
            UI.actualizarBotonesFiltro(this.materiaFiltroCompletadas);
            this.renderSubjectDetail(subjectName);
            this.toggleMenu(true);
        } else if (viewId === 'dashboard') {
            document.getElementById('global-search').value = ''; this.renderDashboard(); this.toggleMenu(true);
        } else if (viewId === 'premium') {
            this.renderPremium(); this.toggleMenu(true);
        } else if (viewId === 'admin') {
            this.switchAdminTab('users'); this.toggleMenu(true);
        }
    },

    abrirFormulario(id = null) {
        this.editModeId = id;
        if (id) {
            const act = Store.getActividadById(id);
            document.getElementById('titulo').value = act.titulo; 
            document.getElementById('materia-select').value = act.materia;
            document.getElementById('tipo-select').value = act.tipo; 
            document.getElementById('fecha-input').value = act.fecha;
            document.getElementById('dificultad-select').value = act.dificultad; 
            document.getElementById('notas-input').value = act.notas;
            // Clonamos los pasos que ya existen para editarlos en el formulario
            this.tempSubtareas = act.subtareas ? [...act.subtareas] :[];
        } else {
            document.getElementById('titulo').value = ''; 
            document.getElementById('fecha-input').value = ''; 
            document.getElementById('notas-input').value = '';
            if (this.vistaAnterior !== 'dashboard' && this.vistaAnterior !== 'aspecto' && this.vistaAnterior !== 'premium' && this.vistaAnterior !== 'admin') {
                document.getElementById('materia-select').value = this.vistaAnterior;
            }
            // Empezamos con la lista de pasos vacía
            this.tempSubtareas =[];
        }
        
        this.renderFormSubtareas(); // Dibuja los pasos
        this.showView('form');
    },

    agregarSubtareaForm() {
        const input = document.getElementById('form-subtask-input');
        const texto = input.value.trim();
        if(texto) {
            this.tempSubtareas.push({ texto: texto, completada: false });
            input.value = '';
            this.renderFormSubtareas();
        }
    },

    eliminarSubtareaForm(index) {
        this.tempSubtareas.splice(index, 1);
        this.renderFormSubtareas();
    },

    cerrarFormulario() {
        if (['dashboard', 'aspecto', 'premium', 'admin'].includes(this.vistaAnterior)) this.showView('dashboard');
        else this.showView('subject', this.vistaAnterior);
    },
    guardarActividad() {
        const titulo = document.getElementById('titulo').value; 
        const fecha = document.getElementById('fecha-input').value;
        if (!titulo || !fecha) return alert("Falta título o fecha.");
        
        const data = { 
            titulo, 
            materia: document.getElementById('materia-select').value, 
            tipo: document.getElementById('tipo-select').value, 
            fecha, 
            dificultad: document.getElementById('dificultad-select').value, 
            notas: document.getElementById('notas-input').value,
            subtareas: this.tempSubtareas // ¡Pasamos la lista al guardar!
        };
        
        Store.guardarActividad(data, this.editModeId);
        this.cerrarFormulario(); 
        this.refrescarVistaActual();
    },

    agregarMateria() { const n = prompt("Nombre de la nueva materia:"); if (Store.addMateria(n)) { UI.renderNav(Store.state.materias); UI.renderSelectMaterias(Store.state.materias); } },
    realizarBusqueda() { this.renderDashboard(document.getElementById('global-search').value.toLowerCase()); },
    setFiltroMateria(ver) { this.materiaFiltroCompletadas = ver; UI.actualizarBotonesFiltro(ver); this.renderSubjectDetail(document.getElementById('subject-name-display').innerText); },

    toggleCompletada(id) { 
        const act = Store.getActividadById(id);
        if(!act) return;
        if(!act.completada) {
            Store.setCompletada(id, true);
            this.lanzarDopamina();
            if(act.tipo === 'Examen') {
                setTimeout(() => {
                    const nota = prompt(`¡Examen finalizado! ¿Nota? (0-20, AD, A)`);
                    if(nota) { Store.setCalificacion(id, nota); this.refrescarVistaActual(); }
                }, 800);
            }
        } else { Store.setCompletada(id, false); }
        this.refrescarVistaActual();
    },

    lanzarDopamina() {
        try { popSound.play(); } catch(e) {}
        if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors:['#2563eb', '#10b981', '#f59e0b'] });
    },

    editarCalificacion(id) {
        const act = Store.getActividadById(id);
        const nota = prompt("Calificación:", act.calificacion || "");
        if(nota !== null) { Store.setCalificacion(id, nota); this.refrescarVistaActual(); }
    },

    agregarSubtarea(actId) { Store.addSubtarea(actId, document.getElementById(`subtask-input-${actId}`).value.trim()); this.refrescarVistaActual(); setTimeout(() => document.getElementById(`detalles-${actId}`).style.display = 'block', 50); },
    toggleSubtarea(actId, subIndex) { Store.toggleSubtarea(actId, subIndex); this.refrescarVistaActual(); setTimeout(() => document.getElementById(`detalles-${actId}`).style.display = 'block', 50); },
    eliminarSubtarea(actId, subIndex) { Store.deleteSubtarea(actId, subIndex); this.refrescarVistaActual(); setTimeout(() => document.getElementById(`detalles-${actId}`).style.display = 'block', 50); },
    eliminarActividad(id) { if(confirm("¿Eliminar?")) { Store.deleteActividad(id); this.refrescarVistaActual(); } },
    toggleDetalles(id) { const el = document.getElementById(`detalles-${id}`); el.style.display = el.style.display === 'block' ? 'none' : 'block'; },
    renderDashboard(q = "") { UI.renderDashboard(Store.getDashboardActividades(q), Store.state.materias); },
    renderSubjectDetail(m) { UI.renderSubjectDetail(Store.getSubjectActividades(m, this.materiaFiltroCompletadas), Store.state.materias, Store.getPromedio(m)); },
    refrescarVistaActual() {
        if (['dashboard', 'aspecto', 'premium', 'admin'].includes(this.vistaAnterior)) this.realizarBusqueda();
        else this.renderSubjectDetail(document.getElementById('subject-name-display').innerText);
    }
};

window.app = App;
document.addEventListener('DOMContentLoaded', () => App.init());

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
}