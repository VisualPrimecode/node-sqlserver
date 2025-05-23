import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { guardarRefreshToken, validarRefreshToken } from '../services/tokenService.js';
import { loginUser as loginUserModel} from '../models/userModel.js'; // ¡No olvides este import si aún no lo tienes!

// REFRESH TOKEN CONTROLLER
export const refreshTokenController = async (req, res) => {
  console.log('🔄 [refreshTokenController] Iniciado');

  const { userId, refreshToken } = req.body;
  console.log('🧾 Datos recibidos:', { userId, refreshToken });

  if (!userId || !refreshToken) {
    console.warn('⚠️ Faltan datos');
    return res.status(400).json({ message: 'Faltan datos requeridos' });
  }

  try {
    const valido = await validarRefreshToken(userId, refreshToken);
    console.log('✅ Refresh token válido:', valido);

    if (!valido) {
      console.warn('❌ Token inválido');
      return res.status(403).json({ message: 'Refresh token inválido o expirado' });
    }

    const newAccessToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: '60s' }
    );

    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    await guardarRefreshToken(userId, newRefreshToken);
    console.log('🔐 Nuevo refresh token generado y guardado');

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('❗ Error en refreshTokenController:', error);
    return res.status(500).json({ message: 'Error interno', error: error.message });
  }
};


// LOGIN JWT CONTROLLER
export const loginUserJWT = async (req, res) => {
  console.log('🔐 [loginUserJWT] Iniciado');

  const { email, password } = req.body;
  console.log('📧 Datos de login:', { email });

  if (!email || !password) {
    console.warn('⚠️ Faltan email o password');
    return res.status(400).json({ message: 'Email y password requeridos' });
  }

  try {
    const user = await loginUserModel(email, password);
    console.log('👤 Resultado loginUserModel:', user);

    if (!user || user.error) {
      console.warn('❌ Error en login:', user?.error);
      switch (user?.error) {
        case 'Usuario no encontrado':
          return res.status(404).json({ message: 'El usuario no existe' });
        case 'Contraseña incorrecta':
          return res.status(401).json({ message: 'Contraseña incorrecta' });
        case 'Usuario inactivo':
          return res.status(403).json({ message: 'El usuario está inactivo' });
        default:
          return res.status(401).json({ message: 'Credenciales inválidas' });
      }
    }

    const token = jwt.sign(
      {
        id: user.IdUsuario,
        email: user.MailUsuario,
        tipo: user.IdTipoUsuario,
      },
      process.env.JWT_SECRET,
      { expiresIn: '60s' }
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    await guardarRefreshToken(user.IdUsuario, refreshToken);

    console.log('✅ Login exitoso, tokens generados');
    return res.status(200).json({
      message: 'Login exitoso con JWT',
      token,
      refreshToken,
      user,
    });

  } catch (error) {
    console.error('❗ Error en loginUserJWT:', error);
    return res.status(500).json({
      message: 'Error del servidor',
      error: error.message,
    });
  }
};
