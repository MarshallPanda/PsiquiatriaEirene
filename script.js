import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, getDocs, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCTquDBYf4unSX1HFdlreyIr6_23zbbV1c",
  authDomain: "eirele-psicologica.firebaseapp.com",
  projectId: "eirele-psicologica",
  storageBucket: "eirele-psicologica.firebasestorage.app",
  messagingSenderId: "742536880237",
  appId: "1:742536880237:web:7f064ffbfd2d784e6e5f64"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CARGA DINÁMICA DE DOCTORES DESDE FIRESTORE ---
async function cargarPsicologosDisponibles() {
    const contenedor = document.getElementById('contenedorPsicologos');
    
    try {
        const querySnapshot = await getDocs(collection(db, "psicologos"));
        contenedor.innerHTML = ''; 

        if (querySnapshot.empty) {
            contenedor.innerHTML = '<p style="text-align:center; width:100%;">Actualmente no hay especialistas disponibles.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            if (data.nombre && data.especialidad) {
                const label = document.createElement('label');
                label.className = 'psicologo-card';
                
                const diasLabel = data.dias_atencion && data.dias_atencion.length > 0 ? data.dias_atencion.join(', ') : 'Días por confirmar';
                const horasLabel = data.hora_inicio && data.hora_fin ? `${data.hora_inicio} - ${data.hora_fin}` : 'Horario a coordinar';

                // --- LÓGICA DE FOTO DE PERFIL ---
                // 1. Imagen genérica de respaldo
                const urlPorDefecto = "https://images.unsplash.com/photo-1594824436951-7f12620cecef?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80";
                
                // 2. Extraemos la URL de Firestore. Si está vacía, usamos el respaldo.
                const imgUrl = (data.foto_url && data.foto_url.trim() !== "") ? data.foto_url : urlPorDefecto;

                // 3. El atributo onerror="this.src='...'" actúa como salvavidas si el link falla.
                label.innerHTML = `
                    <input type="radio" name="doctor" value="${data.nombre}" required>
                    <div class="card-content glass-card">
                        <img src="${imgUrl}" alt="Foto de ${data.nombre}" onerror="this.src='${urlPorDefecto}'">
                        <h4>${data.nombre}</h4>
                        <span class="especialidad">${data.especialidad}</span>
                        <p style="font-size: 0.8rem; margin-top: 10px; color: #555; line-height: 1.4;">
                            🕒 <strong>${horasLabel}</strong><br>
                            📅 ${diasLabel}
                        </p>
                    </div>
                `;
                contenedor.appendChild(label);
            }
        });
        
        if(contenedor.innerHTML === '') {
             contenedor.innerHTML = '<p style="text-align:center; width:100%;">Los especialistas están configurando sus horarios.</p>';
        }

    } catch (error) {
        console.error("Error cargando psicólogos:", error);
        contenedor.innerHTML = '<p style="color:red; text-align:center; width:100%;">Error al conectar con los servidores.</p>';
    }
}
document.addEventListener('DOMContentLoaded', cargarPsicologosDisponibles);


// --- WIZARD NAVEGACIÓN ---
function goToStep(step) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step-indicator').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    document.getElementById(`ind-${step}`).classList.add('active');
}

document.getElementById('btn-next-1').addEventListener('click', () => {
    const docSeleccionado = document.querySelector('input[name="doctor"]:checked');
    if (!docSeleccionado) return alert("Por favor, selecciona un especialista.");
    goToStep(2);
});

document.getElementById('btn-next-2').addEventListener('click', () => {
    if (!document.getElementById('fecha').value || !document.getElementById('hora').value) {
        return alert("Por favor, selecciona fecha y hora.");
    }
    goToStep(3);
});

document.getElementById('btn-prev-2').addEventListener('click', () => goToStep(1));
document.getElementById('btn-prev-3').addEventListener('click', () => goToStep(2));


// --- CREAR CITA ---
document.getElementById('citaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.innerText = 'Guardando...'; btnSubmit.disabled = true;

    const datosCita = {
        doctor: document.querySelector('input[name="doctor"]:checked').value,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value,
        nombre: document.getElementById('nombre').value,
        email: document.getElementById('email').value,
        telefono: document.getElementById('telefono').value,
        estado: 'Pendiente', 
        creadoEn: serverTimestamp()
    };

    try {
        const docRef = await addDoc(collection(db, "citas"), datosCita);
        document.getElementById('step-3').classList.remove('active');
        document.getElementById('resultadoCita').classList.remove('hidden');
        document.getElementById('codigoUnico').innerText = docRef.id;
        document.getElementById('citaForm').reset();
    } catch (error) {
        alert('Problema de comunicación con Firestore.');
    } finally {
        btnSubmit.innerText = 'Confirmar Reserva'; btnSubmit.disabled = false;
    }
});


// --- SEGUIMIENTO DE CITAS ---
document.getElementById('trackingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('codigoBuscar').value.trim();
    const btnBuscar = document.getElementById('btnBuscar');
    const panelResultado = document.getElementById('resultadoTracking');
    const panelError = document.getElementById('errorTracking');

    btnBuscar.innerText = 'Buscando...'; btnBuscar.disabled = true;
    panelResultado.classList.add('hidden'); panelError.classList.add('hidden');

    try {
        const snapshot = await getDoc(doc(db, "citas", codigo));
        if (snapshot.exists()) {
            const data = snapshot.data();
            document.getElementById('trackNombre').innerText = data.nombre;
            document.getElementById('trackDoctor').innerText = data.doctor;
            document.getElementById('trackFecha').innerText = data.fecha;
            document.getElementById('trackHora').innerText = data.hora;

            const estadoBadge = document.getElementById('trackEstado');
            estadoBadge.innerText = data.estado;
            estadoBadge.className = 'status-badge'; 

            const est = data.estado.toLowerCase();
            if (est === 'pendiente') estadoBadge.classList.add('badge-pendiente');
            else if (est === 'confirmada') estadoBadge.classList.add('badge-confirmada');
            else if (est === 'cancelada') estadoBadge.classList.add('badge-cancelada');

            panelResultado.classList.remove('hidden');
        } else {
            panelError.classList.remove('hidden');
        }
    } catch (err) { alert("Error al buscar el código."); } 
    finally { btnBuscar.innerText = 'Consultar Estado'; btnBuscar.disabled = false; }
});