import { Store } from './store.js';
import { UI } from './ui.js';
import { Cloud } from './cloud.js';

const popSound = new Audio("./assets/sfx/winTouchSfxPastel.mp3");
popSound.volume = 0.7;
const clapsSound = new Audio("./assets/sfx/multitudAplausos.mp3");
clapsSound.volume = 0.3;
const clickSound = new Audio("./assets/sfx/uiClick.mp3");
clickSound.volume = 0.5;
const deleteSound = new Audio("./assets/sfx/eraseCutted.mp3");
deleteSound.volume = 1;

const App = {
    editModeId: null, 
    vistaAnterior: 'dashboard', 
    materiaFiltroCompletadas: false,
    tempSubtareas: [],        // Memoria para formulario privado
    adminTempSubtareas: [],   // Memoria para formulario Admin

    init() {
        Store.init();
        const savedTheme = localStorage.getItem('top1_theme') || 'default';
        this.cambiarTema(savedTheme);
        //Funcion Para iniciar el auth
        Cloud.initAuth(
            (userData) => {
                document.querySelector('.mobile-header').style.display = 'flex';
                UI.renderNav(Store.state.materias);
                UI.renderSelectMaterias(Store.state.materias);
                this.updateProfileUI(); 

                if (userData.role === 'admin') {
                    document.getElementById('nav-admin-btn').style.display = 'flex';
                }

                if (userData.role === 'admin' || userData.role === 'premium') {
                    this.sincronizarTareasGlobales();
                } else {
                    Store.purgarTareasPremium();
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

    // --- SINCRONIZACIÓN MÁGICA (CORREGIDA) ---
    async sincronizarTareasGlobales() {
        const globalTasks = await Cloud.getGlobalTasks();

        // Sin conexión: no tocamos nada local para no perder tareas globales por error.
        if (globalTasks === null) return;

        let added = 0;
        let updated = false;
        
        globalTasks.forEach(gt => {
            // Buscamos si la tarea ya existe en el celular de forma segura
            const exists = Store.state.actividades.find(a => 
                a.globalId === gt.globalId || 
                (a.titulo.trim().toLowerCase() === gt.titulo.trim().toLowerCase() && a.materia === gt.materia)
            );

            if (!exists) {
                // 1. SI NO EXISTE: Inyectamos como tarea totalmente nueva
                Store.state.actividades.push({
                    id: Date.now() + Math.random(), 
                    globalId: gt.globalId, 
                    titulo: gt.titulo,
                    materia: gt.materia,
                    tipo: gt.tipo,
                    fecha: gt.fecha,
                    dificultad: gt.dificultad,
                    notas: gt.notas,
                    completada: false,
                    calificacion: null,
                    subtareas: gt.subtareas || [] 
                });
                Store.addMateria(gt.materia);
                added++;
            } else {
                // 2. SI YA EXISTE: Actualizamos con los cambios del Admin (Smart Update)
                const nuevasSubtareas = (gt.subtareas || []).map(nuevaSub => {
                    const viejaSub = (exists.subtareas || []).find(s => s.texto === nuevaSub.texto);
                    return {
                        texto: nuevaSub.texto,
                        completada: viejaSub ? viejaSub.completada : false
                    };
                });

                exists.globalId = gt.globalId;
                exists.titulo = gt.titulo;
                exists.materia = gt.materia;
                exists.tipo = gt.tipo;
                exists.fecha = gt.fecha;
                exists.dificultad = gt.dificultad;
                exists.notes = gt.notes;
                exists.notas = gt.notas;
                exists.subtareas = nuevasSubtareas;
                updated = true;
            }
        });

        // 3. FIX BUG: Si el Admin eliminó una tarea global en Firebase (fin de bimestre,
        // limpieza, JSON nuevo), la quitamos también del celular. Antes esto no pasaba,
        // por lo que la limpieza local de 7 días la borraba y esta misma función la
        // volvía a inyectar como nueva (completada:false) en cada sincronización,
        // haciendo que pareciera "desmarcarse y persistir" para siempre.
        const idsEnNube = new Set(globalTasks.map(gt => gt.globalId));
        const totalAntes = Store.state.actividades.length;
        Store.state.actividades = Store.state.actividades.filter(a => !a.globalId || idsEnNube.has(a.globalId));
        const removidas = totalAntes - Store.state.actividades.length;
       
        if (added > 0 || updated || removidas > 0) {
            Store.save();
            UI.renderNav(Store.state.materias);
            this.refrescarVistaActual();
            console.log(`☁️ Sincronización completa: ${added} nuevas, ${removidas} eliminadas (ya no están en la nube), y se actualizaron las existentes.`);
        }
    },

    // --- NUEVO: EDITAR DESCRIPCIÓN DE MATERIA ---
    editarMateriaDescripcion() {
        const nombre = document.getElementById('subject-name-display').innerText;
        const mat = Store.state.materias.find(m => m.nombre === nombre);
        const descActual = mat ? (mat.descripcion || "") : "";
        const nuevaDesc = prompt(`Editar descripción de ${nombre}:`, descActual);
        if (nuevaDesc !== null) {
            Store.updateMateriaDescripcion(nombre, nuevaDesc.trim());
            this.refrescarVistaActual();
        }
    },

    // --- LÓGICA DE FIREBASE Y USUARIOS ---
    authMode: 'login',

    switchAuthMode(mode) {
        this.authMode = mode;
        const isLogin = mode === 'login';
        
        document.getElementById('tab-login').style.background = isLogin ? 'var(--card-bg)' : 'transparent';
        document.getElementById('tab-login').style.color = isLogin ? 'var(--text-main)' : 'var(--text-muted)';
        document.getElementById('tab-login').style.boxShadow = isLogin ? '0 2px 5px rgba(0,0,0,0.1)' : 'none';
        
        document.getElementById('tab-register').style.background = !isLogin ? 'var(--card-bg)' : 'transparent';
        document.getElementById('tab-register').style.color = !isLogin ? 'var(--text-main)' : 'var(--text-muted)';
        document.getElementById('tab-register').style.boxShadow = !isLogin ? '0 2px 5px rgba(0,0,0,0.1)' : 'none';

        document.getElementById('auth-name-group').style.display = isLogin ? 'none' : 'block';
        document.getElementById('auth-subtitle').innerText = isLogin ? 'Ingresa a tu cuenta para continuar' : 'Únete al Top 1% de tu colegio';
        document.getElementById('auth-main-btn').innerText = isLogin ? 'Entrar al Sistema' : 'Crear mi Cuenta';
    },

    async submitAuth() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        const btn = document.getElementById('auth-main-btn');
        clickSound.currentTime = 0;
        clickSound.play();
        if(!email || !pass) return alert("Por favor, llena los campos.");

        const originalText = btn.innerText;
        btn.innerText = "Procesando...";
        btn.disabled = true;

        if (this.authMode === 'login') {
            const res = await Cloud.login(email, pass);
            if(!res.success) alert(res.error);
        } else {
            const nombre = document.getElementById('auth-name').value.trim();
            if(!nombre) {
                alert("Por favor, dinos tu nombre.");
                btn.innerText = originalText;
                btn.disabled = false;
                return;
            }
            const res = await Cloud.register(email, pass, nombre);
            if(!res.success) alert(res.error);
        }

        btn.innerText = originalText;
        btn.disabled = false;
    },

    logout() { if(confirm("¿Seguro que quieres cerrar sesión?")) Cloud.logout(); },

    // --- PANEL ADMIN ---
    switchAdminTab(tab) {
        document.getElementById('tab-admin-users').classList.remove('active');
        document.getElementById('tab-admin-tasks').classList.remove('active');
        document.getElementById('tab-admin-' + tab).classList.add('active');
        
        document.getElementById('admin-users-sec').style.display = tab === 'users' ? 'block' : 'none';
        document.getElementById('admin-tasks-sec').style.display = tab === 'tasks' ? 'block' : 'none';
        
        if (tab === 'users') this.loadAdminUsers();
        if (tab === 'tasks') {
            this.adminTempSubtareas = [];
            this.renderAdminSubtareas();
            this.loadAdminGlobalTasksList();
        }
    },

    async loadAdminUsers() {
        const list = document.getElementById('admin-users-list');
        list.innerHTML = "<p>Cargando alumnos...</p>";
        const users = await Cloud.getAllUsers();
        
        list.innerHTML = users.map(u => `
            <div class="card" style="border-left-color: ${u.role === 'premium' ? '#fbbf24' : (u.role==='admin'?'#ef4444':'#9ca3af')}; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong style="font-size:1.1rem;">${u.nombre}</strong>
                    <span style="font-size:0.8rem; background:#eee; padding:3px 6px; border-radius:4px;">${u.role.toUpperCase()}</span>
                </div>
                <p style="margin:5px 0; font-size:0.85rem; color:var(--text-muted);">${u.email}</p>
                ${u.role === 'premium' ? `<p style="margin:0 0 10px 0; font-size:0.8rem; color:#10b981;">✅ Vence: ${u.premiumHasta}</p>` : ''}
                
                <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
                    <button onclick="app.darPremium('${u.uid}', 7)" style="flex:1; background:#3b82f6; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;">+ 7 Días</button>
                    <button onclick="app.darPremium('${u.uid}', 30)" style="flex:1; background:#fbbf24; color:black; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;">+ 30 Días</button>
                    ${u.role === 'premium' ? `<button onclick="app.quitarPremium('${u.uid}')" style="width:100%; background:#6b7280; color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-user-minus"></i> Quitar Premium</button>` : ''}
                    <button onclick="app.resetDevice('${u.uid}')" style="width:100%; margin-top:5px; background:var(--danger); color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-mobile-alt"></i> Reset Celular</button>
                </div>
            </div>
        `).join('');
    },

    async darPremium(uid, dias) {
        if (confirm(`¿Dar ${dias} días de Premium a este usuario?`)) {
            const nuevaFecha = await Cloud.grantPremium(uid, dias);
            alert(`✅ Premium activado hasta: ${nuevaFecha}`);
            this.loadAdminUsers();
        }
    },

    // NUEVO: Quitar Premium manualmente (vuelve a plan 'free' de inmediato)
    async quitarPremium(uid) {
        if (confirm("¿Quitar Premium a este usuario? Pasará a plan gratuito de inmediato.")) {
            await Cloud.revokePremium(uid);
            alert("✅ Premium removido. El usuario ahora es free.");
            this.loadAdminUsers();
        }
    },
    
    async resetDevice(uid) {
        if (confirm("¿Permitir que este usuario inicie sesión en un celular nuevo?")) {
            await Cloud.resetUserDevice(uid);
            alert("✅ Dispositivo reseteado.");
            this.loadAdminUsers();
        }
    },

    // --- CHECKLIST DEL ADMIN ---
    renderAdminSubtareas() {
        const container = document.getElementById('admin-subtasks-list');
        if (!container) return;
        if (this.adminTempSubtareas.length === 0) {
            container.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted); margin:0;">No hay pasos añadidos aún.</p>';
            return;
        }
        container.innerHTML = this.adminTempSubtareas.map((sub, index) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); padding:10px; border-radius:6px; margin-bottom:5px; border:1px solid var(--border-color);">
                <span style="font-size:0.9rem; color:var(--text-main);">${sub.texto}</span>
                <button onclick="app.eliminarAdminSubtarea(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    },

    agregarAdminSubtarea() {
        const input = document.getElementById('admin-subtask-input');
        const texto = input.value.trim();
        if(texto) {
            this.adminTempSubtareas.push({ texto: texto, completada: false });
            input.value = '';
            this.renderAdminSubtareas();
        }
    },

    eliminarAdminSubtarea(index) {
        this.adminTempSubtareas.splice(index, 1);
        this.renderAdminSubtareas();
    },

    // --- NUEVO: GESTIÓN/BORRADO DE TAREAS GLOBALES ---
    async loadAdminGlobalTasksList() {
        const list = document.getElementById('admin-global-tasks-list');
        if (!list) return;
        list.innerHTML = "<p style='color:var(--text-muted);'>Cargando tareas globales...</p>";

        const tasks = await Cloud.getGlobalTasks();

        if (tasks === null) {
            list.innerHTML = "<p style='color:var(--danger); font-weight:bold;'>📡 Sin conexión: no se pudo cargar la lista.</p>";
            return;
        }
        if (tasks.length === 0) {
            list.innerHTML = "<p style='color:var(--text-muted);'>No hay tareas globales activas en la nube.</p>";
            return;
        }

        list.innerHTML = tasks.map(t => `
            <div class="card" style="margin-bottom:8px; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <div style="overflow:hidden;">
                        <strong style="display:block; overflow:hidden; text-overflow:ellipsis;">${t.titulo}</strong>
                        <p style="margin:3px 0 0; font-size:0.8rem; color:var(--text-muted);">${t.materia} • ${t.tipo} • 📅 ${t.fecha || 'sin fecha'}</p>
                    </div>
                    <button onclick="app.eliminarTareaGlobal('${t.globalId}')" style="flex-shrink:0; background:var(--danger); color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    },

    async eliminarTareaGlobal(globalId) {
        if (!confirm("¿Eliminar esta tarea global? Se quitará de todos los celulares en su próxima sincronización.")) return;
        await Cloud.deleteGlobalTask(globalId);
        this.loadAdminGlobalTasksList();
    },

    async eliminarTodasTareasGlobales() {
        if (!confirm("⚠️ Esto eliminará TODAS las tareas globales de la nube. Todas las cuentas Premium las perderán al sincronizar. ¿Continuar?")) return;
        if (!confirm("Última confirmación: ¿BORRAR TODO de una sola vez? Esta acción no se puede deshacer.")) return;

        const cantidad = await Cloud.deleteAllGlobalTasks();
        alert(`🗑️ Se eliminaron ${cantidad} tareas globales de la nube.`);
        this.loadAdminGlobalTasksList();
    },

    async subirTareaGlobal() {
        const data = {
            titulo: document.getElementById('admin-titulo').value,
            materia: document.getElementById('admin-materia').value,
            tipo: document.getElementById('admin-tipo').value,
            fecha: document.getElementById('admin-fecha').value,
            dificultad: document.getElementById('admin-dificultad').value,
            notas: document.getElementById('admin-notas').value,
            subtareas: this.adminTempSubtareas 
        };
        if(!data.titulo || !data.materia || !data.fecha) return alert("Llena Título, Materia y Fecha.");
        
        await Cloud.addGlobalTask(data);
        alert("☁️ ¡Tarea Inyectada a todos los celulares Premium!");
        
        document.getElementById('admin-titulo').value = '';
        document.getElementById('admin-notas').value = '';
        this.adminTempSubtareas = [];
        this.renderAdminSubtareas();
        this.loadAdminGlobalTasksList();
    },

    // --- PAYWALL Y PERFIL ---
    renderPremium() {
        const statusBox = document.getElementById('premium-status');
        const user = Cloud.userData;

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

        statusBox.innerHTML = `
            <div style="text-align:center; color: var(--text-main);">
                <ul style="text-align:left; list-style:none; padding:15px; margin-bottom:25px; background:var(--card-bg); border-radius:12px; border:1px solid var(--border-color);">
                    <li style="margin-bottom:12px; font-weight:500;"><i class="fas fa-check-circle" style="color:#10b981; margin-right:8px;"></i> ☁️ Tareas automáticas en la nube</li>
                    <li style="margin-bottom:12px; font-weight:500;"><i class="fas fa-check-circle" style="color:#10b981; margin-right:8px;"></i> 📚 Temas detallados de exámenes</li>
                    <li style="margin-bottom:12px; font-weight:500;"><i class="fas fa-check-circle" style="color:#10b981; margin-right:8px;"></i> 🎨 Temas y colores Premium</li>
                    <li style="margin-bottom:12px; font-weight:500;"><i class="fas fa-check-circle" style="color:#10b981; margin-right:8px;"></i> 🛡️ Soporte prioritario</li>
                </ul>
                <div style="background:var(--card-bg); border:2px solid var(--border-color); padding:20px; border-radius:15px; margin-bottom:15px;">
                    <div style="color:var(--text-muted); font-size:0.8rem; font-weight:bold;">PLAN SEMANAL</div>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--text-main);">1.50 S/</div>
                    <div style="color:var(--text-muted); font-size:0.8rem;">7 días de acceso VIP</div>
                </div>
                <div style="background: linear-gradient(135deg, #1e2937, #000); padding:25px; border-radius:15px; border:2px solid #fbbf24; position:relative; color: white;">
                    <div style="position:absolute; top:-12px; right:15px; background:#fbbf24; color:black; font-size:0.7rem; font-weight:bold; padding:4px 10px; border-radius:20px;">MÁS POPULAR</div>
                    <div style="color:#fbbf24; font-size:0.8rem; font-weight:bold;">PLAN MENSUAL</div>
                    <div style="font-size:2.2rem; font-weight:800; color:white;">5.00 S/</div>
                    <div style="color:#aaa; font-size:0.8rem;">30 días (Ahorras 1 Sol)</div>
                </div>
                <button onclick="window.open('https://wa.me/51tnumerodeTlf', '_blank')" style="width:100%; background:var(--primary); color:white; border:none; padding:20px; border-radius:12px; margin-top:25px; font-weight:bold; font-size:1.1rem; cursor:pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                    <i class="fab fa-whatsapp"></i> Activar con Migue
                </button>
            </div>
        `;
    },

    toggleProfileMenu() { document.getElementById('profile-dropdown').classList.toggle('show'); },
    updateProfileUI() {
        const user = Cloud.userData;
        if (!user) return;
        document.getElementById('header-profile-btn').innerText = user.nombre ? user.nombre.charAt(0).toUpperCase() : '?';
        document.getElementById('prof-name').innerText = user.nombre;
        document.getElementById('prof-email').innerText = user.email;
        const badge = document.getElementById('prof-badge');
        badge.className = 'profile-role-badge'; 
        if (user.role === 'admin') { badge.innerText = '🛡️ ADMIN SUPREMO'; badge.classList.add('admin'); } 
        else if (user.role === 'premium') { badge.innerText = '👑 PREMIUM VIP'; badge.classList.add('premium'); } 
        else { badge.innerText = '🛑 PLAN GRATUITO'; badge.classList.add('free'); }
    },

    eliminarMateriaActual() {
        const nombre = document.getElementById('subject-name-display').innerText;
        if (confirm(`¿Estás seguro de eliminar "${nombre}"? Se borrarán todas las tareas.`)) {
            Store.deleteMateria(nombre);
            UI.renderNav(Store.state.materias);
            UI.renderSelectMaterias(Store.state.materias);
            this.showView('dashboard');
        }
        clickSound.currentTime = 0;
        clickSound.play();
    },

    // --- NAVEGACIÓN Y VISTAS ---
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

    // --- FORMULARIO PRIVADO Y CHECKLIST ---
    abrirFormulario(id = null) {
        clickSound.currentTime = 0;
        clickSound.play();
        this.editModeId = id;

        // BINDING DE SEGURIDAD (MIGUE: Esto evita crasheos si hay desfase de sw.js)
        const elTitulo = document.getElementById('titulo');
        const elMateria = document.getElementById('materia-select');
        const elTipo = document.getElementById('tipo-select');
        const elFecha = document.getElementById('fecha-input');
        const elDificultad = document.getElementById('dificultad-select');
        const elNotas = document.getElementById('notas-input');

        if (id) {
            const act = Store.getActividadById(id);
            if (act) {
                if (elTitulo) elTitulo.value = act.titulo || ''; 
                if (elMateria) elMateria.value = act.materia || '';
                if (elTipo) elTipo.value = act.tipo || 'Tarea'; 
                if (elFecha) elFecha.value = act.fecha || '';
                if (elDificultad) elDificultad.value = act.dificultad || 'Medio'; 
                if (elNotas) elNotas.value = act.notas || '';
                this.tempSubtareas = act.subtareas ? [...act.subtareas] : [];
            }
        } else {
            if (elTitulo) elTitulo.value = ''; 
            if (elFecha) elFecha.value = ''; 
            if (elNotas) elNotas.value = '';
            if (this.vistaAnterior !== 'dashboard' && this.vistaAnterior !== 'aspecto' && this.vistaAnterior !== 'premium' && this.vistaAnterior !== 'admin') {
                if (elMateria) elMateria.value = this.vistaAnterior;
            }
            this.tempSubtareas = [];
        }
        this.renderFormSubtareas();
        this.showView('form');
    },

    renderFormSubtareas() {
        const container = document.getElementById('form-subtasks-list');
        if (!container) return;
        if (this.tempSubtareas.length === 0) {
            container.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted); margin:0;">No hay pasos añadidos aún.</p>';
            return;
        }
        container.innerHTML = this.tempSubtareas.map((sub, index) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); padding:10px; border-radius:6px; margin-bottom:5px; border:1px solid var(--border-color);">
                <span style="font-size:0.9rem; color:var(--text-main);">${sub.texto}</span>
                <button onclick="app.eliminarSubtareaForm(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    },

    agregarSubtareaForm() {
        clickSound.currentTime = 0;
        clickSound.play();
        const input = document.getElementById('form-subtask-input');
        const texto = input.value.trim();
        if(texto) {
            this.tempSubtareas.push({ texto: texto, completada: false });
            input.value = '';
            this.renderFormSubtareas();
        }
    },

    eliminarSubtareaForm(index) {
        clickSound.currentTime = 0;
        clickSound.play();
        this.tempSubtareas.splice(index, 1);
        this.renderFormSubtareas();
    },

    cerrarFormulario() {
        clickSound.currentTime = 0;
        clickSound.play();
        if (['dashboard', 'aspecto', 'premium', 'admin'].includes(this.vistaAnterior)) this.showView('dashboard');
        else this.showView('subject', this.vistaAnterior);
    },

    guardarActividad() {
        clickSound.currentTime = 0;
        clickSound.play();
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
            subtareas: this.tempSubtareas
        };
        Store.guardarActividad(data, this.editModeId);
        this.cerrarFormulario(); 
        this.refrescarVistaActual();
    },

    // --- ACCIONES GENERALES ---
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
                clapsSound.play();
                setTimeout(() => {
                    const nota = prompt(`¡Examen finalizado! ¿Nota? (0-20, AD, A)`);
                    if(nota) { Store.setCalificacion(id, nota); this.refrescarVistaActual(); }
                }, 800);
            }
        } else { Store.setCompletada(id, false); deleteSound.currentTime = 0; deleteSound.play(); }
        this.refrescarVistaActual();
    },

    lanzarDopamina() {
        try { popSound.currentTime= 0; popSound.play(); } catch(e) {console.log("No se pudo reproducir")}
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
    renderSubjectDetail(m) { UI.renderSubjectDetail(Store.getSubjectActividades(m, this.materiaFiltroCompletadas), Store.state.materias); },
    
    refrescarVistaActual() {
        if (['dashboard', 'aspecto', 'premium', 'admin'].includes(this.vistaAnterior)) this.realizarBusqueda();
        else this.renderSubjectDetail(document.getElementById('subject-name-display').innerText);
    },

    // --- SISTEMA DE ARCHIVOS (MODALES) ---
    openModal(modalId) {
        document.getElementById('modal-overlay').classList.add('show');
        document.querySelectorAll('.modal-card').forEach(c => c.style.display = 'none');
        document.getElementById(modalId).style.display = 'block';
        this.toggleProfileMenu(true);
    },

    closeModal() { document.getElementById('modal-overlay').classList.remove('show'); },
    exportarDatos() { this.openModal('modal-export'); },
    importarDatos() { this.openModal('modal-import'); },

    confirmarExportar() {
        const filename = document.getElementById('export-filename').value.trim() || 'TopSchool_Backup';
        const json = Store.getExportJSON();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        this.closeModal();
    },

    confirmarImportar() {
        const fileInput = document.getElementById('import-file');
        const overwrite = document.getElementById('import-overwrite').checked;
        if (!fileInput.files.length) return alert("Selecciona un archivo .json primero.");
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            if (Store.importFromJSON(e.target.result, overwrite)) {
                this.closeModal();
                this.cambiarTema(localStorage.getItem('top1_theme') || 'default');
                UI.renderNav(Store.state.materias); UI.renderSelectMaterias(Store.state.materias);
                this.showView('dashboard');
                alert("✅ ¡Datos importados correctamente!");
            } else { alert("❌ Error: Archivo corrupto o no compatible."); }
        };
        reader.readAsText(file);
    },

    // Sincronización masiva de plantillas
    async subirMasterJSON() {
        const fileInput = document.getElementById('admin-master-file');
        if (!fileInput.files.length) return alert("Selecciona el archivo JSON primero.");
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.actividades || !data.materias) throw new Error("JSON Inválido");
                
                await Cloud.uploadMasterTasks(data.actividades);
                await Cloud.uploadMasterSubjects(data.materias);

                alert("☁️ ¡ARCHIVO MAESTRO SUBIDO! Sincronización masiva completada.");
                fileInput.value = '';
                this.loadAdminGlobalTasksList();
            } catch (err) { alert("❌ Error procesando el JSON maestro."); }
        };
        reader.readAsText(file);
    }
};

window.app = App;
document.addEventListener('DOMContentLoaded', () => App.init());

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
}

let deferredPrompt;

const isIOS = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
};

const isStandalone = () => {
    return (window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone) || document.referrer.includes('android-app://');
};

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    if (!isStandalone()) {
        const installZone = document.getElementById('pwa-install-zone');
        const profileBtn = document.getElementById('profile-install-btn');
        
        if(installZone) installZone.style.display = 'block';
        if(profileBtn) profileBtn.style.display = 'flex';
    }
});

const installApp = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('✅ El usuario aceptó la instalación');
            document.getElementById('pwa-install-zone').style.display = 'none';
            document.getElementById('profile-install-btn').style.display = 'none';
        }
        deferredPrompt = null;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const mainBtn = document.getElementById('pwa-install-btn');
    const profBtn = document.getElementById('profile-install-btn');
    
    if(mainBtn) mainBtn.addEventListener('click', installApp);
    if(profBtn) profBtn.addEventListener('click', installApp);

    if (isIOS() && !isStandalone()) {
        const iosZone = document.getElementById('ios-install-zone');
        if(iosZone) iosZone.style.display = 'block';
    }
});

document.addEventListener('click', (e) => {
    const btn = document.getElementById('header-profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    if (btn && dropdown) {
        if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    }
});