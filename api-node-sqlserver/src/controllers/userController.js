// src/controllers/userController.js
import { getAllUsers,  loginUser as loginUserModel } from '../models/UserModel.js';

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

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // En este punto podrías generar un JWT, si querés manejar sesiones
    return res.json({ message: 'Login exitoso', user });
  } catch (error) {
    return res.status(500).json({ message: 'Error del servidor', error: error.message });
  }
};