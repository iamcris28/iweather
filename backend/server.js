require('dotenv').config();
console.log('CLAVE SECRETA CARGADA:', process.env.JWT_SECRET);
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // ¡NUEVO! Para encriptar
const jwt = require('jsonwebtoken'); // ¡AÑADE ESTA LÍNEA!
const sgMail = require('@sendgrid/mail');
const { OAuth2Client } = require('google-auth-library');

// --- ¡NUEVO! Importamos nuestro "molde" de Usuario ---
const User = require('./models/User');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json()); // MUY IMPORTANTE para recibir JSON del frontend

// --- Conexión a la Base de Datos ---
mongoose.connect(process.env.DATABASE_URL)

    .then(() => console.log('✅ Conectado a MongoDB Atlas'))
    .catch((err) => console.error('Error al conectar a MongoDB:', err));
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -------------------------------------------
// ---          RUTAS DE AUTENTICACIÓN     ---
// -------------------------------------------

// --- ¡RUTA DE REGISTRO MODIFICADA! ---
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
        }

        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ mensaje: 'Este email ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            email: email,
            password: hashedPassword
            // isVerified es 'false' por defecto
        });

        await newUser.save(); // Guardamos al usuario

        // --- ¡NUEVA LÓGICA DE VERIFICACIÓN! ---

        // 1. Creamos un token DE VERIFICACIÓN (diferente al de login)
        //    Este token solo sirve para verificar el email y expira en 15 minutos
        const verificationToken = jwt.sign(
            { userId: newUser._id },
            process.env.JWT_SECRET, // Reusamos la misma clave secreta
            { expiresIn: '15m' } 
        );

        // 2. Creamos la URL que el usuario visitará
        //    (Usaremos el puerto 5500 del frontend)
       const verificationUrl = `http://127.0.0.1:5500/frontend/verify-email.html?token=${verificationToken}`;
        // 3. Creamos el mensaje de correo
        const msg = {
            to: email, // El email del nuevo usuario
            from: 'goldmaster288pro@gmail.com', // ¡¡CAMBIA ESTO!!
            subject: '¡Verifica tu cuenta en la App del Clima!',
            html: `
                <h1>¡Bienvenido a la App del Clima!</h1>
                <p>Por favor, haz clic en el siguiente enlace para verificar tu cuenta:</p>
                <a href="${verificationUrl}">Verificar mi cuenta</a>
                <p>Este enlace expirará en 15 minutos.</p>
            `,
        };

        // 4. Enviamos el correo
        await sgMail.send(msg);

        // 5. Enviamos la respuesta al frontend
        res.status(201).json({ 
            mensaje: 'Usuario registrado. ¡Por favor, revisa tu email para verificar tu cuenta!' 
        });

    } catch (error) {
        console.error("Error en el registro:", error);
        // Si el error es de SendGrid, puede dar más detalles
        if (error.response) {
            console.error(error.response.body);
        }
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// -------------------------------------------
// ---          RUTAS DE AUTENTICACIÓN     ---
// -------------------------------------------

// (Tu ruta /api/register está aquí arriba...)

// --- ¡NUEVA RUTA DE LOGIN! ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Verificar que los campos no estén vacíos
        if (!email || !password) {
            return res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
        }

        // 2. Buscar al usuario en la BD
        const user = await User.findOne({ email });
        if (!user) {
            // Usamos un mensaje genérico por seguridad
            return res.status(400).json({ mensaje: 'Credenciales inválidas' }); 
        }

        // 3. Comparar la contraseña enviada con la encriptada en la BD
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // Mensaje genérico
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }

        // 4. ¡ÉXITO! El usuario es válido. Creamos el "pase" (Token)
        // Firmamos el token con el ID del usuario y nuestra clave secreta.
        // Le damos 1 hora de expiración.
        const token = jwt.sign(
            { userId: user._id }, // El "payload" o datos del token
            process.env.JWT_SECRET, // La clave secreta del .env
            { expiresIn: '1h' }    // Opciones (expira en 1 hora)
        );

        // 5. Enviamos el token y el email al frontend
        res.json({ 
            token: token, 
            email: user.email 
        });

    } catch (error) {
        console.error("Error en el login:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});


// (Tu ruta /api/login está aquí arriba...)

// --- ¡NUEVA RUTA DE VERIFICACIÓN DE EMAIL! ---
app.post('/api/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ mensaje: 'No se proporcionó token.' });
        }

        // 1. Verificamos el token (que no haya expirado y sea válido)
        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Si el token es inválido o expiró (ej. pasaron 15 min)
            return res.status(400).json({ mensaje: 'El token es inválido o ha expirado.' });
        }

        // 2. Buscamos al usuario que corresponde a ese token
        const user = await User.findById(payload.userId);
        if (!user) {
            return res.status(400).json({ mensaje: 'Usuario no encontrado.' });
        }

        // 3. Marcamos al usuario como verificado
        user.isVerified = true;
        await user.save();

        // 4. Enviamos respuesta exitosa
        res.json({ mensaje: '¡Cuenta verificada exitosamente! Ya puedes iniciar sesión.' });

    } catch (error) {
        console.error("Error en la verificación:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// (Tu ruta /api/verify-email está aquí arriba...)

// --- ¡NUEVA RUTA DE LOGIN CON GOOGLE! ---
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body; // Google llama 'credential' a su token

        // 1. Verificar el token de Google
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;

        if (!email) {
            return res.status(400).json({ mensaje: 'Error al obtener email de Google' });
        }

        // 2. Buscar si el usuario ya existe en nuestra BD
        let user = await User.findOne({ email: email });

        if (!user) {
            // 3. Si no existe, LO REGISTRAMOS
            // Creamos una contraseña aleatoria y "falsa" ya que usarán Google
            const randomPassword = Math.random().toString(36).slice(-8);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            user = new User({
                email: email,
                password: hashedPassword,
                isVerified: true // Lo marcamos como verificado, ya que Google ya verificó el email
            });
            await user.save();
        }

        // 4. Si el usuario ya existía o lo acabamos de crear,
        //    le creamos NUESTRO token (JWT) de sesión
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // 5. Enviamos nuestro token al frontend
        res.json({
            token: token,
            email: user.email
        });

    } catch (error) {
        console.error("Error en el login con Google:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }

    // (Tu ruta /api/auth/google está aquí arriba...)

// -------------------------------------------
// ---      RUTAS DE CIUDADES FAVORITAS    ---
// ---   ¡ESTAS RUTAS ESTÁN PROTEGIDAS!    ---
// -------------------------------------------

// --- ¡NUEVA RUTA PARA AÑADIR UN FAVORITO! ---
// Nota cómo usamos 'authMiddleware' como segundo argumento.
// ¡Este es el "guardia" en acción!
app.post('/api/favorites', authMiddleware, async (req, res) => {
    try {
        const { city } = req.body;

        // Gracias al 'authMiddleware', ya tenemos el ID del usuario en 'req.userId'
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Evitar duplicados
        if (user.favoriteCities.find(fav => fav.name === city)) {
            return res.status(400).json({ mensaje: 'Esa ciudad ya está en tus favoritos' });
        }

        // Añadir la nueva ciudad y guardar
        user.favoriteCities.push({ name: city });
        await user.save();

        res.status(201).json({ mensaje: 'Ciudad guardada como favorita', favorites: user.favoriteCities });

    } catch (error) {
        console.error("Error al guardar favorito:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// --- ¡NUEVA RUTA PARA OBTENER TODOS LOS FAVORITOS! ---
app.get('/api/favorites', authMiddleware, async (req, res) => {
    try {
        // El guardia 'authMiddleware' nos da el ID del usuario
        const user = await User.findById(req.userId).select('favoriteCities');

        if (!user) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.json(user.favoriteCities);

    } catch (error) {
        console.error("Error al obtener favoritos:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// (Tu ruta GET /api/favorites está aquí arriba...)

// --- ¡NUEVA RUTA PARA ELIMINAR UN FAVORITO! ---
// Usamos app.delete, el método estándar para borrar
app.delete('/api/favorites', authMiddleware, async (req, res) => {
    try {
        // Obtenemos la ciudad a borrar del "body" de la petición
        const { city } = req.body;
        
        // Gracias al 'authMiddleware', tenemos el ID del usuario
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // 1. Buscamos el índice de la ciudad en el array
        const cityIndex = user.favoriteCities.findIndex(fav => fav.name === city);
        
        if (cityIndex === -1) {
            return res.status(404).json({ mensaje: 'Ciudad no encontrada en favoritos' });
        }

        // 2. Usamos .pull() de Mongoose para quitar el elemento del array
        user.favoriteCities.pull(user.favoriteCities[cityIndex]._id);
        
        // 3. Guardamos al usuario con la lista actualizada
        await user.save();

        // 4. Devolvemos la lista actualizada al frontend
        res.json({ 
            mensaje: 'Favorito eliminado', 
            favorites: user.favoriteCities // Enviamos la nueva lista
        });

    } catch (error) {
        console.error("Error al eliminar favorito:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// (Tu ruta DELETE /api/favorites está aquí arriba...)

// --- ¡NUEVA RUTA PARA GEOLOCALIZACIÓN! ---
app.get('/api/weather-by-coords', async (req, res) => {
  try {
    // 1. Obtenemos lat, lon, units, y lang de la URL
    const { lat, lon, units = 'metric', lang = 'es' } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!lat || !lon) {
      return res.status(400).json({ mensaje: "Error: No se proporcionaron coordenadas." });
    }

    // 2. 🌤️ Datos actuales (Llamada por coordenadas)
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}&lang=${lang}`;
    const currentResponse = await axios.get(currentUrl);
    const currentData = currentResponse.data;
    const unitSymbol = units === 'metric' ? 'C' : 'F';

    // 3. 📆 Pronóstico 5 días / 3 horas (Llamada por coordenadas)
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}&lang=${lang}`;
    const forecastResponse = await axios.get(forecastUrl);
    const forecastList = forecastResponse.data.list;

    // 4. Procesar pronóstico 24 horas (8 entradas)
    const pronosticoHoras = forecastList.slice(0, 8).map(hour => {
        const date = new Date(hour.dt * 1000);
        const hora = `${date.getHours().toString().padStart(2, '0')}h`;
        return { hora, temp: Math.round(hour.main.temp) };
    });

    // 5. Procesar pronóstico semanal
    const pronosticoSemanal = procesarPronosticoSemanal(forecastList, lang);

    // 6. URL del Mapa
    const mapTileUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`;

    // 🧩 Clima actual
    const weatherData = {
      ciudad: currentData.name, // Obtenemos el nombre de la ciudad de la API
      descripcion: currentData.weather[0].description,
      temperatura: Math.round(currentData.main.temp),
      min_max: `${Math.round(currentData.main.temp_min)}° / ${Math.round(currentData.main.temp_max)}°`,
      humedad: currentData.main.humidity,
      presion: currentData.main.pressure,
      viento: {
        velocidad: `${Math.round(currentData.wind.speed)} ${(units === 'metric') ? 'km/h' : 'mph'}`,
        direccion: getWindDirection(currentData.wind.deg)
      },
      unit: unitSymbol,
      coords: { lat: currentData.coord.lat, lon: currentData.coord.lon },
      mapTileUrl: mapTileUrl
    };
    
    // 📦 Respuesta final
    res.json({
      ...weatherData,
      pronosticoSemanal,
      pronosticoHoras
    });

  } catch (error) {
    console.error("Error al obtener datos del clima por coordenadas:", error.message);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
});


// (Aquí abajo sigue tu ruta /api/weather, funciones auxiliares, etc.)
// ...

});


// -------------------------------------------
// ---          RUTAS DE LA APP            ---
// -------------------------------------------

app.get('/', (req, res) => {
    res.json({ mensaje: "¡Hola Mundo desde el Backend!" });
});

// (Tus rutas de login, register, etc. están aquí arriba)

// (Tus rutas de auth están aquí arriba...)

// --- RUTA MEJORADA: Usando la API Gratuita /forecast ---
app.get('/api/weather', async (req, res) => {
  try {
    const city = req.query.city;
    const units = req.query.units || 'metric';
    const lang = req.query.lang || 'es';
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!city) {
      return res.status(400).json({ mensaje: "Error: No se proporcionó una ciudad." });
    }

    // 🌤️ 1. Datos actuales (Esta llamada SÍ funciona)
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${units}&lang=${lang}`;
    const currentResponse = await axios.get(currentUrl);
    const currentData = currentResponse.data;
    const unitSymbol = units === 'metric' ? 'C' : 'F';
    const { lat, lon } = currentData.coord;

    // 📆 2. NUEVA llamada: Pronóstico 5 días / 3 horas (Gratuita)
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}&lang=${lang}`;
    const forecastResponse = await axios.get(forecastUrl);
    const forecastList = forecastResponse.data.list;

    // 3. Procesar el pronóstico de 24 horas (las primeras 8 entradas)
    const pronosticoHoras = forecastList.slice(0, 8).map(hour => {
        const date = new Date(hour.dt * 1000);
        const hora = `${date.getHours().toString().padStart(2, '0')}h`;
        return {
            hora,
            temp: Math.round(hour.main.temp)
        };
    });

    // 4. Procesar el pronóstico semanal (5 días)
    const pronosticoSemanal = procesarPronosticoSemanal(forecastList, lang);

    // 5. Añadir la URL del mapa
    const mapTileUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`;

    // 🧩 Clima actual (AVISO: El UV se ha eliminado)
    const weatherData = {
      ciudad: currentData.name,
      descripcion: currentData.weather[0].description,
      temperatura: Math.round(currentData.main.temp),
      min_max: `${Math.round(currentData.main.temp_min)}° / ${Math.round(currentData.main.temp_max)}°`,
      humedad: currentData.main.humidity,
      presion: currentData.main.pressure,
      viento: {
        velocidad: `${Math.round(currentData.wind.speed)} ${(units === 'metric') ? 'km/h' : 'mph'}`,
        direccion: getWindDirection(currentData.wind.deg)
      },
      unit: unitSymbol,
      coords: { lat, lon },
      mapTileUrl: mapTileUrl
    };
    
    // 📦 Respuesta final
    res.json({
      ...weatherData,
      pronosticoSemanal,
      pronosticoHoras
    });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      res.status(404).json({ mensaje: "Ciudad no encontrada" });
    } else {
      console.error("Error al obtener datos del clima:", error.message);
      res.status(500).json({ mensaje: "Error interno del servidor" });
    }
  }
});

// --- NUEVA FUNCIÓN AUXILIAR para procesar el pronóstico de 5 días ---
function procesarPronosticoSemanal(forecastList, lang) {
    const dailyData = {};

    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayString = date.toISOString().split('T')[0]; // Agrupar por 'YYYY-MM-DD'
        
        if (!dailyData[dayString]) {
            dailyData[dayString] = {
                min: item.main.temp_min,
                max: item.main.temp_max,
                icons: [],
                descriptions: []
            };
        } else {
            if (item.main.temp_min < dailyData[dayString].min) dailyData[dayString].min = item.main.temp_min;
            if (item.main.temp_max > dailyData[dayString].max) dailyData[dayString].max = item.main.temp_max;
        }
        
        // Guardar el ícono y descripción de mediodía (aprox) para que sea representativo
        if (date.getHours() >= 12 && date.getHours() <= 15) {
            dailyData[dayString].icons.push(item.weather[0].icon);
            dailyData[dayString].descriptions.push(item.weather[0].description);
        }
    });

    // Formatear la salida para el frontend
    return Object.keys(dailyData).slice(0, 5).map(dayString => {
        const day = dailyData[dayString];
        const date = new Date(dayString + 'T12:00:00'); // Usar mediodía para evitar problemas de zona horaria
        const nombreDia = date.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long' });
        
        return {
            dia: capitalizeFirstLetter(nombreDia),
            min: Math.round(day.min),
            max: Math.round(day.max),
            // Usar el ícono y descripción más comunes, o el primero de mediodía
            icono: `https://openweathermap.org/img/wn/${day.icons[0] || '01d'}.png`, 
            descripcion: day.descriptions[0] || 'Cielo despejado'
        };
    });
}


// ... (El resto de tu server.js)

// --- Función auxiliar para dirección del viento ---
function getWindDirection(deg) {
  const dirs = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'];
  return dirs[Math.round(deg / 45) % 8];
}

// --- Función auxiliar para nivel UV ---
function getUVLevel(uvi) {
  if (uvi < 3) return 'Bajo';
  if (uvi < 6) return 'Moderado';
  if (uvi < 8) return 'Alto';
  if (uvi < 11) return 'Muy alto';
  return 'Extremo';
}

// --- Función auxiliar para capitalizar ---
function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${3000}`);
});