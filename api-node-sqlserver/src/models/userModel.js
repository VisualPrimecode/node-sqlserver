import { getConnection } from '../config/database.js';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
/////


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
export async function getUserById(idUsuario) {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('idUsuario', idUsuario)
      .query(`
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
        WHERE IdUsuario = @idUsuario
      `);

    return result.recordset[0]; // Retorna solo un usuario
  } catch (err) {
    throw new Error('Error al obtener usuario por ID: ' + err.message);
  }
}

export async function loginUser(nombreUsuario, password) {
  try {
    const pool = await getConnection();

    console.log('Obteniendo usuario de nombre user:', nombreUsuario);

    const userResult = await pool.request()
      .input('nombreUser', nombreUsuario)
      .query(`
        SELECT 
          IdUsuarioAnterior as 'IdUsuario',
          PassUsuario,
          EstadoUsuario,
          NombreUsuario,
          NombresUsuario,
          ApellidoPaterno,
          ApellidoMaterno,
          IdTipoUsuario,
          MailUsuario
        FROM PullmanFloridaApp.dbo.TB_Usuarios
        WHERE NombreUsuario = @nombreUser
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
export async function registrarDevolucion(devolucion) {
  const {
    idVenta,
    fechaDevolucion,
    monto,
    fechaTransferencia = null,
    numeroTransaccion = null,
    idUsuario,
    comentario = null,
    idCausaDevolucion = null
  } = devolucion;

  try {
    const pool = await getConnection();

    // Verificar si el IdVenta existe y si el registro no está anulado
    const ventaResult = await pool.request()
      .input('IdVenta', sql.Int, idVenta)
      .query(`
        SELECT Anulado
        FROM AppPullmanFlorida.dbo.SGP_Vnt_Venta
        WHERE IdVenta = @IdVenta
      `);

    if (ventaResult.recordset.length === 0) {
      throw new Error('No se encontró ningún registro de venta con el IdVenta proporcionado.');
    }

    const venta = ventaResult.recordset[0];

    if (venta.Anulado) {
      throw new Error('El boleto ya está anulado en SGP_Vnt_Venta.');
    }

    console.log(`(Simulación) Se habría anulado el boleto con IdVenta: ${idVenta}`);

    // Insertar en TB_Devoluciones (idVenta se usará como "NumeroBoleto")
    await pool.request()
      .input('NumeroBoleto', sql.NVarChar, idVenta.toString()) // 👈 Se guarda como string
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

export async function registrarCodigoQR(pool, idVenta, idUsuario, numAsiento) {
  console.log('➡️ Registrando código QR con ID Venta:', idVenta, 'ID Usuario:', idUsuario, 'y Asiento:', numAsiento);

  try {
    // ⚠️ Validar que el ID de venta no esté vacío o inválido
    if (!idVenta || String(idVenta).trim() === '') {
      const mensaje = 'ID de venta vacío o inválido recibido desde el QR';
      const error = new Error(mensaje);
      error._handled = true;
      console.warn('⚠️', mensaje);
      await registrarError(pool, null, idUsuario, mensaje); // No registrar con idVenta inválido
      throw error;
    }

    // Verificar si ya está registrado
    const checkResult = await pool.request()
      .input('IDVENTA', idVenta)
      .query(`
        SELECT COUNT(*) AS count
        FROM PullmanFloridaApp.dbo.Vnt_RegistroBoletos
        WHERE IdVenta = @IDVENTA
      `);

    if (checkResult.recordset[0].count > 0) {
      const mensaje = 'ID de venta duplicado: ya existe en Vnt_RegistroBoletos';
      const error = new Error(mensaje);
      error._handled = true;
      console.warn('⚠️', mensaje);
      await registrarError(pool, idVenta, idUsuario, mensaje);
      throw error;
    }

    // Verificar existencia de la venta
    const ventaResult = await pool.request()
      .input('IDVENTA', idVenta)
      .query(`
        SELECT Anulado, Asiento
        FROM AppPullmanFlorida.dbo.SGP_Vnt_Venta
        WHERE IdVenta = @IDVENTA
      `);

    if (ventaResult.recordset.length === 0) {
      const mensaje = 'ID de venta no existe en SGP_Vnt_Venta';
      const error = new Error(mensaje);
      error._handled = true;
      console.warn('⚠️', mensaje);
      await registrarError(pool, idVenta, idUsuario, mensaje);
      throw error;
    }

    const { Anulado: anulado, Asiento: asientoRegistrado } = ventaResult.recordset[0];

    if (anulado) {
      const mensaje = 'La venta está anulada en SGP_Vnt_Venta';
      const error = new Error(mensaje);
      error._handled = true;
      console.warn('⚠️', mensaje);
      await registrarError(pool, idVenta, idUsuario, mensaje);
      throw error;
    }

    if (String(asientoRegistrado) !== String(numAsiento)) {
      const mensaje = `Asiento inválido: se esperaba '${asientoRegistrado}' pero se recibió '${numAsiento}'`;
      const error = new Error(mensaje);
      error._handled = true;
      console.warn('⚠️', mensaje);
      await registrarError(pool, idVenta, idUsuario, mensaje);
      throw error;
    }

    // Insertar el registro válido si pasó todas las validaciones
    await pool.request()
      .input('IDVENTA', idVenta)
      .input('IDUSUARIO', idUsuario)
      .query(`
        INSERT INTO PullmanFloridaApp.dbo.Vnt_RegistroBoletos (IdVenta, IdUsuario, FechaRegistro)
        VALUES (@IDVENTA, @IDUSUARIO, GETDATE())
      `);

    console.log('✅ Registro QR insertado correctamente');
    return true;

  } catch (err) {
    console.error('❌ Error en registrarCodigoQR:', err.message);
    if (!err._handled) {
      // Registrar error solo si no fue registrado previamente
      await registrarError(pool, idVenta, idUsuario, err.message);
    }
    throw err;
  }
}



export async function registrarError(pool, idVenta, idUsuario, tipoError) {
  const result = await pool.request()
    .input('IDVENTA', idVenta)
    .input('IDUSUARIO', idUsuario)
    .input('tipoerror', tipoError)
    .query(`
      INSERT INTO PullmanFloridaApp.dbo.Vnt_RegistroFallido (IdVenta, IdUsuario, FechaRegistro, TipoError)
      OUTPUT INSERTED.IdRegistroFallido
      VALUES (@IDVENTA, @IDUSUARIO, GETDATE(), @tipoerror)
    `);

  console.log('🆔 ID registro fallido insertado:', result.recordset[0].IdRegistroFallido);
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
export async function getViajesPorFiltros({ idConductor, fecha, hora, idDestino, estado }) {
  try {
    const pool = await getConnection();
    const request = pool.request();

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
      whereClauses.push('t1.hora <= @hora'); // Mostrar viajes con hora menor o igual
      request.input('hora', hora);
    }

    if (idDestino) {
      whereClauses.push('t1.IdDestino = @idDestino');
      request.input('idDestino', idDestino);
    }

    if (estado !== undefined) {
      whereClauses.push('t1.Estado = @estado');
      request.input('estado', estado);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await request.query(`
      SELECT 
        t1.idProgramacion, 
        t1.IdDestino, 
        t1.hora, 
        t1.fecha, 
        t2.NomDestino, 
        t1.IdConductor,
        CONCAT(t4.FirstName,' ',t4.LastName) AS nombreConductor,
        CASE WHEN t1.ViajeActivo = 0 THEN 'En espera' ELSE 'Activo' END AS Iniciado,
        CASE WHEN t1.ViajeFinalizado = 1 THEN 'Finalizado' ELSE 'Activo' END AS Finalizado,
        t3.Ppu,
        t3.Capacidad,
        CASE WHEN t1.Estado = 0 THEN 'Anulado' ELSE 'Vigente' END AS EstadoViaje
      FROM AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas t1 
      INNER JOIN AppPullmanFlorida.dbo.SGP_Mant_Destino t2 ON t2.IdDestino = t1.IdDestino 
      INNER JOIN AppPullmanFlorida.dbo.SGP_Mant_Bus t3 ON t3.IdBus = t1.IdBus
      LEFT JOIN AppPullmanFlorida.dbo.UM_Users t4 ON t4.IdUser = t1.IdConductor
      ${whereSQL}
      ORDER BY t1.hora ASC
    `);
      console.log('Consulta ejecutada:', result.query);
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

export async function registrarGasto(idProgramacion, idTipoGasto, monto, comprobanteRuta, comentarios = null) {
  try {
    const pool = await getConnection();
    const query = `
      INSERT INTO PullmanFloridaApp.dbo.Vnt_RegistroGastos 
      (IdProgramacion, IdTipoGasto, Monto, FechaRegistro, ComprobanteRuta, Comentarios)
      VALUES (@idProgramacion, @idTipoGasto, @monto, GETDATE(), @comprobanteRuta, @comentarios);
    `;

    const request = pool.request();
    request.input('idProgramacion', idProgramacion);
    request.input('idTipoGasto', idTipoGasto);
    request.input('monto', monto);
    request.input('comprobanteRuta', comprobanteRuta);
    request.input('comentarios', comentarios); // nuevo campo opcional

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
      SELECT IdTipoGasto, NombreTipo FROM PullmanFloridaApp.dbo.TB_TipoGastos ORDER BY NombreTipo ASC;
    `);

    return result.recordset;
  } catch (err) {
    console.error('🔥 [ERROR] Error al obtener tipos de gastos:', err.message);
    throw new Error('Error al obtener tipos de gastos: ' + err.message);
  }
}

export async function obtenerCausasDevolucion() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT IdCausa, Descripcion 
      FROM PullmanFloridaApp.dbo.TB_CausasDevolucion 
      WHERE Activo = 1
      ORDER BY IdCausa ASC;
    `);

    return result.recordset;
  } catch (err) {
    console.error('❌ Error al obtener causas de devolución:', err.message);
    throw new Error('Error al obtener causas de devolución: ' + err.message);
  }
}

export async function getConductoresActivos() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        IdUser AS idConductor,
        CONCAT(LastName,' ',FirstName) AS nombre
      FROM AppPullmanFlorida.dbo.UM_Users
      WHERE IdUserLevel = 9 AND status = 1
      ORDER BY LastName
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

export async function anularViajeSimulado(idProgramacion) {
  try {
    const pool = await getConnection();

    // Verificar si el viaje existe y obtener su estado
    const result = await pool.request()
      .input('idProgramacion', sql.Int, idProgramacion)
      .query(`
        SELECT estado, ViajeActivo, ViajeFinalizado
        FROM AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas
        WHERE idProgramacion = @idProgramacion
      `);

    if (result.recordset.length === 0) {
      throw new Error(`No se encontró ningún viaje con idProgramacion = ${idProgramacion}.`);
    }

    const viaje = result.recordset[0];

    if (viaje.estado === 'Anulado' || viaje.ViajeActivo === 0) {
      throw new Error('El viaje ya está anulado o inactivo.');
    }

    // Simulación de anulación (aquí iría la actualización real)
    console.log(`(Simulación) Se habría anulado el viaje con idProgramacion: ${idProgramacion}`);

    /*
    // Código real comentado para futura implementación:
    await pool.request()
      .input('idProgramacion', sql.Int, idProgramacion)
      .query(`
        UPDATE AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas
        SET estado = 'Anulado', ViajeActivo = 0, ViajeFinalizado = 1
        WHERE idProgramacion = @idProgramacion
      `);
    */

    return { success: true, message: `Simulación: viaje con idProgramacion ${idProgramacion} anulado.` };

  } catch (error) {
    throw new Error('Error al simular la anulación del viaje: ' + error.message);
  }
}

export async function asignarViajeAConductor({ idProgramacion, idConductor }) {
  try {
    const pool = await getConnection();

    // Verificar si el viaje existe
    const viajeResult = await pool.request()
      .input('idProgramacion', sql.Int, idProgramacion)
      .query(`
        SELECT IdConductor, ViajeActivo, estado
        FROM AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas
        WHERE idProgramacion = @idProgramacion
      `);

    if (viajeResult.recordset.length === 0) {
      throw new Error('No se encontró el viaje con el idProgramacion proporcionado.');
    }

    const viaje = viajeResult.recordset[0];

    console.log(`(Simulación) Se habría asignado el viaje ${idProgramacion} al conductor ${idConductor}`);

    // Obtener los IdVenta asociados al viaje
    const ventasResult = await pool.request()
      .input('idProgramacion', sql.Int, idProgramacion)
      .query(`
        SELECT v.IdVenta
        FROM AppPullmanFlorida.dbo.SGP_Vnt_Venta v
        INNER JOIN AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas p
          ON v.FechaViaje = p.fecha AND v.HoraSalida = p.hora AND v.IdDestino = p.IdDestino
        WHERE p.idProgramacion = @idProgramacion
      `);

    const idsVenta = ventasResult.recordset.map(row => row.IdVenta);
    console.log(`(Simulación) Se habrían actualizado los siguientes IdVenta con IdUsuario del conductor ${idConductor}:`, idsVenta);

    // Simulación: aquí se comentaría el update real
    /*
    for (const idVenta of idsVenta) {
      await pool.request()
        .input('idVenta', sql.Int, idVenta)
        .input('idConductor', sql.Int, idConductor)
        .query(`
          UPDATE AppPullmanFlorida.dbo.SGP_Vnt_Venta
          SET IdUsuario = @idConductor
          WHERE IdVenta = @idVenta
        `);
    }
    */

    return {
  success: true,
  message: `Se habría asignado el viaje ${idProgramacion} al conductor ${idConductor}`,
  idsVenta: idsVenta,
};
  } catch (error) {
    throw new Error('Error al asignar el viaje: ' + error.message);
  }


}

// models/viajesModel.js
export async function getResumenMensualPorConductor(idConductor, fechaInicio, fechaFin) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        t1.fecha, 
        t1.hora, 
        t2.NomDestino, 
        (
          SELECT COUNT(t3.IdRegistro)
          FROM PullmanFloridaApp.dbo.Vnt_RegistroBoletos t3
          INNER JOIN AppPullmanFlorida.dbo.SGP_Vnt_Venta t4 ON t4.IdVenta = t3.IdVenta
          WHERE 
            t4.IdDestino = t1.IdDestino AND 
            t4.FechaViaje = t1.fecha AND 
            t4.HoraSalida = t1.hora
        ) AS PasajerosTransportados,
        (
          SELECT SUM(t4.Monto)
          FROM PullmanFloridaApp.dbo.Vnt_RegistroBoletos t3
          INNER JOIN AppPullmanFlorida.dbo.SGP_Vnt_Venta t4 ON t4.IdVenta = t3.IdVenta
          WHERE 
            t4.IdDestino = t1.IdDestino AND 
            t4.FechaViaje = t1.fecha AND 
            t4.HoraSalida = t1.hora
        ) AS TotalProduccion
      FROM AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas t1
      INNER JOIN AppPullmanFlorida.dbo.SGP_Mant_Destino t2 ON t2.IdDestino = t1.IdDestino
      WHERE 
        t1.estado = 1 AND 
        t1.fecha BETWEEN '${fechaInicio}' AND '${fechaFin}' AND 
        t1.IdConductor = ${idConductor}
      ORDER BY t1.fecha, t1.hora ASC
    `);
    return result.recordset;
  } catch (error) {
    throw new Error('Error al obtener el resumen mensual: ' + error.message);
  }
}
export async function getGastosPorConductor(idConductor, fechaInicio, fechaFin) {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
     SELECT 
    rg.Monto, 
    rg.IdProgramacion
FROM 
    [PullmanFloridaApp].[dbo].[Vnt_RegistroGastos] rg
INNER JOIN 
    [AppPullmanFlorida].[dbo].[SGP_Prog_ProgSalidas] ps
    ON ps.idProgramacion = rg.IdProgramacion
WHERE 
    ps.IdConductor = ${idConductor} and
    ps.fecha BETWEEN '${fechaInicio}' AND '${fechaFin}';
    `);
    return result.recordset;
  } catch (error) {
    throw new Error('Error al obtener los gastos por conductor: ' + error.message);
  }
}
export async function actualizarEstadoViaje({ idProgramacion, accion }) {
  try {
    const pool = await getConnection();
    const request = pool.request();

    request.input('idProgramacion', idProgramacion);

    let updateQuery = '';

    if (accion === 'iniciar') {
      updateQuery = `
        UPDATE AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas
        SET ViajeActivo = 1, ViajeFinalizado = 0
        WHERE idProgramacion = @idProgramacion
      `;
    } else if (accion === 'finalizar') {
      updateQuery = `
        UPDATE AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas
        SET ViajeFinalizado = 1
        WHERE idProgramacion = @idProgramacion
      `;
    } else {
      throw new Error('Acción inválida. Debe ser "iniciar" o "finalizar".');
    }

    await request.query(updateQuery);

    return { success: true, message: `Viaje ${accion} correctamente.` };
  } catch (error) {
    throw new Error('Error al actualizar estado del viaje: ' + error.message);
  }
}


export async function obtenerDatosQRPorIdVenta(idVenta) {
  try {
    console.log('➡️ Obteniendo datos para el QR con ID Venta:', idVenta);
    const pool = await getConnection();

    // 1. Obtener datos de la venta
    const ventaResult = await pool.request()
      .input('idVenta', sql.Int, idVenta)
      .query(`
        SELECT v.FechaViaje, v.HoraSalida, v.IdDestino, v.Asiento
        FROM AppPullmanFlorida.dbo.SGP_Vnt_Venta v
        WHERE v.IdVenta = @idVenta
      `);

    if (ventaResult.recordset.length === 0) {
      throw new Error(`No se encontró una venta con el IdVenta ${idVenta}`);
    }

    const venta = ventaResult.recordset[0];

    // Formatear fecha a 'YYYY-MM-DD'
    const fechaFormateada = venta.FechaViaje.toISOString().split('T')[0];

    // 2. Obtener el idProgramacion correspondiente
    const programacionResult = await pool.request()
      .input('fecha', sql.Date, venta.FechaViaje)
      .input('hora', sql.VarChar(5), venta.HoraSalida)
      .input('idDestino', sql.Int, venta.IdDestino)
      .query(`
        SELECT idProgramacion
        FROM AppPullmanFlorida.dbo.SGP_Prog_ProgSalidas
        WHERE fecha = @fecha AND hora = @hora AND IdDestino = @idDestino
      `);

    if (programacionResult.recordset.length === 0) {
      throw new Error(`No se encontró una programación para la fecha ${venta.FechaViaje}, hora ${venta.HoraSalida} y destino ${venta.IdDestino}`);
    }

    const idProgramacion = programacionResult.recordset[0].idProgramacion;

    // 3. Retornar datos necesarios para generar el QR
    return {
      idVenta,
      idProgramacion,
      fecha: fechaFormateada,
      hora: venta.HoraSalida,
      asiento: venta.Asiento
    };

  } catch (error) {
    throw new Error(`Error al obtener datos para el QR: ${error.message}`);
  }
}

