const mongoose = require('mongoose');

// 1. Definimos el "Schema" (el molde) del usuario
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true, // El email es obligatorio
        unique: true,   // No puede haber dos emails iguales
        lowercase: true, // Siempre se guarda en minúsculas
        trim: true      // Quita espacios en blanco al inicio y al final
    },
    password: {
        type: String,
        required: true  // La contraseña es obligatoria
    },

isVerified: {
    type: Boolean,
    default: false
},
    // Aquí es donde guardaremos las ciudades favoritas
    favoriteCities: [
        {
            name: String // Guardaremos una lista de nombres de ciudades
        }
    ]
});

// 2. Exportamos el "Model" (el objeto que nos deja interactuar
//    con la colección "users" en la base de datos)
module.exports = mongoose.model('User', userSchema);