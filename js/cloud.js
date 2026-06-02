import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAE49hGAMj5ZnoOtN1tZjNilbUrGnZS2WM",
  authDomain: "systemtopschool.firebaseapp.com",
  projectId: "systemtopschool",
  storageBucket: "systemtopschool.firebasestorage.app",
  messagingSenderId: "62319474811",
  appId: "1:62319474811:web:531ea1056b30846d000ade"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const Cloud = {
    user: null, userData: null,

    getDeviceId() {
        let deviceId = localStorage.getItem('top1_device_id');
        if (!deviceId) { deviceId = Math.random().toString(36).substring(2, 15); localStorage.setItem('top1_device_id', deviceId); }
        return deviceId;
    },
    
    
    
    initAuth(onLogin, onLogout) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const hoy = new Date().toISOString().split('T')[0];
                const localData = localStorage.getItem('top1_user_data');
                
                if (localData) {
                    let parsedData = JSON.parse(localData);
                    if (parsedData.role === 'premium' && parsedData.premiumHasta && hoy > parsedData.premiumHasta) {
                        parsedData.role = 'free'; localStorage.setItem('top1_user_data', JSON.stringify(parsedData));
                    }
                    this.user = user; this.userData = parsedData; onLogin(this.userData);
                }

                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        let data = docSnap.data();
                        if (!data.deviceId || data.deviceId === "") {
                            await updateDoc(docRef, { deviceId: this.getDeviceId() }); data.deviceId = this.getDeviceId();
                        } else if (data.deviceId !== this.getDeviceId()) {
                            alert("🚨 ACCESO DENEGADO: Cuenta vinculada a otro celular."); await this.logout(); return;
                        }
                        if (data.role === 'premium' && data.premiumHasta && hoy > data.premiumHasta) {
                            await updateDoc(docRef, { role: 'free' }); data.role = 'free'; alert("🛑 Tu suscripción Premium ha caducado.");
                        }
                        this.user = user; this.userData = data;
                        localStorage.setItem('top1_user_data', JSON.stringify(data));
                        if (!localData) onLogin(data);
                    }
                } catch (error) { console.log("☁️ Modo Offline"); }
            } else {
                this.user = null; this.userData = null; localStorage.removeItem('top1_user_data'); onLogout();
            }
        });
    },

    async register(email, password, nombre) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, "users", userCredential.user.uid), { email, nombre, role: "free", deviceId: this.getDeviceId(), premiumHasta: null });
            return { success: true };
        } catch (error) { return { success: false, error: error.message }; }
    },
    async login(email, password) {
        try { await signInWithEmailAndPassword(auth, email, password); return { success: true }; } 
        catch (error) { return { success: false, error: "Correo/Contraseña incorrectos." }; }
    },
    async logout() { await signOut(auth); },

    async getAllUsers() {
        try {
            const snapshot = await getDocs(collection(db, "users"));
            const users = []; snapshot.forEach(doc => users.push({ uid: doc.id, ...doc.data() })); return users;
        } catch (error) { return []; }
    },

    async grantPremium(uid, dias) {
        const docRef = doc(db, "users", uid);
        const vencimiento = new Date(); vencimiento.setDate(vencimiento.getDate() + dias);
        const fechaStr = vencimiento.toISOString().split('T')[0];
        await updateDoc(docRef, { role: 'premium', premiumHasta: fechaStr });
        return fechaStr;
    },

    async addGlobalTask(taskData) { await addDoc(collection(db, "globalTasks"), taskData); },

    // SUBIDA MASIVA ANTI DUPLICADOS
    async uploadMasterTasks(tasksArray) {
        const batch = writeBatch(db);
        tasksArray.forEach(task => {
            const docRef = doc(db, "globalTasks", String(task.id)); 
            batch.set(docRef, task);
        });
        await batch.commit();
    },

    async getGlobalTasks() {
        try {
            const snapshot = await getDocs(collection(db, "globalTasks"));
            const tasks = []; snapshot.forEach(doc => tasks.push({ globalId: doc.id, ...doc.data() })); return tasks;
        } catch (error) { return []; }
    }
};