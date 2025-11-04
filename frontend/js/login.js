const API_URL = 'https://iweather.onrender.com';
// --- FUNCIÓN GLOBAL DE GOOGLE (¡DEBE ESTAR AFUERA!) ---

// Esta es la función 'callback' que Google busca
async function handleGoogleLogin(response) { // <-- 1. El parámetro 'response' de Google
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = 'Verificando con Google...';
    messageEl.style.color = 'white';
    
    try {
        // ¡ARREGLADO! Renombramos la variable a 'res'
        const res = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Ahora 'response.credential' usa el parámetro de Google (correcto)
            body: JSON.stringify({ credential: response.credential }) 
        });
        
        // ¡ARREGLADO! Usamos 'res.json()'
        const data = await res.json();
        
        // ¡ARREGLADO! Usamos 'res.ok'
        if (!res.ok) {
            throw new Error(data.mensaje || 'Error en el login con Google');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', data.email);
        messageEl.style.color = 'lightgreen';
        messageEl.textContent = `¡Bienvenido, ${data.email}! Redirigiendo...`;

        setTimeout(() => {
            // ¡ARREGLADO! Usamos la ruta absoluta
            window.location.href = 'index.html'; 
        }, 1500);

    } catch (error) {
        messageEl.style.color = 'pink';
        messageEl.textContent = error.message;
    }
}


// --- LÓGICA PRINCIPAL DE LA PÁGINA (Dentro del DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTabBtn = document.getElementById('login-tab-btn');
    const registerTabBtn = document.getElementById('register-tab-btn');
    const messageEl = document.getElementById('auth-message');

    // --- Lógica de TABS ---
    loginTabBtn.addEventListener('click', () => {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        loginTabBtn.classList.add('active');
        registerTabBtn.classList.remove('active');
        messageEl.textContent = '';
    });

    registerTabBtn.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        loginTabBtn.classList.remove('active');
        registerTabBtn.classList.add('active');
        messageEl.textContent = '';
    });

    // --- Lógica de REGISTRO ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        messageEl.textContent = '';

        try {
                const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.mensaje || 'Error en el registro');
            }
            messageEl.style.color = 'lightgreen';
            messageEl.textContent = data.mensaje;
            registerForm.reset();
        } catch (error) {
            messageEl.style.color = 'pink';
            messageEl.textContent = error.message;
        }
    });

    // --- Lógica de LOGIN ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        messageEl.textContent = '';
    
        try {
                const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.mensaje || 'Error al iniciar sesión');
            }
            localStorage.setItem('token', data.token);
            localStorage.setItem('userEmail', data.email);
            messageEl.style.color = 'lightgreen';
            messageEl.textContent = `¡Bienvenido, ${data.email}! Redirigiendo...`;
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            messageEl.style.color = 'pink';
            messageEl.textContent = error.message;
        }
    });
});