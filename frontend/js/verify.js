const API_URL = 'https://iweather.onrender.com';
document.addEventListener('DOMContentLoaded', async () => {
    const messageEl = document.getElementById('verify-message');
    const loginLink = document.getElementById('login-link');

    try {
        // 1. Obtenemos el "token" de la URL
        // (ej. ...?token=XXXXXX)
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
            throw new Error('No se proporcionó un token de verificación.');
        }

        // 2. Enviamos el token a nuestra NUEVA ruta del backend
        const response = await fetch(`${API_URL}/api/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: token })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al verificar el token');
        }

        // 3. ¡Éxito!
        messageEl.textContent = data.mensaje; // "¡Cuenta verificada exitosamente!"
        messageEl.style.color = 'lightgreen';
        loginLink.style.display = 'block'; // Mostramos el enlace a Login

    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.style.color = 'pink';
        loginLink.style.display = 'block'; // Mostramos el enlace a Login
    }
});