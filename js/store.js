const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];

export const Store = {
    state: { materias: [], actividades: [] },

    init() {
        this.state.materias = JSON.parse(localStorage.getItem('top1_mats_v3')) || [{ nombre: "Matemáticas", color: "#3b82f6" }];
        this.state.actividades = JSON.parse(localStorage.getItem('top1_acts_v3')) || [];
    },

    save() {
        localStorage.setItem('top1_mats_v3', JSON.stringify(this.state.materias));
        localStorage.setItem('top1_acts_v3', JSON.stringify(this.state.actividades));
    },

    addMateria(nombre) {
        if (!nombre || this.state.materias.find(m => m.nombre === nombre)) return false;
        const color = PALETTE[this.state.materias.length % PALETTE.length];
        this.state.materias.push({ nombre, color });
        this.save();
        return true;
    },

    // --- EL CEREBRO DE GUARDADO ---
    guardarActividad(actividadData, editId = null) {
        if (editId) {
            const index = this.state.actividades.findIndex(a => a.id === editId);
            if (index !== -1) {
                // Al editar, actualizamos todo incluyendo la nueva checklist del formulario
                this.state.actividades[index] = { ...this.state.actividades[index], ...actividadData };
            }
        } else {
            // Al crear nueva
            this.state.actividades.push({ 
                id: Date.now(), 
                ...actividadData, 
                completada: false, 
                calificacion: null, 
                // Si el formulario no envió subtareas, ponemos un array vacío
                subtareas: actividadData.subtareas || [] 
            });
        }
        this.save();
    },

    deleteMateria(nombre) {
        this.state.materias = this.state.materias.filter(m => m.nombre !== nombre);
        this.state.actividades = this.state.actividades.filter(a => a.materia !== nombre);
        this.save();
    },

    getActividadById(id) { return this.state.actividades.find(a => a.id === id); },
    deleteActividad(id) { this.state.actividades = this.state.actividades.filter(a => a.id !== id); this.save(); },
    setCompletada(id, estado) { const act = this.getActividadById(id); if (act) { act.completada = estado; this.save(); } },
    setCalificacion(id, nota) { const act = this.getActividadById(id); if (act) { act.calificacion = nota; this.save(); } },

    getPromedio(materiaNombre) {
        const acts = this.state.actividades.filter(a => a.materia === materiaNombre && a.calificacion !== null && a.calificacion !== undefined && a.calificacion.toString().trim() !== '');
        if(acts.length === 0) return null;
        let suma = 0; let count = 0;
        acts.forEach(a => {
            let val = a.calificacion.toString().toUpperCase().trim();
            if (val === 'AD') suma += 20; else if (val === 'A') suma += 16; else if (val === 'B') suma += 12; else if (val === 'C') suma += 8;
            else if (!isNaN(parseFloat(val))) suma += parseFloat(val); else return;
            count++;
        });
        if(count === 0) return null;
        return (suma / count).toFixed(1);
    },

    addSubtarea(actId, texto) { const act = this.getActividadById(actId); if (act && texto) { act.subtareas.push({ texto, completada: false }); this.save(); } },
    toggleSubtarea(actId, subIndex) { const act = this.getActividadById(actId); if (act) { act.subtareas[subIndex].completada = !act.subtareas[subIndex].completada; this.save(); } },
    deleteSubtarea(actId, subIndex) { const act = this.getActividadById(actId); if (act) { act.subtareas.splice(subIndex, 1); this.save(); } },

    getDashboardActividades(query = "") {
        let filtradas = [...this.state.actividades];
        if (query) filtradas = filtradas.filter(a => a.titulo.toLowerCase().includes(query) || a.materia.toLowerCase().includes(query));
        else filtradas = filtradas.filter(a => !a.completada);
        return filtradas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    },

    getSubjectActividades(materiaNombre, completadas) {
        let acts = this.state.actividades.filter(a => a.materia === materiaNombre && a.completada === completadas);
        return acts.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }
};