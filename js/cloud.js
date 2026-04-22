import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    user: null,
    userData: null,

    // Genera una huella única para el celular
    getDeviceId() {
        let deviceId = localStorage.getItem('top1_device_id');
        if (!deviceId) {
            deviceId = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('top1_device_id', deviceId);
        }
        return deviceId;
    },

    // Iniciar el sistema de vigilancia
    initAuth(onLogin, onLogout) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    // SEGURIDAD ANTI-GORRONES
                    if (data.deviceId !== this.getDeviceId()) {
                        alert("🚨 ACCESO DENEGADO: Esta cuenta ya está vinculada a otro celular. Habla con el Administrador.");
                        await this.logout();
                        return;
                    }

                    this.user = user;
                    this.userData = data;
                    onLogin(data);
                }
            } else {
                this.user = null;
                this.userData = null;
                onLogout();
            }
        });
    },

    async register(email, password, nombre) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Guardar al usuario en la base de datos (Gratis por defecto)
            await setDoc(doc(db, "users", user.uid), {
                email: email,
                nombre: nombre,
                role: "free", // "free", "premium" o "admin"
                deviceId: this.getDeviceId(),
                premiumHasta: null
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: "Correo o contraseña incorrectos." };
        }
    },

    async logout() {
        await signOut(auth);
    }
};
