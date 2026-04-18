import { Store } from './store.js';
import { UI } from './ui.js';

const App = {
    editModeId: null,
    vistaAnterior: 'dashboard',
    materiaFiltroCompletadas: false,

    init() {
        Store.init();
        UI.renderNav(Store.state.materias);
        UI.renderSelectMaterias(Store.state.materias);
        this.renderDashboard();
        
        // MOSTRAR CRÉDITOS AL ENTRAR
        UI.showDevCard();
    },

    toggleMenu(forceClose = false) {
        const sidebar = document.getElementById('sidebar');
        if (forceClose) sidebar.classList.remove('open');
        else sidebar.classList.toggle('open');
    },

    showView(viewId, subjectName = null) {
        if (viewId !== 'form') this.vistaAnterior = viewId === 'subject' ? subjectName : 'dashboard';
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-' + viewId).classList.add('active');
        document.getElementById('fab-add').style.display = (viewId === 'form') ? 'none' : 'flex';

        if (subjectName && viewId === 'subject') {
            document.getElementById('subject-name-display').innerText = subjectName;
            this.materiaFiltroCompletadas = false;
            UI.actualizarBotonesFiltro(this.materiaFiltroCompletadas);
            this.renderSubjectDetail(subjectName);
            this.toggleMenu(true);
        } else if (viewId === 'dashboard') {
            this.renderDashboard();
            this.toggleMenu(true);
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
        } else {
            document.getElementById('titulo').value = '';
            document.getElementById('fecha-input').value = '';
            document.getElementById('notas-input').value = '';
        }
        this.showView('form');
    },

    cerrarFormulario() {
        if (this.vistaAnterior === 'dashboard') this.showView('dashboard');
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
            notas: document.getElementById('notas-input').value
        };
        Store.guardarActividad(data, this.editModeId);
        this.cerrarFormulario();
        this.refrescarVistaActual();
    },

    agregarMateria() {
        const nombre = prompt("Nombre de la nueva materia:");
        if (Store.addMateria(nombre)) {
            UI.renderNav(Store.state.materias);
            UI.renderSelectMaterias(Store.state.materias);
        }
    },

    realizarBusqueda() {
        const query = document.getElementById('global-search').value.toLowerCase();
        this.renderDashboard(query);
    },

    setFiltroMateria(verCompletadas) {
        this.materiaFiltroCompletadas = verCompletadas;
        UI.actualizarBotonesFiltro(this.materiaFiltroCompletadas);
        this.renderSubjectDetail(document.getElementById('subject-name-display').innerText);
    },

    toggleCompletada(id) { 
        const act = Store.getActividadById(id);
        if(!act) return;
        if(!act.completada) {
            Store.setCompletada(id, true);
            if(act.tipo === 'Examen') {
                setTimeout(() => {
                    const nota = prompt(`¡Examen finalizado! ¿Nota? (0-20, AD, A)`);
                    if(nota) { Store.setCalificacion(id, nota); this.refrescarVistaActual(); }
                }, 100);
            }
        } else { Store.setCompletada(id, false); }
        this.refrescarVistaActual();
    },

    editarCalificacion(id) {
        const act = Store.getActividadById(id);
        const nota = prompt("Calificación:", act.calificacion || "");
        if(nota !== null) { Store.setCalificacion(id, nota); this.refrescarVistaActual(); }
    },

    agregarSubtarea(actId) {
        const input = document.getElementById(`subtask-input-${actId}`);
        Store.addSubtarea(actId, input.value.trim());
        this.refrescarVistaActual();
        setTimeout(() => document.getElementById(`detalles-${actId}`).style.display = 'block', 50);
    },

    toggleSubtarea(actId, subIndex) {
        Store.toggleSubtarea(actId, subIndex);
        this.refrescarVistaActual();
        setTimeout(() => document.getElementById(`detalles-${actId}`).style.display = 'block', 50);
    },

    eliminarSubtarea(actId, subIndex) {
        Store.deleteSubtarea(actId, subIndex);
        this.refrescarVistaActual();
        setTimeout(() => document.getElementById(`detalles-${actId}`).style.display = 'block', 50);
    },

    eliminarActividad(id) {
        if(confirm("¿Eliminar?")) { Store.deleteActividad(id); this.refrescarVistaActual(); }
    },

    toggleDetalles(id) {
        const el = document.getElementById(`detalles-${id}`);
        el.style.display = el.style.display === 'block' ? 'none' : 'block';
    },

    renderDashboard(q = "") { UI.renderDashboard(Store.getDashboardActividades(q), Store.state.materias); },

    renderSubjectDetail(m) { UI.renderSubjectDetail(Store.getSubjectActividades(m, this.materiaFiltroCompletadas), Store.state.materias, Store.getPromedio(m)); },

    refrescarVistaActual() {
        if (this.vistaAnterior === 'dashboard') this.renderDashboard();
        else this.renderSubjectDetail(document.getElementById('subject-name-display').innerText);
    }
    if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Modo Offline Activado 🚀'))
      .catch(err => console.log('Error al activar offline', err));
  });
}
};

window.app = App;
document.addEventListener('DOMContentLoaded', () => App.init());
