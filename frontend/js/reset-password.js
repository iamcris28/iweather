// ¡IMPORTANTE! Define la URL de tu backend.
const API_URL = 'https://iweather.onrender.com'; // Usa tu URL de Render para producción https://iweather.onrender.com

document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('reset-form');
    const messageEl = document.getElementById('auth-message');
    const newPasswordEl = document.getElementById('new-password');
    const confirmPasswordEl = document.getElementById('confirm-password');
    const submitButton = resetForm.querySelector('button');

    // 1. Obtener el token de la URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        messageEl.textContent = 'Error: Enlace de reseteo inválido o faltante.';
        messageEl.style.color = 'pink';
        submitButton.disabled = true;
    }

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = newPasswordEl.value;
        const confirmPassword = confirmPasswordEl.value;

        // 2. Validar contraseñas
        if (newPassword.length < 6) {
             messageEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
             messageEl.style.color = 'pink';
             return;
        }
        if (newPassword !== confirmPassword) {
            messageEl.textContent = 'Las contraseñas no coinciden.';
            messageEl.style.color = 'pink';
            return;
        }

        messageEl.textContent = 'Actualizando...';
        messageEl.style.color = 'white';
        submitButton.disabled = true;

        try {
            // 3. Llamar al backend con el token y la nueva contraseña
            const response = await fetch(`${API_URL}/api/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, newPassword: newPassword })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.mensaje || 'Error al actualizar');
            }

            // ¡Éxito!
            messageEl.style.color = 'lightgreen';
            messageEl.textContent = data.mensaje;
            resetForm.reset();

        } catch (error) {
            messageEl.style.color = 'pink';
            messageEl.textContent = error.message;
            submitButton.disabled = false;
        }
    });
});