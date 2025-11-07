// ¡IMPORTANTE!
// Define la URL de tu backend.
// Usa 'http://localhost:3000' para tus pruebas locales.
// Usa 'https://iweather.onrender.com' (tu URL de Render) antes de subir a GitHub.
const API_URL = 'https://iweather.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const forgotForm = document.getElementById('forgot-form');
    const messageEl = document.getElementById('auth-message');
    const emailInput = document.getElementById('email');
    const submitButton = forgotForm.querySelector('button');

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        messageEl.textContent = 'Enviando...';
        messageEl.style.color = 'white';
        submitButton.disabled = true; // Deshabilitar el botón

        try {
            const email = emailInput.value;

            // Esta es la ruta que construiremos en el backend
            const response = await fetch(`${API_URL}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.mensaje || 'Error al enviar el correo');
            }

            // ¡Éxito!
            messageEl.style.color = 'lightgreen';
            messageEl.textContent = data.mensaje; 
            emailInput.value = ''; // Limpiar el input

        } catch (error) {
            messageEl.style.color = 'pink';
            messageEl.textContent = error.message;
        } finally {
            submitButton.disabled = false; // Volver a habilitar el botón
        }
    });
});