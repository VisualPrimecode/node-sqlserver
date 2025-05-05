import { getConnection } from '../config/database.js';
import jwt from 'jsonwebtoken';

export async function getAllUsers() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        IdUsuario,
        NombreUsuario,
        PassUsuario,
        NombresUsuario,
        ApellidoPaterno,
        ApellidoMaterno,
        IdTipoUsuario,
        MailUsuario,
        EstadoUsuario
      FROM PullmanFloridaApp.dbo.TB_Usuarios
    `);
    return result.recordset;
  } catch (err) {
    throw new Error('Error al obtener usuarios: ' + err.message);
  }
}
export async function loginUser(email, password) {
  try {
    const pool = await getConnection();

    console.log('Obteniendo usuario con email:', email);

    const userResult = await pool.request()
      .input('email', email)
      .query(`
        SELECT 
          IdUsuario,
          PassUsuario,
          EstadoUsuario,
          NombreUsuario,
          NombresUsuario,
          ApellidoPaterno,
          ApellidoMaterno,
          IdTipoUsuario,
          MailUsuario
        FROM PullmanFloridaApp.dbo.TB_Usuarios
        WHERE MailUsuario = @email
      `);

    if (userResult.recordset.length === 0) {
      console.log('Usuario no encontrado en la base de datos.');
      return { error: 'Usuario no encontrado' };
    }

    const user = userResult.recordset[0];
    console.log('Usuario encontrado:', user);

    // Paso 2: Verificar contraseña
    if (user.PassUsuario !== password) {
      console.log('Contraseña incorrecta. Ingresada:', password, 'Esperada:', user.PassUsuario);
      return { error: 'Contraseña incorrecta' };
    }

    // Paso 3: Verificar estado
   
    if (user.EstadoUsuario !== false) {
      console.log('Usuario inactivo.');
      return { error: 'Usuario inactivo' };
    }
    

    delete user.PassUsuario;
    console.log('Usuario autenticado correctamente:', user);
    return user;

  } catch (err) {
    console.error('Error en login:', err.message);
    throw new Error('Error en login: ' + err.message);
  }
}




export async function registrarCodigoQR(codigo) {
  try {
    const pool = await getConnection(); // Obtienes la conexión desde tu archivo de configuración
    const result = await pool.request()
      .input('codigo', codigo)  // Solo pasas el valor directamente (sin especificar el tipo)
      .query(`
        INSERT INTO PullmanFloridaApp.dbo.QRRegistros (CodigoQR)
        VALUES (@codigo)
      `);

    return result.rowsAffected[0] > 0; // Devuelve true si la inserción fue exitosa
  } catch (err) {
    throw new Error('Error al insertar código QR: ' + err.message);
  }
}
