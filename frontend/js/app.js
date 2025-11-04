const API_URL = 'https://iweather.onrender.com';

// (Aquí siguen tus 'let currentCity = ...', etc.)
// --- Variables Globales ---
let currentCity = '';
let currentChart = null;
let currentMap = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA DE AUTENTICACIÓN ---
    const token = localStorage.getItem('token');
    const loginLink = document.getElementById('login-link');
    const logoutButton = document.getElementById('logout-button');
    const saveFavoriteButton = document.getElementById('save-favorite-button');
    
    // --- ¡NUEVO! Elementos de Favoritos ---
    const favoritesContainer = document.getElementById('favorites-container');
    const favoritesButton = document.getElementById('favorites-button');
    const favoritesList = document.getElementById('favorites-list');

    if (token) {
        // Logueado
        loginLink.style.display = 'none';
        logoutButton.style.display = 'block';
        saveFavoriteButton.style.display = 'block';
        favoritesContainer.style.display = 'block'; // ¡NUEVO! Mostrar botón de Favoritos
        
        // ¡NUEVO! Cargar los favoritos del usuario
        loadFavorites(token); 
    } else {
        // Desconectado
        loginLink.style.display = 'block';
        logoutButton.style.display = 'none';
        saveFavoriteButton.style.display = 'none';
        favoritesContainer.style.display = 'none'; // ¡NUEVO! Ocultar botón de Favoritos
    }

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail');
        window.location.reload();
    });
    
    saveFavoriteButton.addEventListener('click', async () => {
        if (!currentCity) {
            alert('Primero busca una ciudad para guardarla.');
            return;
        }
        if (!token) {
            alert('Debes iniciar sesión para guardar favoritos.');
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
            if (!response.ok) {
                throw new Error(data.mensaje || 'Error al guardar');
            }
            alert('¡Ciudad guardada en favoritos!');
            
            // ¡NUEVO! Actualizar la lista de favoritos después de guardar
            updateFavoritesUI(data.favorites); 
            
        } catch (error) {
            console.error('Error al guardar:', error);
            alert(`Error: ${error.message}`);
        }
    });
    
    // --- ¡NUEVO! Lógica del menú desplegable de favoritos ---
    favoritesButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que el clic se propague al 'document'
        favoritesContainer.classList.toggle('open');
    });

    // Cerrar el menú si se hace clic fuera
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

    // ¡NUEVO! Hacemos 'handleSearch' accesible globalmente
    // para que la lista de favoritos pueda llamarla.
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

    // (Tu código de 'searchButton', 'cityInput', etc. va aquí arriba)
    
    // --- ¡NUEVA LÓGICA DE GEOLOCALIZACIÓN! ---
    if ('geolocation' in navigator) {
        // Pedimos la ubicación al usuario
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Éxito: El usuario aceptó
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const units = unitsSelect.value;
                const lang = langSelect.value;
                
                // Llamamos a una nueva función para cargar el clima por coordenadas
                fetchWeatherByCoords(lat, lon, units, lang);
            },
            (error) => {
                // Error: El usuario bloqueó la solicitud o hubo un error
                console.warn("Geolocalización denegada o fallida.", error.message);
                // La página simplemente se quedará en "Busca una ciudad",
                // lo cual está bien.
            }
        );
    } else {
        console.log("Geolocalización no está disponible en este navegador.");
    }
    // --- FIN DE GEOLOCALIZACIÓN ---

}); // <-- FIN DEL DOMContentLoaded


// --- LÓGICA DE API ---

function fetchWeather(city, units, lang) {
    document.getElementById('city-name').innerText = 'Buscando...';
    document.getElementById('current-description').innerText = '---';
    document.getElementById('current-temp').innerText = '--°';
    document.getElementById('min-max-temp').innerText = '--°/--°';
    document.getElementById('humidity').innerText = '--%';
    document.getElementById('pressure').innerText = '---- MBAR';
    document.getElementById('wind').innerHTML = '---<br><span>---</span>';

const url = `${API_URL}/api/weather?city=${encodeURIComponent(city)}&units=${units}&lang=${lang}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Ciudad no encontrada');
            return response.json();
        })
        .then(data => {
            currentCity = data.ciudad; 
            updateUI(data); 
            if (data.pronosticoSemanal) {
                updateWeeklyForecast(data.pronosticoSemanal);
            }
            if (data.pronosticoHoras) {
                updateHourlyForecast(data.pronosticoHoras);
            }
            if (data.coords && data.mapTileUrl) {
                updateMap(data.coords, data.mapTileUrl);
            }
        })
        .catch(error => {
            console.error('Error al cargar los datos:', error);
            document.getElementById('city-name').innerText = 'Error';
            document.getElementById('current-description').innerText = 'Ciudad no encontrada.';
            currentCity = '';
        });
}

// --- ¡NUEVA FUNCIÓN PARA CARGAR FAVORITOS! ---
async function loadFavorites(token) {
    try {
        const response = await fetch(`${API_URL}/api/favorites`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('No se pudieron cargar los favoritos');
        }
        const favorites = await response.json();
        updateFavoritesUI(favorites);
    } catch (error) {
        console.error(error.message);
    }
}

// --- ¡NUEVA FUNCIÓN PARA MOSTRAR FAVORITOS! ---
// --- ¡FUNCIÓN MODIFICADA PARA MOSTRAR FAVORITOS! ---
function updateFavoritesUI(favorites) {
    const favoritesList = document.getElementById('favorites-list');
    const favoritesButton = document.getElementById('favorites-button');
    
    favoritesList.innerHTML = ''; // Limpiar lista
    
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
            
            // Hacemos que el *botón 'X'* sea clicable para borrar
            item.querySelector('.delete-fav-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Evita que el menú se cierre
                handleDeleteFavorite(fav.name);
            });
            
            favoritesList.appendChild(item);
        });
    }
    
    // Actualizar el contador del botón
    favoritesButton.textContent = `Mis Favoritos (${favorites.length})`;
}


// --- FUNCIONES DE ACTUALIZACIÓN DE UI (Sin cambios) ---

function updateUI(data) {
    document.getElementById('city-name').innerText = data.ciudad;
    document.getElementById('current-description').innerText = data.descripcion;
    document.getElementById('current-temp').innerText = `${data.temperatura}°${data.unit}`;
    document.getElementById('min-max-temp').innerText = `${data.min_max}${data.unit}`;
    document.getElementById('humidity').innerText = `${data.humedad}%`;
    document.getElementById('pressure').innerText = `${data.presion} MBAR`;
    document.getElementById('wind').innerHTML = `${data.viento.direccion}<br><span>${data.viento.velocidad}</span>`;
}

function updateWeeklyForecast(weeklyData) {
  const weekContainer = document.getElementById("week-cards-container");
  weekContainer.innerHTML = ""; 
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

function updateHourlyForecast(hourlyData) {
  const ctx = document.getElementById("hourlyChart").getContext("2d");
  const horas = hourlyData.map(h => h.hora);
  const temps = hourlyData.map(h => h.temp);
  if (currentChart) currentChart.destroy();
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
        opacity: 0.7
    }).addTo(currentMap);
}

// --- ¡NUEVA FUNCIÓN PARA BORRAR UN FAVORITO! ---
async function handleDeleteFavorite(cityName) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Debes iniciar sesión.');
        return;
    }

    // Pedir confirmación al usuario
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
        if (!response.ok) {
            throw new Error(data.mensaje || 'Error al eliminar');
        }

        // ¡Éxito! Actualizamos la lista
        alert('Favorito eliminado');
        updateFavoritesUI(data.favorites); // Volvemos a dibujar la lista con los datos del backend

    } catch (error) {
        console.error('Error al eliminar:', error);
        alert(`Error: ${error.message}`);
    }
}

// (Tu función handleDeleteFavorite está aquí arriba...)

// --- ¡NUEVA FUNCIÓN PARA GEOLOCALIZACIÓN! ---
function fetchWeatherByCoords(lat, lon, units, lang) {
    
    // Resetear UI a "Cargando..."
    document.getElementById('city-name').innerText = 'Buscando tu ubicación...';
    document.getElementById('current-description').innerText = '---';
    document.getElementById('current-temp').innerText = '--°';
    document.getElementById('min-max-temp').innerText = '--°/--°';
    document.getElementById('humidity').innerText = '--%';
    document.getElementById('pressure').innerText = '---- MBAR';
    document.getElementById('wind').innerHTML = '---<br><span>---</span>';

    // ¡Llamamos a la NUEVA RUTA DEL BACKEND!
    const url = `${API_URL}/api/weather-by-coords?lat=${lat}&lon=${lon}&units=${units}&lang=${lang}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Ubicación no encontrada');
            return response.json();
        })
        .then(data => {
            currentCity = data.ciudad; // Guardamos el nombre de la ciudad
            
            // Llamamos a las mismas funciones de actualización
            updateUI(data); 
            if (data.pronosticoSemanal) {
                updateWeeklyForecast(data.pronosticoSemanal);
            }
            if (data.pronosticoHoras) {
                updateHourlyForecast(data.pronosticoHoras);
            }
            if (data.coords && data.mapTileUrl) {
                updateMap(data.coords, data.mapTileUrl);
            }
        })
        .catch(error => {
            console.error('Error al cargar datos por coordenadas:', error);
            document.getElementById('city-name').innerText = 'Error';
            document.getElementById('current-description').innerText = 'No se pudo cargar tu ubicación.';
            currentCity = '';
        });
}

// (Tus otras funciones: updateUI, updateWeeklyForecast, etc. siguen aquí)