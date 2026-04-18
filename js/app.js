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
        
        prompt("[Debbung, Showing DevCard")
        showDevCard();
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
            document.getElementById('global-search').value = ''; 
            this.renderDashboard();
            this.toggleMenu(true);
        }
    },

    abrirFormulario(id = null) {
        this.editModeId = id;
        const tituloForm = document.getElementById('form-title');
        const btnSave = document.getElementById('btn-save-form');

        if (id) {
            tituloForm.innerText = "Editar Actividad";
            btnSave.innerText = "Actualizar Actividad";
            const act = Store.getActividadById(id);
            document.getElementById('titulo').value = act.titulo;
            document.getElementById('materia-select').value = act.materia;
            document.getElementById('tipo-select').value = act.tipo;
            document.getElementById('fecha-input').value = act.fecha;
            document.getElementById('dificultad-select').value = act.dificultad;
            document.getElementById('notas-input').value = act.notas;
        } else {
            tituloForm.innerText = "Crear Actividad";
            btnSave.innerText = "Guardar Actividad";
            document.getElementById('titulo').value = '';
            document.getElementById('fecha-input').value = '';
            document.getElementById('notas-input').value = '';
            if (this.vistaAnterior !== 'dashboard') {
                document.getElementById('materia-select').value = this.vistaAnterior;
            }
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
            titulo: titulo,
            materia: document.getElementById('materia-select').value,
            tipo: document.getElementById('tipo-select').value,
            fecha: fecha,
            dificultad: document.getElementById('dificultad-select').value,
            notas: document.getElementById('notas-input').value
            // Ya no le pasamos la nota aquí, solo desde el prompt.
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
        if (!document.getElementById('view-dashboard').classList.contains('active')) {
            this.showView('dashboard');
        }
        this.renderDashboard(query);
    },

    setFiltroMateria(verCompletadas) {
        this.materiaFiltroCompletadas = verCompletadas;
        UI.actualizarBotonesFiltro(this.materiaFiltroCompletadas);
        this.renderSubjectDetail(document.getElementById('subject-name-display').innerText);
    },

    // --- NUEVA LÓGICA DE COMPLETAR (DETECTA EXÁMENES) ---
    toggleCompletada(id) { 
        const act = Store.getActividadById(id);
        if (!act) return;

        // Si la estamos marcando como completada (estaba en false)
        if (!act.completada) {
            Store.setCompletada(id, true);
            
            // Si es un Examen y NO tiene nota, le preguntamos automáticamente
            if (act.tipo === 'Examen' && (!act.calificacion || act.calificacion === '')) {
                // Pequeño timeout para que se dibuje el check antes del alert
                setTimeout(() => {
                    const nota = prompt(`¡Completaste "${act.titulo}"!\n¿Qué calificación obtuviste? (Ej: 18, 20, AD, A)\n\n(Deja en blanco si aún no la sabes)`);
                    if (nota !== null && nota.trim() !== '') {
                        Store.setCalificacion(id, nota.trim());
                        this.refrescarVistaActual();
                    }
                }, 100);
            }
        } else {
            // Si la desmarcamos, simplemente le quitamos el estado completado
            Store.setCompletada(id, false);
        }
        this.refrescarVistaActual();
    },

    // Botón manual en los detalles de la tarjeta
    editarCalificacion(id) {
        const act = Store.getActividadById(id);
        const notaActual = act.calificacion || "";
        const nota = prompt(`Ingresa la calificación para "${act.titulo}":\n(Ej: 0-20, AD, A, B, C)`, notaActual);
        
        if (nota !== null) { // null significa que le dio a Cancelar
            Store.setCalificacion(id, nota.trim());
            Store.setCompletada(id, true); // Si le pone nota, asumimos que ya está completada
            this.refrescarVistaActual();
            setTimeout(() => document.getElementById(`detalles-${id}`).style.display = 'block', 50);
        }
    },
    // ----------------------------------------------------

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
        if(confirm("¿Borrar este paso?")) {
            Store.deleteSubtarea(actId, subIndex);
            this.refrescarVistaActual();
            setTimeout(() => document.getElementById(`detalles-${actId}`).style.display = 'block', 50);
        }
    },

    eliminarActividad(id) {
        if(confirm("¿Eliminar actividad definitivamente?")) {
            Store.deleteActividad(id);
            this.refrescarVistaActual();
        }
    },

    toggleDetalles(id) {
        const detalles = document.getElementById(`detalles-${id}`);
        const btn = document.getElementById(`btn-detalles-${id}`);
        if (detalles.style.display === 'block') {
            detalles.style.display = 'none';
            btn.innerHTML = btn.innerHTML.replace('🔼', '🔽').replace('Ocultar detalles', 'Ver detalles y pasos');
        } else {
            detalles.style.display = 'block';
            btn.innerHTML = 'Ocultar detalles 🔼';
        }
    },

    renderDashboard(query = "") {
        const acts = Store.getDashboardActividades(query);
        UI.renderDashboard(acts, Store.state.materias);
    },

    renderSubjectDetail(materiaNombre) {
        const acts = Store.getSubjectActividades(materiaNombre, this.materiaFiltroCompletadas);
        const promedio = Store.getPromedio(materiaNombre);
        UI.renderSubjectDetail(acts, Store.state.materias, promedio);
    },

    refrescarVistaActual() {
        if (this.vistaAnterior === 'dashboard') this.realizarBusqueda();
        else this.renderSubjectDetail(document.getElementById('subject-name-display').innerText);
    }
};

window.app = App;
document.addEventListener('DOMContentLoaded', () => App.init());
