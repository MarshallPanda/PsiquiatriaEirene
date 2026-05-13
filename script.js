// Mostrar el formulario después de seleccionar al psicólogo
document.getElementById('btn-encuentra').addEventListener('click', () => {
    const seleccionado = document.querySelector('input[name="doctor"]:checked');
    if (!seleccionado) {
        alert('Por favor, selecciona a un psicólogo primero.');
        return;
    }
    document.getElementById('formulario-datos').classList.remove('hidden');
    document.getElementById('btn-encuentra').classList.add('hidden');
});

// Enviar los datos
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzrq3cGAhBvYD9ynoNOXZ6gI6pTtUbSxr9MRHjkCUEKyI6O5cF6E5gVm-MvvJ3jGTT9pw/exec';

document.getElementById('citaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('btnSubmit');
    btn.innerText = 'Generando Cartilla de Reserva...';
    btn.disabled = true;

    const data = {
        nombre: document.getElementById('nombre').value,
        email: document.getElementById('email').value,
        doctor: document.querySelector('input[name="doctor"]:checked').value,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        const result = await response.json();

        if(result.status === 'success') {
            document.getElementById('formulario-datos').classList.add('hidden');
            document.querySelector('.psicologos-selector').classList.add('hidden');
            document.getElementById('resultadoCita').classList.remove('hidden');
            document.getElementById('codigoUnico').innerText = result.id; 
        }
    } catch (error) {
        alert('Error al conectar. Revisa tu conexión.');
        console.error(error);
    } finally {
        btn.innerText = 'Generar Reserva';
        btn.disabled = false;
    }
});