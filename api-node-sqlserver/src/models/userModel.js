import { getConnection } from '../config/database.js';

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
    const result = await pool.request()
      .input('email', email)
      .input('password', password)
      .query(`
        SELECT 
          IdUsuario,
          NombreUsuario,
          NombresUsuario,
          ApellidoPaterno,
          ApellidoMaterno,
          IdTipoUsuario,
          MailUsuario,
          EstadoUsuario
        FROM PullmanFloridaApp.dbo.TB_Usuarios
        WHERE MailUsuario = @email AND PassUsuario = @password
      `);

    if (result.recordset.length === 0) {
      return null; // Credenciales incorrectas
    }

    return result.recordset[0]; // Usuario autenticado
  } catch (err) {
    throw new Error('Error en login: ' + err.message);
  }
}

