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
                    subtareas:[]
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

        // --- CASO 1: EL USUARIO YA ES PREMIUM ---
        if (user && user.role === 'premium') {
            statusBox.innerHTML = `
                <div style="text-align:center;">
                    <i class="fas fa-crown" style="font-size: 4rem; color: #fbbf24; margin-bottom: 15px;"></i>
                    <h2 style="margin:0;">¡Eres Miembro VIP!</h2>
                    <p style="color: #ccc;">Tienes acceso total al sistema del Top 1%.</p>
                    
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-top: 20px;">
                        <span style="font-size:0.9rem; color:#aaa; display:block; margin-bottom:5px;">TU SUSCRIPCIÓN VENCE EL:</span>
                        <b style="font-size:1.5rem; color:white;">${user.premiumHasta}</b>
                    </div>
                    
                    <p style="margin-top:20px; font-size:0.85rem; color:#888;">Habla con Migue para renovar antes de la fecha.</p>
                </div>
            `;
            return;
        }

        // --- CASO 2: EL USUARIO ES ADMIN ---
        if (user && user.role === 'admin') {
            statusBox.innerHTML = `
                <div style="text-align:center; padding: 20px;">
                    <i class="fas fa-shield-alt" style="font-size: 4rem; color: #ef4444; margin-bottom: 15px;"></i>
                    <h2>Acceso Administrador</h2>
                    <p style="color: #ccc;">Tienes todos los beneficios desbloqueados permanentemente.</p>
                </div>
            `;
            return;
        }

        // --- CASO 3: EL USUARIO ES "FREE" (PÁGINA DE VENTAS) ---
        statusBox.innerHTML = `
            <div class="premium-container">
                <p style="color: #ccc; margin-bottom:20px;">Únete a los mejores y olvídate de estar preguntando las tareas cada noche.</p>
                
                <div class="card" style="background: var(--bg); border:none;">
                    <ul class="feature-list">
                        <li class="feature-item"><i class="fas fa-check"></i> ☁️ Tareas Automáticas (Sync en la nube)</li>
                        <li class="feature-item"><i class="fas fa-check"></i> 📚 Temas de Exámenes detallados</li>
                        <li class="feature-item"><i class="fas fa-check"></i> 🎨 Temas y Colores Exclusivos</li>
                        <li class="feature-item"><i class="fas fa-check"></i> 🚀 Acceso al Panel de Estrategia</li>
                        <li class="feature-item"><i class="fas fa-check"></i> 🔇 Cero anuncios / Notificaciones VIP</li>
                    </ul>
                </div>

                <h3 style="margin: 25px 0 15px 0; color: white;">Elige tu Plan</h3>

                <div class="plan-card weekly">
                    <div class="price-subtitle" style="color: var(--text-muted);">PLAN BÁSICO</div>
                    <div class="price-title" style="color: var(--text-main);">3.50 S/</div>
                    <div class="price-subtitle" style="color: var(--text-muted);">POR 7 DÍAS DE ACCESO</div>
                </div>

                <div class="plan-card monthly">
                    <div class="best-value">MÁS POPULAR</div>
                    <div class="price-subtitle" style="color: #fbbf24;">PLAN ESTUDIANTE ÉLITE</div>
                    <div class="price-title">10.00 S/</div>
                    <div class="price-subtitle">POR 1 MES COMPLETO (Ahorras 4 soles)</div>
                </div>

                <button class="btn-massive" onclick="window.open('https://wa.me/+51 944 738 426?text=Hola%20Migue,%20quiero%20el%20Premium%20de%20TopSchool', '_blank')" style="background:#2563eb; margin-top:20px;">
                    <i class="fab fa-whatsapp"></i> Hablar con Migue para Activar
                </button>
                <p style="font-size:0.75rem; color:#666; margin-top:15px;">La activación es instantánea después de confirmar el pago.</p>
            </div>
        `;
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
            document.getElementById('titulo').value = act.titulo; document.getElementById('materia-select').value = act.materia;
            document.getElementById('tipo-select').value = act.tipo; document.getElementById('fecha-input').value = act.fecha;
            document.getElementById('dificultad-select').value = act.dificultad; document.getElementById('notas-input').value = act.notas;
        } else {
            document.getElementById('titulo').value = ''; document.getElementById('fecha-input').value = ''; document.getElementById('notas-input').value = '';
            if (this.vistaAnterior !== 'dashboard' && this.vistaAnterior !== 'aspecto' && this.vistaAnterior !== 'premium' && this.vistaAnterior !== 'admin') {
                document.getElementById('materia-select').value = this.vistaAnterior;
            }
        }
        this.showView('form');
    },

    cerrarFormulario() {
        if (['dashboard', 'aspecto', 'premium', 'admin'].includes(this.vistaAnterior)) this.showView('dashboard');
        else this.showView('subject', this.vistaAnterior);
    },

    guardarActividad() {
        const titulo = document.getElementById('titulo').value; const fecha = document.getElementById('fecha-input').value;
        if (!titulo || !fecha) return alert("Falta título o fecha.");
        Store.guardarActividad({ titulo, materia: document.getElementById('materia-select').value, tipo: document.getElementById('tipo-select').value, fecha, dificultad: document.getElementById('dificultad-select').value, notas: document.getElementById('notas-input').value }, this.editModeId);
        this.cerrarFormulario(); this.refrescarVistaActual();
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