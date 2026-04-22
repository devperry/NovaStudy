import { Store } from './store.js';
import { UI } from './ui.js';
import { Cloud } from './cloud.js';
// Base64 Audio para efecto Pop
const popSound = new Audio("data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq/wTEwQAAP4AAAAAEwAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExDkAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq/wTEwQAAP4AAAAAEwAAAANIAAAAAExBTUUzLjEwMKqq");
popSound.volume = 0.5;

const App = {
    editModeId: null, vistaAnterior: 'dashboard', materiaFiltroCompletadas: false,

    init() {
        Store.init();
        
        // Cargar Tema Guardado
        const savedTheme = localStorage.getItem('top1_theme') || 'default';
        this.cambiarTema(savedTheme);

        // ARRANCAR EL SISTEMA DE SEGURIDAD (FIREBASE)
        Cloud.initAuth(
            (userData) => {
                // LOGUEADO CORRECTAMENTE
                document.querySelector('.mobile-header').style.display = 'flex';
                UI.renderNav(Store.state.materias);
                UI.renderSelectMaterias(Store.state.materias);
                this.renderDashboard();
                this.showView('dashboard');
                UI.showDevCard();
            },
            () => {
                // NO LOGUEADO (Botar a la pantalla de login)
                document.querySelector('.mobile-header').style.display = 'none'; // Ocultar barra superior
                this.showView('auth');
            }
        );
    },

    cambiarTema(themeName) {
        document.body.setAttribute('data-theme', themeName);
        localStorage.setItem('top1_theme', themeName);
    },

    toggleMenu(forceClose = false) {
        const sidebar = document.getElementById('sidebar');
        if (forceClose) sidebar.classList.remove('open'); else sidebar.classList.toggle('open');
    },

    showView(viewId, subjectName = null) {
        if (viewId !== 'form') this.vistaAnterior = viewId === 'subject' ? subjectName : (viewId === 'aspecto' ? 'aspecto' : 'dashboard');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        document.getElementById('fab-add').style.display = (viewId === 'form' || viewId === 'aspecto') ? 'none' : 'flex';

        if (subjectName && viewId === 'subject') {
            document.getElementById('subject-name-display').innerText = subjectName;
            this.materiaFiltroCompletadas = false;
            UI.actualizarBotonesFiltro(this.materiaFiltroCompletadas);
            this.renderSubjectDetail(subjectName);
            this.toggleMenu(true);
        } else if (viewId === 'dashboard') {
            document.getElementById('global-search').value = ''; 
            this.renderDashboard();
            this.toggleMenu(true);
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
            if (this.vistaAnterior !== 'dashboard' && this.vistaAnterior !== 'aspecto') document.getElementById('materia-select').value = this.vistaAnterior;
        }
        this.showView('form');
    },

    cerrarFormulario() {
        if (this.vistaAnterior === 'dashboard' || this.vistaAnterior === 'aspecto') this.showView('dashboard');
        else this.showView('subject', this.vistaAnterior);
    },

    guardarActividad() {
        const titulo = document.getElementById('titulo').value; const fecha = document.getElementById('fecha-input').value;
        if (!titulo || !fecha) return alert("Falta título o fecha.");
        Store.guardarActividad({ titulo, materia: document.getElementById('materia-select').value, tipo: document.getElementById('tipo-select').value, fecha, dificultad: document.getElementById('dificultad-select').value, notas: document.getElementById('notas-input').value }, this.editModeId);
        this.cerrarFormulario(); this.refrescarVistaActual();
    },

    agregarMateria() {
        const nombre = prompt("Nombre de la nueva materia:");
        if (Store.addMateria(nombre)) { UI.renderNav(Store.state.materias); UI.renderSelectMaterias(Store.state.materias); }
    },

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
        if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#10b981', '#f59e0b'] });
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
        if (this.vistaAnterior === 'dashboard' || this.vistaAnterior === 'aspecto') this.realizarBusqueda();
        else this.renderSubjectDetail(document.getElementById('subject-name-display').innerText);
    }
};
// --- LÓGICA DE FIREBASE ---
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

    logout() {
        if(confirm("¿Cerrar sesión?")) Cloud.logout();
    },

    // RENDERIZAR LA PANTALLA PREMIUM
    renderPremium() {
        const statusBox = document.getElementById('premium-status');
        const user = Cloud.userData;

        if (user && user.role === 'premium') {
            statusBox.innerHTML = `
                <h3 style="color: #fbbf24; margin-top:0;">👑 Suscripción Activa</h3>
                <p style="color: #ccc;">Hola ${user.nombre}, gracias por ser del Top 1%. Todas tus tareas globales se están sincronizando automáticamente.</p>
                <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; text-align:center;">
                    Vence el: <b style="color:white;">${user.premiumHasta || 'Indefinido'}</b>
                </div>
            `;
        } else {
            statusBox.innerHTML = `
                <h3 style="color: #9ca3af; margin-top:0;">🛑 Plan Gratuito</h3>
                <p style="color: #ccc;">No tienes acceso a las tareas automáticas del colegio. Obtén tu pase VIP para olvidarte del estrés escolar.</p>
                <div style="background: #2563eb; color: white; padding: 15px; border-radius: 8px; text-align:center; font-weight:bold; margin-top:15px;">
                    💎 3.50 Soles / Semana
                </div>
                <p style="text-align:center; font-size: 0.8rem; color:#9ca3af; margin-top:10px;">Habla con Migue en el colegio para activar tu cuenta.</p>
            `;
        }
    }
window.app = App;
document.addEventListener('DOMContentLoaded', () => App.init());

// Service Worker (Para Offline y PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Offline v2 🚀'))
            .catch(err => console.error('Error Offline', err));
    });
}
