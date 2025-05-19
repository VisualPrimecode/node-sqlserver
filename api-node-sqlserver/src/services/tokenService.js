// src/services/tokenService.js
import { getConnection } from '../config/database.js';

// Guarda un nuevo refresh token en la base de datos
export const guardarRefreshToken = async (userId, refreshToken) => {
  const pool = await getConnection();

  // Puedes definir aquí cuánto dura el token (ej: 7 días)
  const fechaExpiracion = new Date();
  fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

  await pool.request()
    .input('IdUsuario', userId)
    .input('Token', refreshToken)
    .input('ExpiraEn', fechaExpiracion)
    .query(`
      INSERT INTO PullmanFloridaApp.dbo.TB_RefreshTokens (IdUsuario, Token, ExpiraEn)
      VALUES (@IdUsuario, @Token, @ExpiraEn)
    `);

  console.log(`✅ Refresh token persistido para user ${userId}`);
};

// Valida que un refresh token sea válido para un usuario
export const validarRefreshToken = async (userId, refreshToken) => {
  const pool = await getConnection();
  const result = await pool.request()
    .input('IdUsuario', userId)
    .input('Token', refreshToken)
    .query(`
      SELECT TOP 1 *
      FROM PullmanFloridaApp.dbo.TB_RefreshTokens
      WHERE IdUsuario = @IdUsuario
        AND Token = @Token
        AND (ExpiraEn IS NULL OR ExpiraEn > GETDATE())
    `);

  const valido = result.recordset.length > 0;
  console.log(`🧐 Token válido: ${valido}`);
  return valido;
};

// Opcional: elimina un refresh token (para logout o rotación)
export const eliminarRefreshToken = async (userId, refreshToken) => {
  const pool = await getConnection();
  await pool.request()
    .input('IdUsuario', userId)
    .input('Token', refreshToken)
    .query(`
      DELETE FROM PullmanFloridaApp.dbo.TB_RefreshTokens
      WHERE IdUsuario = @IdUsuario AND Token = @Token
    `);

  console.log(`❌ Refresh token eliminado para user ${userId}`);
};