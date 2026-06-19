import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, getDocs, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuramos las credenciales de Firebase directamente en el archivo
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

let psicologosData = {};

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
                // Guardamos los horarios para la validación del paso 2
                psicologosData[data.nombre] = {
                    dias: data.dias_atencion && data.dias_atencion.length > 0 ? data.dias_atencion : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
                    inicio: data.hora_inicio || "08:00",
                    fin: data.hora_fin || "20:00"
                };

                const label = document.createElement('label');
                label.className = 'psicologo-card';
                const diasLabel = psicologosData[data.nombre].dias.join(', ');
                const horasLabel = `${psicologosData[data.nombre].inicio} - ${psicologosData[data.nombre].fin}`;
                
                // Lógica de Foto de Perfil con fallback
                const urlPorDefecto = "https://images.unsplash.com/photo-1594824436951-7f12620cecef?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80";
                const imgUrl = (data.foto_url && data.foto_url.trim() !== "") ? data.foto_url : urlPorDefecto;

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

// Iniciar carga automáticamente
document.addEventListener('DOMContentLoaded', cargarPsicologosDisponibles);


// --- WIZARD NAVEGACIÓN Y VALIDACIONES ESTRICTAS ---
function goToStep(step) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step-indicator').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    document.getElementById(`ind-${step}`).classList.add('active');
}

// Del Paso 1 al Paso 2: Preparar Calendario
document.getElementById('btn-next-1').addEventListener('click', () => {
    const docSeleccionado = document.querySelector('input[name="doctor"]:checked');
    if (!docSeleccionado) return alert("Por favor, selecciona un especialista para continuar.");
    
    const infoDoctor = psicologosData[docSeleccionado.value];
    
    // Muestra alerta visual para el paciente
    document.getElementById('horarioHint').innerHTML = `💡 Horario de ${docSeleccionado.value}:<br><strong>${infoDoctor.dias.join(', ')}</strong> de <strong>${infoDoctor.inicio}</strong> a <strong>${infoDoctor.fin}</strong>`;
    
    // Bloquear fechas pasadas en el selector nativo
    const inputFecha = document.getElementById('fecha');
    const hoy = new Date();
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    inputFecha.min = hoy.toISOString().split('T')[0];

    // Limites de tiempo en el selector nativo
    const inputHora = document.getElementById('hora');
    inputHora.min = infoDoctor.inicio;
    inputHora.max = infoDoctor.fin;

    goToStep(2);
});

// Del Paso 2 al Paso 3: Validación Matemática
document.getElementById('btn-next-2').addEventListener('click', () => {
    const fechaVal = document.getElementById('fecha').value;
    const horaVal = document.getElementById('hora').value;
    if (!fechaVal || !horaVal) return alert("Por favor, selecciona fecha y hora.");

    const doctorNombre = document.querySelector('input[name="doctor"]:checked').value;
    const infoDoctor = psicologosData[doctorNombre];

    // Verificar Día de la Semana
    const [year, month, day] = fechaVal.split('-');
    const dateObj = new Date(year, month - 1, day); 
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const nombreDiaElegido = diasSemana[dateObj.getDay()];

    if (!infoDoctor.dias.includes(nombreDiaElegido)) {
        return alert(`❌ El especialista no atiende los días ${nombreDiaElegido}.\n\nPor favor elige uno de estos días: ${infoDoctor.dias.join(', ')}.`);
    }

    // Verificar Rango Horario
    if (horaVal < infoDoctor.inicio || horaVal > infoDoctor.fin) {
        return alert(`❌ La hora seleccionada (${horaVal}) está fuera del turno del especialista.\n\nHorario permitido: de ${infoDoctor.inicio} a ${infoDoctor.fin}.`);
    }

    goToStep(3);
});

document.getElementById('btn-prev-2').addEventListener('click', () => goToStep(1));
document.getElementById('btn-prev-3').addEventListener('click', () => goToStep(2));


// --- CREAR CITA (ENVÍO A FIRESTORE) ---
document.getElementById('citaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.innerText = 'Guardando en Base de Datos...'; 
    btnSubmit.disabled = true;

    const datosCita = {
        doctor: document.querySelector('input[name="doctor"]:checked').value,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value,
        nombre: document.getElementById('nombre').value,
        dni: document.getElementById('dni').value,
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
        console.error(error);
        alert('Problema de comunicación con Firestore. Intenta nuevamente.');
    } finally {
        btnSubmit.innerText = 'Confirmar Reserva'; 
        btnSubmit.disabled = false;
    }
});

// --- MÓDULO DE SEGUIMIENTO ---
document.getElementById('trackingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('codigoBuscar').value.trim();
    const btnBuscar = document.getElementById('btnBuscar');
    const panelResultado = document.getElementById('resultadoTracking');
    const panelError = document.getElementById('errorTracking');

    btnBuscar.innerText = 'Buscando en sistema...'; 
    btnBuscar.disabled = true;
    panelResultado.classList.add('hidden'); 
    panelError.classList.add('hidden');

    try {
        const snapshot = await getDoc(doc(db, "citas", codigo));
        
        if (snapshot.exists()) {
            const data = snapshot.data();
            document.getElementById('trackNombre').innerText = data.nombre;
            document.getElementById('trackDni').innerText = data.dni || 'No registrado';
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
    } catch (err) { 
        console.error(err);
        alert("Error al buscar el código en el servidor."); 
    } finally { 
        btnBuscar.innerText = 'Consultar Estado'; 
        btnBuscar.disabled = false; 
    }
});