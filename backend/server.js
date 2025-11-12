console.log("¡¡¡--- ESTA ES LA VERSIÓN MÁS NUEVA DEL SERVIDOR ---!!!");
require('dotenv').config();
console.log('CLAVE SECRETA CARGADA:', process.env.JWT_SECRET);
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const { OAuth2Client } = require('google-auth-library');

const User = require('./models/User');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Conexión a la Base de Datos ---
// ¡SINTAXIS CORREGIDA!
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log('✅ Conectado a MongoDB Atlas'))
    .catch((err) => console.error('Error al conectar a MongoDB:', err));

// ¡CORREGIDO! Estas líneas deben ir DESPUÉS de la cadena .then/.catch
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -------------------------------------------
// ---          RUTAS DE AUTENTICACIÓN     ---
// -------------------------------------------

// --- RUTA DE REGISTRO ---
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
        });
        await newUser.save();

        const verificationToken = jwt.sign(
            { userId: newUser._id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } 
        );
        
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email.html?token=${verificationToken}`;
        
        const msg = {
            to: email,
            from: 'goldmaster288pro@gmail.com', // ¡RECUERDA USAR TU EMAIL VERIFICADO!
            subject: '¡Verifica tu cuenta en la App del Clima!',
            html: `<h1>¡Bienvenido a la App del Clima!</h1>
                   <p>Por favor, haz clic en el siguiente enlace para verificar tu cuenta:</p>
                   <a href="${verificationUrl}">Verificar mi cuenta</a>
                   <p>Este enlace expirará en 15 minutos.</p>`,
        };
        await sgMail.send(msg);
        res.status(201).json({ 
            mensaje: 'Usuario registrado. ¡Por favor, revisa tu email para verificar tu cuenta!' 
        });
    } catch (error) {
        console.error("Error en el registro:", error.response ? error.response.body : error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// --- RUTA DE LOGIN ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ mensaje: 'Email y contraseña son obligatorios' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas' }); 
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ mensaje: 'Credenciales inválidas' });
        }
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({ 
            token: token, 
            email: user.email 
        });
    } catch (error) {
        console.error("Error en el login:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// --- RUTA DE VERIFICACIÓN DE EMAIL ---
app.post('/api/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ mensaje: 'No se proporcionó token.' });
        }
        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ mensaje: 'El token es inválido o ha expirado.' });
        }
        const user = await User.findById(payload.userId);
        if (!user) {
            return res.status(400).json({ mensaje: 'Usuario no encontrado.' });
        }
        user.isVerified = true;
        await user.save();
        res.json({ mensaje: '¡Cuenta verificada exitosamente! Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error("Error en la verificación:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// --- RUTA DE LOGIN CON GOOGLE ---
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        if (!email) {
            return res.status(400).json({ mensaje: 'Error al obtener email de Google' });
        }
        let user = await User.findOne({ email: email });
        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-8);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);
            user = new User({
                email: email,
                password: hashedPassword,
                isVerified: true
            });
            await user.save();
        }
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({
            token: token,
            email: user.email
        });
    } catch (error) {
        console.error("Error en el login con Google:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// --- RUTA: SOLICITUD DE RECUPERAR CONTRASEÑA ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({ mensaje: 'Si existe una cuenta con este email, se ha enviado un enlace de recuperación.' });
        }

        const resetToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET, 
            { expiresIn: '10m' }
        );

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;

        const msg = {
            to: email,
            from: 'goldmaster288pro@gmail.com', // ¡RECUERDA USAR TU EMAIL VERIFICADO!
            subject: 'Restablecimiento de contraseña de iWeather',
            html: `<h1>¿Olvidaste tu contraseña?</h1>
                   <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace:</p>
                   <a href="${resetUrl}">Restablecer mi contraseña</a>
                   <p>Este enlace expirará en 10 minutos.</p>`,
        };
        await sgMail.send(msg);
        res.json({ mensaje: 'Si existe una cuenta con este email, se ha enviado un enlace de recuperación.' });

    } catch (error) {
        console.error("Error en forgot-password:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// --- RUTA: CONFIRMAR LA NUEVA CONTRASEÑA ---
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ mensaje: 'Token y nueva contraseña son obligatorios.' });
        }

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ mensaje: 'El token es inválido o ha expirado.' });
        }

        const user = await User.findById(payload.userId);
        if (!user) {
            return res.status(400).json({ mensaje: 'Usuario no encontrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        await user.save();
        res.json({ mensaje: '¡Contraseña actualizada exitosamente! Ya puedes iniciar sesión.' });

    } catch (error) {
        console.error("Error en reset-password:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});


// -------------------------------------------
// ---      RUTAS DE CIUDADES FAVORITAS    ---
// -------------------------------------------

app.post('/api/favorites', authMiddleware, async (req, res) => {
    try {
        const { city } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }
        if (user.favoriteCities.find(fav => fav.name === city)) {
            return res.status(400).json({ mensaje: 'Esa ciudad ya está en tus favoritos' });
        }
        user.favoriteCities.push({ name: city });
        await user.save();
        res.status(201).json({ mensaje: 'Ciudad guardada como favorita', favorites: user.favoriteCities });
    } catch (error) {
        console.error("Error al guardar favorito:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

app.get('/api/favorites', authMiddleware, async (req, res) => {
    try {
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

app.delete('/api/favorites', authMiddleware, async (req, res) => {
    try {
        const { city } = req.body;
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }
        const cityIndex = user.favoriteCities.findIndex(fav => fav.name === city);
        if (cityIndex === -1) {
            return res.status(404).json({ mensaje: 'Ciudad no encontrada en favoritos' });
        }
        user.favoriteCities.pull(user.favoriteCities[cityIndex]._id);
        await user.save();
        res.json({ 
            mensaje: 'Favorito eliminado', 
            favorites: user.favoriteCities
        });
    } catch (error) {
        console.error("Error al eliminar favorito:", error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});


// -------------------------------------------
// ---          RUTAS DE LA APP            ---
// -------------------------------------------

app.get('/', (req, res) => {
    res.json({ mensaje: "¡Hola Mundo desde el Backend!" });
});

// --- RUTA DE GEOLOCALIZACIÓN ---
app.get('/api/weather-by-coords', async (req, res) => {
  try {
    const { lat, lon, units = 'metric', lang = 'es' } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!lat || !lon) {
      return res.status(400).json({ mensaje: "Error: No se proporcionaron coordenadas." });
    }

    // 1. Datos actuales
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}&lang=${lang}`;
    const currentResponse = await axios.get(currentUrl);
    const currentData = currentResponse.data;
    const unitSymbol = units === 'metric' ? 'C' : 'F';
    const { lat: resLat, lon: resLon } = currentData.coord; // Renombrar para evitar conflicto

    // 2. Pronóstico
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${resLat}&lon=${resLon}&appid=${apiKey}&units=${units}&lang=${lang}`;
    const forecastResponse = await axios.get(forecastUrl);
    const forecastList = forecastResponse.data.list;

    // 3. Procesar 24 horas
    const pronosticoHoras = forecastList.slice(0, 8).map(hour => {
        const date = new Date(hour.dt * 1000);
        const hora = `${date.getHours().toString().padStart(2, '0')}h`;
        return { hora, temp: Math.round(hour.main.temp) };
    });

    // 4. Procesar semanal
    const pronosticoSemanal = procesarPronosticoSemanal(forecastList, lang);

    // 5. Mapa
    const mapTileUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`;

    // 6. Objeto de Datos
    const weatherData = {
      ciudad: currentData.name,
      descripcion: currentData.weather[0].description,
      icono: currentData.weather[0].icon,
      temperatura: Math.round(currentData.main.temp),
      min_max: `${Math.round(currentData.main.temp_min)}° / ${Math.round(currentData.main.temp_max)}°`,
      humedad: currentData.main.humidity,
      presion: currentData.main.pressure,
      viento: {
        velocidad: `${Math.round(currentData.wind.speed)} ${(units === 'metric') ? 'km/h' : 'mph'}`,
        direccion: getWindDirection(currentData.wind.deg)
      },
      unit: unitSymbol,
      coords: { lat: resLat, lon: resLon },
      mapTileUrl: mapTileUrl
    };
    
    // 7. Respuesta
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

// --- RUTA DE CLIMA POR NOMBRE (La principal) ---
app.get('/api/weather', async (req, res) => {
  try {
    const { city, units = 'metric', lang = 'es' } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!city) {
      return res.status(400).json({ mensaje: "Error: No se proporcionó una ciudad." });
    }

    // 1. Datos actuales
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${units}&lang=${lang}`;
    const currentResponse = await axios.get(currentUrl);
    const currentData = currentResponse.data;
    const unitSymbol = units === 'metric' ? 'C' : 'F';
    const { lat, lon } = currentData.coord;

    // 2. Pronóstico
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}&lang=${lang}`;
    const forecastResponse = await axios.get(forecastUrl);
    const forecastList = forecastResponse.data.list;

    // 3. Procesar 24 horas
    const pronosticoHoras = forecastList.slice(0, 8).map(hour => {
        const date = new Date(hour.dt * 1000);
        const hora = `${date.getHours().toString().padStart(2, '0')}h`;
        return { hora, temp: Math.round(hour.main.temp) };
    });

    // 4. Procesar semanal
    const pronosticoSemanal = procesarPronosticoSemanal(forecastList, lang);

    // 5. Mapa
    const mapTileUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`;

    // 6. Objeto de Datos
    const weatherData = {
      ciudad: currentData.name,
      descripcion: currentData.weather[0].description,
      icono: currentData.weather[0].icon,
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
    
    // 7. Respuesta
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

// --- Funciones Auxiliares ---

function procesarPronosticoSemanal(forecastList, lang) {
    const dailyData = {};
    forecastList.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayString = date.toISOString().split('T')[0]; 
        if (!dailyData[dayString]) {
            dailyData[dayString] = { min: item.main.temp_min, max: item.main.temp_max, icons: [], descriptions: [] };
        } else {
            if (item.main.temp_min < dailyData[dayString].min) dailyData[dayString].min = item.main.temp_min;
            if (item.main.temp_max > dailyData[dayString].max) dailyData[dayString].max = item.main.temp_max;
        }
        if (date.getHours() >= 12 && date.getHours() <= 15) {
            dailyData[dayString].icons.push(item.weather[0].icon);
            dailyData[dayString].descriptions.push(item.weather[0].description);
        }
    });
    return Object.keys(dailyData).slice(0, 5).map(dayString => {
        const day = dailyData[dayString];
        const date = new Date(dayString + 'T12:00:00');
        const nombreDia = date.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'long' });
        return {
            dia: capitalizeFirstLetter(nombreDia),
            min: Math.round(day.min),
            max: Math.round(day.max),
            icono: `https://openweathermap.org/img/wn/${day.icons[0] || '01d'}.png`, 
            descripcion: day.descriptions[0] || 'Cielo despejado'
        };
    });
}

function getWindDirection(deg) {
  const dirs = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'];
  return dirs[Math.round(deg / 45) % 8];
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// (Ya no usamos UV, así que la función getUVLevel() se puede borrar,
// pero la dejaré por si acaso, no hace daño)
function getUVLevel(uvi) {
  if (uvi < 3) return 'Bajo';
  if (uvi < 6) return 'Moderado';
  if (uvi < 8) return 'Alto';
  if (uvi < 11) return 'Muy alto';
  return 'Extremo';
}

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});