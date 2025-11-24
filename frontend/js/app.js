/*
 * =================================
 * CONFIGURACIÓN GLOBAL
 * =================================
 */

// API_URL define a qué servidor backend le hablamos.
// - Usa 'http://localhost:3000' para tus pruebas locales.
// - Usa 'https://iweather.onrender.com' (tu URL de Render) para producción (cuando subes a GitHub).
const API_URL = 'https://iweather.onrender.com'; 

// --- Variables Globales ---
let currentCity = '';
let currentChart = null;
let currentMap = null;
let suggestionsMap = {}; // Aquí guardaremos las coordenadas de las sugerencias


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
            showNotification('Debes estar logueado y buscar una ciudad para guardarla.', 'error');
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
            showNotification('Ciudad guardada', 'success');
            updateFavoritesUI(data.favorites); 
        } catch (error) {
            console.error('Error al guardar:', error);
            showNotification(`Error: ${error.message}`, 'error');
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
        const inputValue = cityInput.value; // Lo que escribió el usuario
        const units = unitsSelect.value;
        const lang = langSelect.value;

        if (inputValue.trim() === '') {
            showNotification('Por favor, escribe el nombre de una ciudad.', 'error');
            return;
        }

        // 1. ¿El texto coincide exactamente con una sugerencia que tenemos guardada?
        if (suggestionsMap[inputValue]) {
            // ¡SÍ! Tenemos coordenadas exactas. Usamos la ruta de coordenadas.
            const coords = suggestionsMap[inputValue];
            console.log("Usando coordenadas exactas:", coords);
            fetchWeatherByCoords(coords.lat, coords.lon, units, lang);
        } else {
            // 2. NO. Es una búsqueda manual (el usuario escribió y dio Enter sin seleccionar).
            // Usamos la búsqueda tradicional por nombre.
            fetchWeather(inputValue, units, lang);
        }
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
                fetchWeather("Mexico City", "metric", "es"); // Ciudad por defecto
            showNotification("Mostrando clima por defecto", "info");
            }
        );
    } else {
       // Si el navegador no tiene geo
    fetchWeather("Mexico City", "metric", "es"); // Ciudad por defecto
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
   // 1. Referencia al botón
    const btn = document.getElementById('search-button');
    
    // 2. Poner botón en modo "Cargando"
    if (btn) {
        btn.textContent = "⌛"; // O "Cargando..."
        btn.disabled = true;    // Evita doble clic
    }
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
            if (data.coords) {
            fetchUV(data.coords.lat, data.coords.lon);
            }
            
            // --- ¡AQUÍ ESTÁ EL ARREGLO! ---
            // Esta línea faltaba y causaba que el fondo no se actualizara
            // en la búsqueda manual.
         if (data.icono) updateDynamicBackground(data);

         // Notificación de éxito (opcional si usaste Toastify)
            showNotification('Clima actualizado', 'success');
        })
        .catch(error => {
            // 4. Falla: Muestra el error
            console.error('Error al cargar los datos:', error);
            document.getElementById('city-name').innerText = 'Error';
            document.getElementById('current-description').innerText = 'Ciudad no encontrada.';
            currentCity = '';

           // Notificación de error (si usaste Toastify)
            if (typeof showNotification === 'function') {
                showNotification('No se encontró la ciudad', 'error');
            } else {
                alert('No se encontró la ciudad');
            }
        })
        .finally(() => {
            // --- ¡ESTA ES LA PARTE IMPORTANTE! ---
            // .finally() se ejecuta SIEMPRE, haya éxito o error.
            if (btn) {
                btn.textContent = "Buscar";
                btn.disabled = false; // Reactivamos el botón
            }
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
            if (data.icono) updateDynamicBackground(data);
            fetchUV(lat, lon);
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
        showNotification('Debes iniciar sesión.', 'error');
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
        
        showNotification('Favorito eliminado', 'success');
        updateFavoritesUI(data.favorites); // Actualiza la lista
    } catch (error) {
        console.error('Error al eliminar:', error);
        showNotification(`Error: ${error.message}`, 'error');
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
 * Actualiza el fondo de la página Y carga la animación Lottie
 * basada en el código de ícono Y LA DESCRIPCIÓN del clima.
 */
function updateDynamicBackground(data) {
    const body = document.body;
    const player = document.getElementById('weather-animation-player');
    
    // Esto fuerza a la animación a comportarse como "background-size: cover"
    // 'slice' corta lo que sobra para que no queden bordes vacíos.
    if (player) {
        player.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    }
    // ------------------------
    // Obtenemos todos los datos que necesitamos
    const iconCode = data.icono;
    const description = data.descripcion.toLowerCase(); // ¡NUEVO! Convertimos a minúsculas

    let newBodyClass = 'bg-default';
    let animationFile = '';

    // Clases de fondo del body
    const bodyClasses = ['bg-default', 'bg-day-clear', 'bg-night-clear',
                        'bg-day-clouds', 'bg-night-clouds', 'bg-rain-storm',
                        'bg-snow', 'bg-mist'];

    // --- ¡NUEVA LÓGICA DE PRIORIDAD! ---
    // 1. Prioridad: Nieve. Si la descripción dice "nieve" o el ícono es 13, ES NIEVE.
    if (description.includes('nieve') || description.includes('snow') || iconCode === '13d' || iconCode === '13n') {
        newBodyClass = 'bg-snow';
        animationFile = 'animations/snow.json';
    
    // 2. Prioridad: Tormenta.
    } else if (description.includes('tormenta') || description.includes('storm') || iconCode === '11d' || iconCode === '11n') {
        newBodyClass = 'bg-rain-storm';
        animationFile = 'animations/storm.json';

    // 3. Prioridad: Lluvia.
    } else if (description.includes('lluvia') || description.includes('rain') || description.includes('llovizna') || iconCode === '09d' || iconCode === '09n' || iconCode === '10d' || iconCode === '10n') {
        newBodyClass = 'bg-rain-storm';
        animationFile = 'animations/rainy.json';
    
    // 4. Prioridad: Niebla.
    } else if (description.includes('niebla') || description.includes('mist') || description.includes('fog') || iconCode === '50d' || iconCode === '50n') {
        newBodyClass = 'bg-mist';
        animationFile = 'animations/mist.json';

    // 5. Fallback: Si no es nada de lo anterior, usamos el ícono para Sol o Nubes.
    } else {
        switch (iconCode) {
            case '01d': // Despejado día
                newBodyClass = 'bg-day-clear';
                animationFile = 'animations/sunny.json';
                break;
            case '01n': // Despejado noche
                newBodyClass = 'bg-night-clear';
                animationFile = 'animations/moon.json';
                break;
            case '02d': // Nubes día
            case '03d':
            case '04d':
                newBodyClass = 'bg-day-clouds';
                animationFile = 'animations/cloudy.json';
                break;
            case '02n': // Nubes noche
            case '03n':
            case '04n':
                newBodyClass = 'bg-night-clouds';
                animationFile = 'animations/cloudy-night.json';
                break;
            default:
                // Si todo falla, usa nubes de día como defecto
                newBodyClass = 'bg-day-clouds';
                animationFile = 'animations/cloudy.json';
        }
    }

    // 1. Actualiza las clases del Body para el fondo de gradiente
    body.classList.remove(...bodyClasses);
    body.classList.add(newBodyClass);

    // 2. Carga la nueva animación en el reproductor Lottie
    if (animationFile && player) {
        // Obtenemos la URL base (en caso de que estemos en http://127.0.0.1:5500/frontend/)
        const baseUrl = window.location.href.replace('index.html', '');
        const animationUrl = new URL(animationFile, baseUrl).href;

        // Comparamos la URL completa para evitar recargar la misma animación
        if (player.src !== animationUrl) {
            player.load(animationUrl);
        }
    } else if (player) {
        player.load(''); // Carga una animación vacía si no hay ninguna
    }
}

// --- FUNCIÓN PARA OBTENER UV (Open-Meteo API) ---
function fetchUV(lat, lon) {
    // URL de la API gratuita (solo pide el índice UV actual)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index&timezone=auto`;

    fetch(url)
        .then(resp => resp.json())
        .then(data => {
            if (data.current) {
                updateUVCard(data.current.uv_index);
            }
        })
        .catch(err => console.error("Error UV:", err));
}

function updateUVCard(uvIndex) {
    const uvValue = document.getElementById('uv-value');
    const uvLabel = document.getElementById('uv-label');

    // Mostrar valor
    uvValue.innerText = uvIndex;

    // Determinar color y texto según riesgo
    let texto = "Bajo";
    let color = "#55efc4"; // Verde

    if (uvIndex >= 3 && uvIndex < 6) {
        texto = "Moderado";
        color = "#ffeaa7"; // Amarillo
    } else if (uvIndex >= 6 && uvIndex < 8) {
        texto = "Alto";
        color = "#fdcb6e"; // Naranja
    } else if (uvIndex >= 8 && uvIndex < 11) {
        texto = "Muy Alto";
        color = "#ff7675"; // Rojo
    } else if (uvIndex >= 11) {
        texto = "Extremo";
        color = "#d63031"; // Rojo oscuro/Violeta
    }

    uvLabel.innerText = texto;
    uvLabel.style.color = color;
}

/* =========================================
   --- AUTOCOMPLETADO DE CIUDADES (Open-Meteo) ---
   ========================================= */

const cityInput = document.getElementById('city-input');
const suggestionsList = document.getElementById('city-suggestions');
let debounceTimer; 

// --- CAMBIO IMPORTANTE AQUÍ ---
if (cityInput) {
    cityInput.addEventListener('input', (e) => {
        const value = e.target.value;

        // 1. TRUCO DE SEGURIDAD:
        // Si lo que hay en el input YA coincide exactamente con una de nuestras sugerencias guardadas,
        // significa que el usuario acaba de seleccionar una opción.
        // ¡NO hacemos nada! Así conservamos las coordenadas correctas en suggestionsMap.
        if (suggestionsMap[value]) {
            return; 
        }

        // 2. Si es texto nuevo, seguimos con la búsqueda normal...
        if (value.length < 3) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchCitySuggestions(value);
        }, 300);
    });
}
function fetchCitySuggestions(query) {
    // API de geocodificación de Open-Meteo
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=es&format=json`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            suggestionsList.innerHTML = '';
            suggestionsMap = {}; // Limpiamos el mapa anterior

            if (data.results) {
                data.results.forEach(city => {
                    const option = document.createElement('option');
                    
                    // Creamos un nombre único: "Veracruz, México" o "Veracruz, Panamá"
                    // Si hay 'admin1' (estado/provincia), lo agregamos para ser más exactos
                    let displayName = `${city.name}, ${city.country}`;
                    if (city.admin1) displayName += ` (${city.admin1})`;

                    option.value = displayName; 
                    suggestionsList.appendChild(option);

                    // --- AQUÍ ESTÁ EL TRUCO ---
                    // Guardamos las coordenadas asociadas a este nombre exacto
                    suggestionsMap[displayName] = { 
                        lat: city.latitude, 
                        lon: city.longitude 
                    };
                });
            }
        })
        .catch(err => console.error("Error buscando ciudades:", err));
}

function showNotification(text, type = "error") {
    const color = type === "success" ? "#00b894" : "#d63031"; // Verde o Rojo
    Toastify({
        text: text,
        duration: 3000,
        gravity: "top", 
        position: "center", 
        style: { background: color, borderRadius: "10px" }
    }).showToast();
}