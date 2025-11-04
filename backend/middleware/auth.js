const jwt = require('jsonwebtoken');

// Este es nuestro "guardia" de seguridad
module.exports = function(req, res, next) {
    // 1. Obtener el token del "header" de la petición
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ mensaje: 'No hay token, permiso denegado' });
    }

    // 2. Extraer el token (quitar "Bearer ")
    const token = authHeader.split(' ')[1]; 
    if (!token) {
        return res.status(401).json({ mensaje: 'Formato de token inválido' });
    }

    try {
        // 3. Verificar el token
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        
        // 4. Añadimos los datos del usuario (el ID) al objeto 'req'
        req.userId = payload.userId;
        
        // 5. Dejamos pasar la petición
        next(); 

    } catch (err) {
        res.status(401).json({ mensaje: 'Token no es válido' });
    }
};