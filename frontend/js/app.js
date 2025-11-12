/*
 * =================================
 * CONFIGURACIÓN GLOBAL
 * =================================
 */

// API_URL define a qué servidor backend le hablamos.
// - Usa 'http://localhost:3000' para tus pruebas locales.
// - Usa 'https://iweather.onrender.com' (tu URL de Render) para producción (cuando subes a GitHub).
const API_URL = 'http://localhost:3000'; 

// --- Variables Globales ---
let currentCity = '';
let currentChart = null;
let currentMap = null;


/*
 * =================================
 * FUNCIÓN GLOBAL DE LOGIN DE GOOGLE
 * =================================
 * Esta función DEBE estar aquí, en el ámbito global (fuera del DOMContentLoaded),
 * porque el script de Google la buscará por su nombre ('handleGoogleLogin')
 */
async function handleGoogleLogin(response) {
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = 'Verificando con Google...';
    messageEl.style.color = 'white';
    
    try {
        const res = await fetch(`${API_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje || 'Error en el login con Google');

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
}


/*
 * =================================
 * LÓGICA PRINCIPAL DE LA APLICACIÓN
 * =================================
 * Se ejecuta una vez que todo el HTML (DOM) ha cargado.
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA DE AUTENTICACIÓN ---
    const token = localStorage.getItem('token');
    const loginLink = document.getElementById('login-link');
    const logoutButton = document.getElementById('logout-button');
    const saveFavoriteButton = document.getElementById('save-favorite-button');
    const favoritesContainer = document.getElementById('favorites-container');
    const favoritesButton = document.getElementById('favorites-button');

    if (token) {
        // Logueado
        loginLink.style.display = 'none';
        logoutButton.style.display = 'block';
        saveFavoriteButton.style.display = 'block';
        favoritesContainer.style.display = 'block';
        loadFavorites(token); 
    } else {
        // Desconectado
        loginLink.style.display = 'block';
        logoutButton.style.display = 'none';
        saveFavoriteButton.style.display = 'none';
        favoritesContainer.style.display = 'none';
    }

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail');
        window.location.reload();
    });
    
    saveFavoriteButton.addEventListener('click', async () => {
        if (!currentCity || !token) {
            alert('Debes estar logueado y buscar una ciudad para guardarla.');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ city: currentCity })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.mensaje || 'Error al guardar');
            alert('¡Ciudad guardada en favoritos!');
            updateFavoritesUI(data.favorites); 
        } catch (error) {
            console.error('Error al guardar:', error);
            alert(`Error: ${error.message}`);
        }
    });
    
    favoritesButton.addEventListener('click', (e) => {
        e.stopPropagation();
        favoritesContainer.classList.toggle('open');
    });

    document.addEventListener('click', () => {
        if (favoritesContainer.classList.contains('open')) {
            favoritesContainer.classList.remove('open');
        }
    });
    // --- FIN LÓGICA DE AUTENTICACIÓN ---

    
    // --- LÓGICA DE BÚSQUEDA ---
    const searchButton = document.getElementById('search-button');
    const cityInput = document.getElementById('city-input');
    const unitsSelect = document.getElementById('units-select');
    const langSelect = document.getElementById('lang-select');

    window.handleSearch = function() {
        const city = cityInput.value;
        const units = unitsSelect.value;
        const lang = langSelect.value;
        if (city.trim() === '') {
            alert('Por favor, escribe el nombre de una ciudad.');
            return;
        }
        fetchWeather(city, units, lang);
    }

    function handleSettingsChange() {
        if (!currentCity) return;
        const units = unitsSelect.value;
        const lang = langSelect.value;
        fetchWeather(currentCity, units, lang);
    }

    searchButton.addEventListener('click', window.handleSearch);
    cityInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') window.handleSearch();
    });
    unitsSelect.addEventListener('change', handleSettingsChange);
    langSelect.addEventListener('change', handleSettingsChange);

    
    // --- LÓGICA DE GEOLOCALIZACIÓN ---
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const units = unitsSelect.value;
                const lang = langSelect.value;
                fetchWeatherByCoords(lat, lon, units, lang);
            },
            (error) => {
                console.warn("Geolocalización denegada o fallida.", error.message);
            }
        );
    } else {
        console.log("Geolocalización no está disponible en este navegador.");
    }
    // --- FIN DE GEOLOCALIZACIÓN ---

}); // <-- FIN DEL DOMContentLoaded


/*
 * ========================================
 * --- FUNCIONES GLOBALES (API, UI) ---
 * ========================================
 */

/**
 * Busca el clima por NOMBRE de ciudad.
 * Llama a la ruta /api/weather del backend.
 */
function fetchWeather(city, units, lang) {
    // 1. Pone la UI en modo "Cargando..."
    document.getElementById('city-name').innerText = 'Buscando...';
    document.getElementById('current-description').innerText = '---';
    document.getElementById('current-temp').innerText = '--°';
    document.getElementById('min-max-temp').innerText = '--°/--°';
    document.getElementById('humidity').innerText = '--%';
    document.getElementById('pressure').innerText = '---- MBAR';
    document.getElementById('wind').innerHTML = '---<br><span>---</span>';

    // 2. Construye la URL y llama al backend
    const url = `${API_URL}/api/weather?city=${encodeURIComponent(city)}&units=${units}&lang=${lang}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Ciudad no encontrada');
            return response.json();
        })
        .then(data => {
            // 3. ¡Éxito! Llama a todas las funciones de UI
            currentCity = data.ciudad; 
            updateUI(data); 
            if (data.pronosticoSemanal) updateWeeklyForecast(data.pronosticoSemanal);
            if (data.pronosticoHoras) updateHourlyForecast(data.pronosticoHoras);
            if (data.coords && data.mapTileUrl) updateMap(data.coords, data.mapTileUrl);
            
            // --- ¡AQUÍ ESTÁ EL ARREGLO! ---
            // Esta línea faltaba y causaba que el fondo no se actualizara
            // en la búsqueda manual.
            if (data.icono) updateDynamicBackground(data.icono); 
        })
        .catch(error => {
            // 4. Falla: Muestra el error
            console.error('Error al cargar los datos:', error);
            document.getElementById('city-name').innerText = 'Error';
            document.getElementById('current-description').innerText = 'Ciudad no encontrada.';
            currentCity = '';
        });
}

/**
 * Busca el clima por COORDENADAS (Geolocalización).
 * Llama a la ruta /api/weather-by-coords del backend.
 */
function fetchWeatherByCoords(lat, lon, units, lang) {
    // 1. Pone la UI en modo "Cargando..."
    document.getElementById('city-name').innerText = 'Buscando tu ubicación...';
    document.getElementById('current-description').innerText = '---';
    document.getElementById('current-temp').innerText = '--°';
    document.getElementById('min-max-temp').innerText = '--°/--°';
    document.getElementById('humidity').innerText = '--%';
    document.getElementById('pressure').innerText = '---- MBAR';
    document.getElementById('wind').innerHTML = '---<br><span>---</span>';

    // 2. Construye la URL y llama al backend
    const url = `${API_URL}/api/weather-by-coords?lat=${lat}&lon=${lon}&units=${units}&lang=${lang}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Ubicación no encontrada');
            return response.json();
        })
        .then(data => {
            // 3. ¡Éxito! Llama a todas las funciones de UI
            currentCity = data.ciudad;
            updateUI(data); 
            if (data.pronosticoSemanal) updateWeeklyForecast(data.pronosticoSemanal);
            if (data.pronosticoHoras) updateHourlyForecast(data.pronosticoHoras);
            if (data.coords && data.mapTileUrl) updateMap(data.coords, data.mapTileUrl);
            if (data.icono) updateDynamicBackground(data.icono);
        })
        .catch(error => {
            // 4. Falla: Muestra el error
            console.error('Error al cargar datos por coordenadas:', error);
            document.getElementById('city-name').innerText = 'Error';
            document.getElementById('current-description').innerText = 'No se pudo cargar tu ubicación.';
            currentCity = '';
        });
}

/**
 * Carga la lista de favoritos del usuario desde el backend.
 * Llama a la ruta protegida GET /api/favorites.
 */
async function loadFavorites(token) {
    try {
        const response = await fetch(`${API_URL}/api/favorites`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('No se pudieron cargar los favoritos');
        const favorites = await response.json();
        updateFavoritesUI(favorites);
    } catch (error) {
        console.error(error.message);
    }
}

/**
 * Dibuja la lista de favoritos en el menú desplegable.
 */
function updateFavoritesUI(favorites) {
    const favoritesList = document.getElementById('favorites-list');
    const favoritesButton = document.getElementById('favorites-button');
    favoritesList.innerHTML = ''; 
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<div class="favorite-item">No tienes favoritos.</div>';
    } else {
        favorites.forEach(fav => {
            const item = document.createElement('div');
            item.classList.add('favorite-item');
            
            // ¡NUEVO! Creamos el span para el nombre y el botón de borrar
            item.innerHTML = `
                <span>${fav.name}</span>
                <button class="delete-fav-btn" data-city="${fav.name}">&times;</button>
            `;
            
            // Hacemos que el *nombre* (span) sea clicable para buscar
            item.querySelector('span').addEventListener('click', () => {
                document.getElementById('city-input').value = fav.name;
                window.handleSearch(); 
                document.getElementById('favorites-container').classList.remove('open');
            });
            item.querySelector('.delete-fav-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteFavorite(fav.name);
            });
            favoritesList.appendChild(item);
        });
    }
    favoritesButton.textContent = `Mis Favoritos (${favorites.length})`;
}

/**
 * Borra una ciudad favorita.
 * Llama a la ruta protegida DELETE /api/favorites.
 */
async function handleDeleteFavorite(cityName) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Debes iniciar sesión.');
        return;
    }
    if (!confirm(`¿Estás seguro de que quieres eliminar "${cityName}" de tus favoritos?`)) {
        return;
    }
    try {
        const response = await fetch(`${API_URL}/api/favorites`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ city: cityName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensaje || 'Error al eliminar');
        
        alert('Favorito eliminado');
        updateFavoritesUI(data.favorites); // Actualiza la lista
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert(`Error: ${error.message}`);
    }
}

/**
 * Actualiza la UI con los datos del clima actual (tarjeta principal y detalles).
 */
function updateUI(data) {
    document.getElementById('city-name').innerText = data.ciudad;
    document.getElementById('current-description').innerText = data.descripcion;
    document.getElementById('current-temp').innerText = `${data.temperatura}°${data.unit}`;
    document.getElementById('min-max-temp').innerText = `${data.min_max}${data.unit}`;
    document.getElementById('humidity').innerText = `${data.humedad}%`;
    document.getElementById('pressure').innerText = `${data.presion} MBAR`;
    document.getElementById('wind').innerHTML = `${data.viento.direccion}<br><span>${data.viento.velocidad}</span>`;
}

/**
 * Actualiza la UI con el pronóstico semanal (las 5-7 tarjetas).
 */
function updateWeeklyForecast(weeklyData) {
  const weekContainer = document.getElementById("week-cards-container");
  weekContainer.innerHTML = ""; // Limpia los datos de ejemplo
  weeklyData.forEach(day => {
    const card = document.createElement("div");
    card.classList.add("day-card");
    card.innerHTML = `
      <p class="day-name">${day.dia}</p>
      <img src="${day.icono}" alt="${day.descripcion}">
      <p class="day-temp">${day.max}° / ${day.min}°</p>
    `;
    weekContainer.appendChild(card);
  });
}

/**
 * Actualiza la UI con la gráfica de 24 horas (usando Chart.js).
 */
function updateHourlyForecast(hourlyData) {
  const ctx = document.getElementById("hourlyChart").getContext("2d");
  const horas = hourlyData.map(h => h.hora);
  const temps = hourlyData.map(h => h.temp);
  
  if (currentChart) currentChart.destroy(); // Destruye la gráfica anterior
  
  currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: horas,
      datasets: [{
        label: "Temperatura",
        data: temps,
        borderColor: "rgba(255,255,255,0.9)",
        backgroundColor: "rgba(255,255,255,0.2)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: "#fff"
      }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.2)" } },
            y: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.2)" } }
        },
        plugins: {
            legend: { labels: { color: "white" } }
        }
    }
  });
}

/**
 * Actualiza la UI con el mapa de precipitación (usando Leaflet.js).
 */
function updateMap(coords, mapTileUrl) {
    if (currentMap) {
        currentMap.setView([coords.lat, coords.lon], 10);
    } else {
        currentMap = L.map('weather-map').setView([coords.lat, coords.lon], 10);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO'
        }).addTo(currentMap);
    }
    
    L.tileLayer(mapTileUrl, {
        opacity: 0.7,
        attribution: 'OpenWeatherMap'
    }).addTo(currentMap);
}

/**
 * Actualiza el fondo de la página basado en el código de ícono del clima.
 */
function updateDynamicBackground(iconCode) {
    const body = document.body;
    let newClass = 'bg-default'; 
    const classes = ['bg-default', 'bg-day-clear', 'bg-night-clear', 
                     'bg-day-clouds', 'bg-night-clouds', 'bg-rain-storm', 
                     'bg-snow', 'bg-mist'];
    
    switch (iconCode) {
        case '01d': newClass = 'bg-day-clear'; break;
        case '01n': newClass = 'bg-night-clear'; break;
        case '02d':
        case '03d':
        case '04d': newClass = 'bg-day-clouds'; break;
        case '02n':
        case '03n':
        case '04n': newClass = 'bg-night-clouds'; break;
        case '09d':
        case '10d':
        case '11d':
        case '09n':
        case '10n':
        case '11n': newClass = 'bg-rain-storm'; break;
        case '13d':
        case '13n': newClass = 'bg-snow'; break;
        case '50d':
        case '50n': newClass = 'bg-mist'; break;
    }
    
    body.classList.remove(...classes);
    body.classList.add(newClass);
}