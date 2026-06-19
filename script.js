import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. VINCULACIÓN DIRECTA CON TUS CREDENCIALES DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCTquDBYf4unSX1HFdlreyIr6_23zbbV1c",
  authDomain: "eirele-psicologica.firebaseapp.com",
  projectId: "eirele-psicologica",
  storageBucket: "eirele-psicologica.firebasestorage.app",
  messagingSenderId: "742536880237",
  appId: "1:742536880237:web:7f064ffbfd2d784e6e5f64"
};

// Inicialización
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. NAVEGACIÓN ASISTENTE DE PASOS (WIZARD)
function goToStep(step) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step-indicator').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`step-${step}`).classList.add('active');
    document.getElementById(`ind-${step}`).classList.add('active');
}

document.getElementById('btn-next-1').addEventListener('click', () => {
    const docSeleccionado = document.querySelector('input[name="doctor"]:checked');
    if (!docSeleccionado) {
        alert("Por favor, selecciona un especialista para continuar.");
        return;
    }
    goToStep(2);
});

document.getElementById('btn-next-2').addEventListener('click', () => {
    const fecha = document.getElementById('fecha').value;
    const hora = document.getElementById('hora').value;
    if (!fecha || !hora) {
        alert("Por favor, determina la fecha y hora necesarias.");
        return;
    }
    goToStep(3);
});

document.getElementById('btn-prev-2').addEventListener('click', () => goToStep(1));
document.getElementById('btn-prev-3').addEventListener('click', () => goToStep(2));


// 3. REGISTRO DE RESERVA EN FIRESTORE
document.getElementById('citaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.innerText = 'Guardando en Base de Datos...';
    btnSubmit.disabled = true;

    // Recopilación incluyendo el nuevo campo de teléfono
    const datosCita = {
        doctor: document.querySelector('input[name="doctor"]:checked').value,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value,
        nombre: document.getElementById('nombre').value,
        email: document.getElementById('email').value,
        telefono: document.getElementById('telefono').value, // <-- Guardado de teléfono
        estado: 'Pendiente', 
        creadoEn: serverTimestamp()
    };

    try {
        // Enviar a la colección "citas"
        const docRef = await addDoc(collection(db, "citas"), datosCita);
        
        // Bloquear UI y presentar el código único real (ID de Firestore)
        document.getElementById('step-3').classList.remove('active');
        document.getElementById('resultadoCita').classList.remove('hidden');
        document.getElementById('codigoUnico').innerText = docRef.id;

        document.getElementById('citaForm').reset();

    } catch (error) {
        console.error("Error al registrar: ", error);
        alert('Problema de comunicación con Firestore. Revisa tu consola.');
    } finally {
        btnSubmit.innerText = 'Confirmar Reserva';
        btnSubmit.disabled = false;
    }
});


// 4. MÓDULO DE SEGUIMIENTO EN TIEMPO REAL PARA EL CLIENTE
document.getElementById('trackingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const codigo = document.getElementById('codigoBuscar').value.trim();
    const btnBuscar = document.getElementById('btnBuscar');
    const panelResultado = document.getElementById('resultadoTracking');
    const panelError = document.getElementById('errorTracking');

    // Resetear estados visuales
    btnBuscar.innerText = 'Buscando en EIRENE...';
    btnBuscar.disabled = true;
    panelResultado.classList.add('hidden');
    panelError.classList.add('hidden');

    try {
        // Apuntar directamente al documento mediante su ID único
        const citaDocRef = doc(db, "citas", codigo);
        const snapshot = await getDoc(citaDocRef);

        if (snapshot.exists()) {
            const data = snapshot.data();

            // Inyectar datos en la interfaz
            document.getElementById('trackNombre').innerText = data.nombre;
            document.getElementById('trackTelefono').innerText = data.telefono || 'No registrado';
            document.getElementById('trackDoctor').innerText = data.doctor;
            document.getElementById('trackFecha').innerText = data.fecha;
            document.getElementById('trackHora').innerText = data.hora;

            // Manejar las clases de color del Estado dinámicamente
            const estadoBadge = document.getElementById('trackEstado');
            estadoBadge.innerText = data.estado;
            estadoBadge.className = 'status-badge'; // Limpiar clases

            const estadoLimpio = data.estado.toLowerCase();
            if (estadoLimpio === 'pendiente') {
                estadoBadge.classList.add('badge-pendiente');
            } else if (estadoLimpio === 'confirmada' || estadoLimpio === 'aceptada') {
                estadoBadge.classList.add('badge-confirmada');
            } else if (estadoLimpio === 'cancelada') {
                estadoBadge.classList.add('badge-cancelada');
            } else {
                estadoBadge.classList.add('badge-pendiente');
            }

            // Mostrar resultados
            panelResultado.classList.remove('hidden');
        } else {
            // El ID no existe en Firestore
            panelError.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Error en el rastreo: ", err);
        alert("Ocurrió un error al conectar con los servidores de la base de datos.");
    } finally {
        btnBuscar.innerText = 'Consultar Estado';
        btnBuscar.disabled = false;
    }
});