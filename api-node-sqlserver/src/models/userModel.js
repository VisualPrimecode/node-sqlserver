import { getConnection } from '../config/database.js';
import jwt from 'jsonwebtoken';
import sql from 'mssql';


export async function registrarDevolucion(devolucion) {
  const {
    numeroBoleto,
    fechaDevolucion,
    monto,
    fechaTransferencia = null,
    numeroTransaccion = null, // aún no se espera desde cliente
    idUsuario,
    comentario = null,
    idCausaDevolucion = null,

    // Nuevos campos para identificar el boleto correctamente
    numeroAsiento,
    fechaViaje,
    idDestino,
    horaSalida
  } = devolucion;

  try {
    const pool = await getConnection();

    // Buscar el IdVenta considerando múltiples condiciones
    console.log('Buscando IdVenta con los siguientes datos:');
    console.log('Número de Boleto:', numeroBoleto);
    console.log('Número de Asiento:', numeroAsiento);
    console.log('Fecha de Viaje:', fechaViaje);
    console.log('ID Destino:', idDestino);
    console.log('Hora de Salida:', horaSalida);
    
    const ventaResult = await pool.request()
      .input('NumBoleto', sql.NVarChar, numeroBoleto)
      .input('numeroAsiento', sql.NVarChar, numeroAsiento)
      .input('FechaViaje', sql.Date, fechaViaje)
      .input('IdDestino', sql.Int, idDestino)
      .input('HoraSalida', sql.NVarChar, horaSalida)
      .query(`
        SELECT IdVenta, Anulado
        FROM AppPullmanFlorida.dbo.SGP_Vnt_Venta
        WHERE NumBoleto = @NumBoleto
          AND Asiento = @numeroAsiento
          AND FechaViaje = @FechaViaje
          AND IdDestino = @IdDestino
          AND HoraSalida = @HoraSalida
      `);

    if (ventaResult.recordset.length === 0) {
      throw new Error('No se encontró ningún boleto que coincida con los datos proporcionados.');
    }

    const venta = ventaResult.recordset[0];

    if (venta.Anulado) {
      throw new Error('El boleto ya está anulado en SGP_Vnt_Venta.');
    }

    const idVenta = venta.IdVenta;

    console.log(`(Simulación) Se habría anulado el boleto con IdVenta: ${idVenta}`);

    // await pool.request()
    //   .input('IdVenta', sql.Int, idVenta)
    //   .query(`
    //     UPDATE AppPullmanFlorida.dbo.SGP_Vnt_Venta
    //     SET Anulado = 1
    //     WHERE IdVenta = @IdVenta
    //   `);

    // Insertar registro en TB_Devoluciones
    await pool.request()
      .input('NumeroBoleto', sql.NVarChar, numeroBoleto)
      .input('FechaDevolucion', sql.Date, fechaDevolucion)
      .input('Monto', sql.Decimal(10, 2), monto)
      .input('FechaTransferencia', sql.Date, fechaTransferencia)
      .input('NumeroTransaccion', sql.NVarChar, numeroTransaccion)
      .input('IdUsuario', sql.Int, idUsuario)
      .input('Comentario', sql.NVarChar, comentario)
      .input('IdCausaDevolucion', sql.Int, idCausaDevolucion)
      .query(`
        INSERT INTO PullmanFloridaApp.dbo.TB_Devoluciones 
        (NumeroBoleto, FechaDevolucion, Monto, FechaTransferencia, NumeroTransaccion, IdUsuario, Comentario, IdCausaDevolucion)
        VALUES (@NumeroBoleto, @FechaDevolucion, @Monto, @FechaTransferencia, @NumeroTransaccion, @IdUsuario, @Comentario, @IdCausaDevolucion)
      `);

    return { success: true };

  } catch (err) {
    throw new Error('Error al registrar la devolución: ' + err.message);
  }
}




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




export async function registrarCodigoQR(pool, idVenta, idUsuario) {
  console.log('➡️ Registrando código QR con ID Venta:', idVenta, 'y ID Usuario:', idUsuario);

  try {
    const checkResult = await pool.request()
      .input('IDVENTA', idVenta)
      .query(`
        SELECT COUNT(*) AS count
        FROM PullmanFloridaApp.dbo.Vnt_RegistroBoletos
        WHERE IdVenta = @IDVENTA
      `);
      const ventaValidaResult = await pool.request()
      .input('IDVENTA', idVenta)
      .query(`
        SELECT COUNT(*) AS count
        FROM AppPullmanFlorida.dbo.SGP_Vnt_Venta
        WHERE IdVenta = @IDVENTA AND Anulado = 0
      `);
    if (ventaValidaResult.recordset[0].count === 0) {
  const mensaje = 'ID de venta no válido o está anulado en SGP_Vnt_Venta';
  console.warn('⚠️', mensaje);
  await registrarError(pool, idVenta, idUsuario, mensaje);
  return false;
}
    if (checkResult.recordset[0].count > 0) {
      const mensaje = 'ID de venta duplicado: ya existe en Vnt_RegistroBoletos';
      console.warn('⚠️', mensaje);
      await registrarError(pool, idVenta, idUsuario, mensaje);
      return false;
    }

    await pool.request()
      .input('IDVENTA', idVenta)
      .input('IDUSUARIO', idUsuario)
      .query(`
        INSERT INTO PullmanFloridaApp.dbo.Vnt_RegistroBoletos (IdVenta, IdUsuario, FechaRegistro)
        VALUES (@IDVENTA, @IDUSUARIO, GETDATE())
      `);

    return true;

  } catch (err) {
    console.error('❌ Error al insertar en Vnt_RegistroBoletos:', err.message);
    await registrarError(pool, idVenta, idUsuario, err.message);
    throw new Error('Error al insertar en Vnt_RegistroBoletos: ' + err.message);
  }
}

// Función auxiliar para registrar en Vnt_RegistroFallido
export async function registrarError(pool, idVenta, idUsuario, tipoError) {
  await pool.request()
    .input('IDVENTA', idVenta)
    .input('IDUSUARIO', idUsuario)
    .input('tipoerror', tipoError)
    .query(`
      INSERT INTO PullmanFloridaApp.dbo.Vnt_RegistroFallido (IdVenta, IdUsuario, FechaRegistro, TipoError)
      VALUES (@IDVENTA, @IDUSUARIO, GETDATE(), @tipoerror)
    `);
}





export async function getViajesPorConductorYFecha(idConductor, fecha) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        t1.idProgramacion, 
        t1.IdDestino, 
        t1.hora, 
        t1.fecha, 
        t2.NomDestino, 
        CASE WHEN t1.ViajeActivo = 0 THEN 'En espera' ELSE 'Activo' END AS Iniciado,
        CASE WHEN t1.ViajeFinalizado = 1 THEN 'Finalizado' ELSE 'Activo' END AS Finalizado,
        t3.Ppu,
        t3.Capacidad
      FROM AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas t1 
      INNER JOIN AppPullmanFlorida.dbo.SGP_Mant_Destino t2 ON t2.IdDestino = t1.IdDestino 
      INNER JOIN AppPullmanFlorida.dbo.SGP_Mant_Bus t3 ON t3.IdBus = t1.IdBus
      WHERE t1.IdConductor = ${idConductor} AND t1.fecha = '${fecha}'
      ORDER BY t1.hora ASC
    `);
    return result.recordset;
  } catch (error) {
    throw new Error('Error al obtener los viajes: ' + error.message);
  }
}
export async function getViajesPorFiltros({ idConductor, fecha, hora, idDestino }) {
  try {
    const pool = await getConnection();
    const request = pool.request();

    // Construcción dinámica de filtros
    const whereClauses = [];

    if (idConductor) {
      whereClauses.push('t1.IdConductor = @idConductor');
      request.input('idConductor', idConductor);
    }

    if (fecha) {
      whereClauses.push('t1.fecha = @fecha');
      request.input('fecha', fecha);
    }

    if (hora) {
      whereClauses.push('t1.hora = @hora');
      request.input('hora', hora);
    }

    if (idDestino) {
      whereClauses.push('t1.IdDestino = @idDestino');
      request.input('idDestino', idDestino);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await request.query(`
      SELECT 
        t1.idProgramacion, 
        t1.IdDestino, 
        t1.hora, 
        t1.fecha, 
        t2.NomDestino, 
        CASE WHEN t1.ViajeActivo = 0 THEN 'En espera' ELSE 'Activo' END AS Iniciado,
        CASE WHEN t1.ViajeFinalizado = 1 THEN 'Finalizado' ELSE 'Activo' END AS Finalizado,
        t3.Ppu,
        t3.Capacidad
      FROM AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas t1 
      INNER JOIN AppPullmanFlorida.dbo.SGP_Mant_Destino t2 ON t2.IdDestino = t1.IdDestino 
      INNER JOIN AppPullmanFlorida.dbo.SGP_Mant_Bus t3 ON t3.IdBus = t1.IdBus
      ${whereSQL}
      ORDER BY t1.hora ASC
    `);

    return result.recordset;
  } catch (error) {
    throw new Error('Error al obtener los viajes: ' + error.message);
  }
}

export async function getAsientosPorProgramacion(idProgramacion) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        t1.IdAsiento, 
        CAST(ISNULL(t3.IdVenta, 0) AS INT) AS Vendido, 
        CAST(ISNULL(t4.IdRegistro, 0) AS INT) AS Registrado    
      FROM PullmanFloridaApp.dbo.TB_MatrizAsientos t1 
      LEFT OUTER JOIN AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas t2 ON t2.idProgramacion = ${idProgramacion}
      LEFT OUTER JOIN AppPullmanFlorida.dbo.SGP_Vnt_Venta t3 ON t3.Asiento = t1.IdAsiento 
        AND t3.FechaViaje = t2.fecha 
        AND t3.IdDestino = t2.IdDestino 
        AND t3.HoraSalida = t2.hora 
        AND t3.Anulado = 0 
      LEFT OUTER JOIN PullmanFloridaApp.dbo.Vnt_RegistroBoletos t4 ON t4.IdVenta = t3.IdVenta 
      ORDER BY t1.IdAsiento ASC;
    `);
    return result.recordset;
  } catch (err) {
    throw new Error('Error al obtener asientos: ' + err.message);
  }

}
export async function registrarGasto(idProgramacion, idTipoGasto, monto, comprobanteRuta) {
  try {
    const pool = await getConnection();
    const query = `
      INSERT INTO PullmanFloridaApp.dbo.Vnt_RegistroGastos 
      (IdProgramacion, IdTipoGasto, Monto, FechaRegistro, ComprobanteRuta)
      VALUES (@idProgramacion, @idTipoGasto, @monto, GETDATE(), @comprobanteRuta);
    `;

    const request = pool.request();
    request.input('idProgramacion', idProgramacion);
    request.input('idTipoGasto', idTipoGasto); // <- cambio aquí
    request.input('monto', monto);
    request.input('comprobanteRuta', comprobanteRuta);

    await request.query(query);

    return { success: true, message: 'Gasto registrado correctamente' };
  } catch (err) {
    console.error('🔥 [ERROR] Error al registrar gasto:', err.message);
    throw new Error('Error al registrar gasto: ' + err.message);
  }
}
export async function obtenerTiposGastos() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT IdTipoGasto, NombreTipo FROM PullmanFloridaApp.dbo.TB_TipoGastos ORDER BY IdTipoGasto ASC;
    `);

    return result.recordset;
  } catch (err) {
    console.error('🔥 [ERROR] Error al obtener tipos de gastos:', err.message);
    throw new Error('Error al obtener tipos de gastos: ' + err.message);
  }
}

export async function getConductoresActivos() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        IdUser AS idConductor,
        CONCAT(FirstName, ' ', LastName) AS nombre
      FROM AppPullmanFlorida.dbo.UM_Users
      WHERE IdUserLevel = 9 AND status = 1
      ORDER BY FirstName, LastName
    `);

    return result.recordset;
  } catch (error) {
    throw new Error('Error al obtener los conductores: ' + error.message);
  }
}
export async function getRutasPorConductor(idConductor) {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('idConductor', sql.Int, idConductor)
      .query(`
        SELECT DISTINCT 
          t2.IdDestino AS idRuta,
          t2.NomDestino AS nombreRuta
        FROM AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas t1
        INNER JOIN AppPullmanFlorida.dbo.SGP_Mant_Destino t2 ON t2.IdDestino = t1.IdDestino
        WHERE t1.IdConductor = @idConductor
        ORDER BY t2.NomDestino
      `);

    return result.recordset;
  } catch (error) {
    throw new Error('Error al obtener las rutas por conductor: ' + error.message);
  }
}

