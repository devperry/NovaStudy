const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];

export const Store = {
    state: { materias: [], actividades: [] },

    init() {
        // Inicializar materias con descripción por defecto vacía si no existe
        const localMats = JSON.parse(localStorage.getItem('top1_mats_v3'));
        this.state.materias = localMats || [{ nombre: "Matemáticas", color: "#3b82f6", descripcion: "" }];
        this.state.actividades = JSON.parse(localStorage.getItem('top1_acts_v3')) || [];

        // NUEVO: Ejecutar limpieza automática al arrancar la app
        this.ejecutarLimpiezaAutomatica();
    },

    save() {
        localStorage.setItem('top1_mats_v3', JSON.stringify(this.state.materias));
        localStorage.setItem('top1_acts_v3', JSON.stringify(this.state.actividades));
    },

    // NUEVO: Auto-limpieza inteligente (7 días)
    ejecutarLimpiezaAutomatica() {
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        const totalAntes = this.state.actividades.length;

        this.state.actividades = this.state.actividades.filter(a => {
            if (!a.fecha) return true; // Tareas sin fecha no se borran

            const fechaT = new Date(a.fecha + 'T00:00:00');
            const diffDias = Math.ceil((fechaT - hoy) / (1000 * 60 * 60 * 24));

            // Si está atrasada por más de 7 días
            if (diffDias < -7) {
                // Si es un apunte ("Otro"), no la borramos
                if (a.tipo === 'Otro') return true;
                // Si es Tarea o Examen y tiene nota, la CONSERVAMOS para no romper promedios
                if ((a.tipo === 'Tarea' || a.tipo === 'Examen') && (a.calificacion && a.calificacion.toString().trim() !== '')) {
                    return true;
                }
                return false; // Se elimina si tiene más de 7 días vencido y no tiene calificación
            }
            return true;
        });

        if (totalAntes !== this.state.actividades.length) {
            this.save();
            console.log(`🧹 Limpieza automática ejecutada: Se eliminaron ${totalAntes - this.state.actividades.length} actividades obsoletas.`);
        }
    },

    addMateria(nombre, descripcion = "") {
        if (!nombre) return false;
        const existing = this.state.materias.find(m => m.nombre === nombre);
        if (existing) {
            // Si la materia existe pero no tiene descripción, la actualizamos
            if (descripcion && !existing.descripcion) {
                existing.descripcion = descripcion;
                this.save();
            }
            return false;
        }
        const color = PALETTE[this.state.materias.length % PALETTE.length];
        this.state.materias.push({ nombre, color, descripcion });
        this.save();
        return true;
    },

    // NUEVO: Modificar la descripción de la materia
    updateMateriaDescripcion(nombre, descripcion) {
        const mat = this.state.materias.find(m => m.nombre === nombre);
        if (mat) {
            mat.descripcion = descripcion;
            this.save();
        }
    },

    guardarActividad(actividadData, editId = null) {
        if (editId) {
            const index = this.state.actividades.findIndex(a => a.id === editId);
            if (index !== -1) this.state.actividades[index] = { ...this.state.actividades[index], ...actividadData };
        } else {
            this.state.actividades.push({ id: Date.now(), ...actividadData, completada: false, calificacion: null, subtareas: actividadData.subtareas || [] });
        }
        this.save();
    },

    purgarTareasPremium() {
        const cantidadAntes = this.state.actividades.length;
        this.state.actividades = this.state.actividades.filter(a => !a.globalId);
        if (cantidadAntes !== this.state.actividades.length) { this.save(); }
    },

    deleteMateria(nombre) {
        this.state.materias = this.state.materias.filter(m => m.nombre !== nombre);
        this.state.actividades = this.state.actividades.filter(a => a.materia !== nombre);
        this.save();
    },

    getExportJSON() {
        const cleanActs = this.state.actividades.filter(a => !a.globalId);
        const dataObj = { materias: this.state.materias, actividades: cleanActs, theme: localStorage.getItem('top1_theme') || 'default' };
        return JSON.stringify(dataObj, null, 2);
    },

    importFromJSON(jsonString, overwrite = false) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.materias || !data.actividades) return false;

            if (overwrite) {
                const premiumTasks = this.state.actividades.filter(a => a.globalId);
                this.state.materias = data.materias;
                this.state.actividades = [...data.actividades, ...premiumTasks];
            } else {
                data.materias.forEach(newMat => {
                    const existing = this.state.materias.find(m => m.nombre === newMat.nombre);
                    if (!existing) {
                        this.state.materias.push(newMat);
                    } else if (newMat.descripcion && !existing.descripcion) {
                        // Si ya existe la materia pero no tenía descripción, le inyectamos la del archivo
                        existing.descripcion = newMat.descripcion;
                    }
                });
                data.actividades.forEach(newAct => {
                    if (!this.state.actividades.find(a => a.id === newAct.id)) this.state.actividades.push(newAct);
                });
            }
            if (data.theme) localStorage.setItem('top1_theme', data.theme);
            this.save(); return true;
        } catch(e) { return false; }
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
        if(count === 0) return null; return (suma / count).toFixed(1);
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