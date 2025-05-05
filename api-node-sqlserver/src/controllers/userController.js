// src/controllers/userController.js
import { getAllUsers,  loginUser as loginUserModel, registrarCodigoQR } from '../models/UserModel.js';


export const registrarCodigoQRController = async (req, res) => {
  const { codigo } = req.body;

  if (!codigo) {
    return res.status(400).json({ message: 'Código QR requerido' });
  }

  try {
    const exito = await registrarCodigoQR(codigo);

    if (exito) {
      return res.status(200).json({ message: 'Código QR recibido y guardado correctamente' });
    } else {
      return res.status(500).json({ message: 'Error al guardar el código QR' });
    }
  } catch (error) {
    console.error('Error al registrar código QR:', error.message);
    return res.status(500).json({ message: 'Error al procesar código QR', error: error.message });
  }
};

export async function listUsers(req, res) {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y password requeridos' });
  }

  try {
    const user = await loginUserModel(email, password);

    if (!user || user.error) {
      // Detectar errores específicos
      switch (user?.error) {
        case 'Usuario no encontrado':
          return res.status(404).json({ message: 'El usuario no existe' });
        case 'Contraseña incorrecta':
          return res.status(401).json({ message: 'La contraseña ingresada es incorrecta' });
        case 'Usuario inactivo':
          return res.status(403).json({ message: 'El usuario está inactivo, contacta al administrador' });
        default:
          return res.status(401).json({ message: 'Credenciales inválidas' });
      }
    }

    // Usuario autenticado correctamente
    return res.status(200).json({
      message: 'Login exitoso',
      user,
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Error del servidor',
      error: error.message,
    });
  }
};

