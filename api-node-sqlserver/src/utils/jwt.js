// src/utils/jwt.js
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.JWT_SECRET || 'clave-secreta-en-desarrollo';

export function generarToken(usuario) {
  const payload = {
    id: usuario.IdUsuario,
    nombre: usuario.NombresUsuario,
    correo: usuario.MailUsuario,
  };

  return jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
}
 