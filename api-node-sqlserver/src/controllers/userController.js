// src/controllers/userController.js
import { 
        getAllUsers,
        registrarCodigoQR,
        getViajesPorConductorYFecha,
        getAsientosPorProgramacion,
        registrarError,
        registrarGasto,
        obtenerTiposGastos,
        getViajesPorFiltros,
        getConductoresActivos,
        getRutasPorConductor,
        registrarDevolucion,
        obtenerCausasDevolucion,
        anularViajeSimulado,
        asignarViajeAConductor
      } from '../models/userModel.js';
import { getConnection } from '../config/database.js';
import path from 'path';
import fs from 'fs';

export async function registrarDevolucionHandler(req, res) {
  const {
    idVenta,
    fechaDevolucion,
    monto,
    fechaTransferencia,
    numeroTransaccion,
    idUsuario,
    comentario,
    idCausaDevolucion
  } = req.body;

  // Validación básica de campos obligatorios
  const camposFaltantes = [];

  if (!idVenta) camposFaltantes.push('idVenta');
  if (!fechaDevolucion) camposFaltantes.push('fechaDevolucion');
  if (!monto) camposFaltantes.push('monto');
  if (!idUsuario) camposFaltantes.push('idUsuario');

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      message: `Faltan los siguientes campos obligatorios: ${camposFaltantes.join(', ')}.`
    });
  }

  try {
    await registrarDevolucion({
      idVenta,
      fechaDevolucion,
      monto,
      fechaTransferencia,
      numeroTransaccion,
      idUsuario,
      comentario,
      idCausaDevolucion
    });

    return res.status(201).json({ message: 'Devolución registrada correctamente.' });

  } catch (error) {
    const msg = error.message || 'Error interno al registrar la devolución.';

    if (
      msg.includes('no se encontró') ||
      msg.includes('ya está anulado')
    ) {
      return res.status(409).json({ message: msg });
    }

    console.error('[ERROR] al registrar devolución:', msg);
    return res.status(500).json({ message: 'Error interno al registrar la devolución.' });
  }
}



export async function getRutasPorConductorHandler(req, res) {
  const { idConductor } = req.query;

  if (!idConductor) {
    return res.status(400).json({ message: 'Falta el parámetro idConductor' });
  }

  try {
    const rutas = await getRutasPorConductor(idConductor);
    res.status(200).json(rutas);
  } catch (error) {
    console.error('[ERROR] al obtener rutas por conductor:', error.message);
    res.status(500).json({ message: 'Error interno al obtener rutas' });
  }
}

export async function obtenerConductoresActivos(req, res) {
  try {
    const conductores = await getConductoresActivos();
    res.status(200).json(conductores);
  } catch (error) {
    console.error('❌ [ERROR] al obtener conductores activos:', error.message);
    res.status(500).json({ message: 'Error al obtener conductores activos' });
  }
}
export async function getAsientos(req, res) {
  console.log("🚩 [DEBUG] Entrando a getAsientos");

  const { idProgramacion } = req.query;

  if (!idProgramacion) {
    console.error("❌ [ERROR] idProgramacion no definido en req.query");
    return res.status(400).json({ message: 'Parámetro idProgramacion requerido' });
  }

  console.log("🚩 [DEBUG] idProgramacion recibido:", idProgramacion);

  try {
    const asientos = await getAsientosPorProgramacion(idProgramacion);

    // Devuelve el resultado crudo directamente
    res.status(200).json(asientos);
  } catch (error) {
    console.error('🔥 [ERROR] Error al obtener asientos:', error.message);
    res.status(500).json({ message: 'Error al obtener los asientos' });
  }
}


export const obtenerViajes = async (req, res) => {
  const idConductor = req.query.idConductor || 162;
  const fecha = req.query.fecha || '30-04-2025';

  try {
    const viajes = await getViajesPorConductorYFecha(idConductor, fecha);
    res.status(200).json(viajes);
  } catch (error) {
    console.error('❌ Error en obtenerViajes:', error.message);
    res.status(500).json({ message: 'Error al obtener viajes', error: error.message });
  }
};
export const obtenerViajesConFiltros = async (req, res) => {
  try {
    console.log("🚩 [DEBUG] Entrando a obtenerViajesConFiltros");
    console.log("🚩 [DEBUG] Parámetros recibidos:", req.query);

    const { idConductor, fecha, hora, idDestino, estado } = req.query;

    

    // Validación: al menos un filtro debe estar presente
    if (!idConductor && !fecha && !hora && !idDestino && estado === undefined) {
      return res.status(400).json({ message: 'Debe incluir al menos un parámetro de filtro.' });
    }

    const filtros = {
      idConductor: idConductor ? parseInt(idConductor) : undefined,
      fecha,
      hora,
      idDestino: idDestino ? parseInt(idDestino) : undefined,
      estado: estado !== undefined ? parseInt(estado) : undefined, // <-- estado puede ser 0 o 1
    };

    const viajes = await getViajesPorFiltros(filtros);
    res.status(200).json(viajes);
  } catch (error) {
    console.error('❌ Error en obtenerViajes:', error.message);
    res.status(500).json({ message: 'Error al obtener viajes', error: error.message });
  }
};



function normalizarHora(hora) {
  const [h, m] = hora.split(':');
  return `${parseInt(h, 10)}:${m}`;
}


export const registrarCodigoQRController = async (req, res) => { 
  const { codigo, tripId, tripDate, tripTime, idUsuario } = req.body;
  const pool = await getConnection();

  if (!codigo) {
    const mensaje = 'Código QR requerido';
    await registrarFallo(pool, 0, idUsuario, mensaje);
    return res.status(400).json({ message: mensaje });
  }

  console.log('➡️ Código QR recibido:', codigo);

  try {
    const partes = codigo.split(',');

    if (partes.length !== 5) {
      const mensaje = `Formato incorrecto: se esperaban 5 valores (tripId,idVenta,fecha,hora,asiento) pero se recibieron ${partes.length}`;
      await registrarFallo(pool, 0, idUsuario, mensaje);
      return res.status(400).json({ message: mensaje, recibido: partes });
    }

    const [qrTripId, qrIdVenta, qrFecha, qrHora, qrAsiento] = partes;

    // Validación específica por campo
    const errores = [];

    if (qrTripId !== String(tripId)) {
      errores.push(`tripId inválido: se esperaba '${tripId}' pero se recibió '${qrTripId}'`);
    }

    if (qrFecha !== tripDate) {
      errores.push(`fecha inválida: se esperaba '${tripDate}' pero se recibió '${qrFecha}'`);
    }

    const horaQR = normalizarHora(qrHora);
    const horaEsperada = normalizarHora(tripTime);

    if (horaQR !== horaEsperada) {
      errores.push(`hora inválida: se esperaba '${horaEsperada}' pero se recibió '${horaQR}'`);
    }

    if (errores.length > 0) {
      const mensaje = 'Datos del código QR no coinciden con los esperados';
      const detalle = errores.join('; ');
      await registrarFallo(pool, qrIdVenta, idUsuario, `${mensaje}: ${detalle}`);
      return res.status(400).json({
        message: mensaje,
        detalles: errores,
        recibido: { tripId: qrTripId, tripDate: qrFecha, tripTime: horaQR }
      });
    }

    console.log('✅ Código QR válido y coincide con los parámetros');

    const exito = await registrarCodigoQR(pool, qrIdVenta, idUsuario);

    if (exito) {
      return res.status(200).json({
        message: 'Código QR recibido y validado correctamente',
        asiento: qrAsiento
      });
    } else {
      const mensaje = 'No se pudo registrar el código QR (venta inválida o duplicada)';
      return res.status(500).json({ message: mensaje });
    }

  } catch (error) {
    const mensaje = 'Excepción: ' + error.message;
    console.error('🔥 Excepción al registrar código QR:', mensaje);
    await registrarFallo(pool, 0, idUsuario, mensaje);
    return res.status(500).json({ message: 'Error al procesar código QR', error: error.message });
  }
};



async function registrarFallo(pool, idVenta, idUsuario, mensaje) {
  try {
    const ventaFinal = idVenta ?? 'SIN_ID';
    const usuarioFinal = idUsuario ?? 'SIN_USUARIO';
    await registrarError(pool, ventaFinal, usuarioFinal, mensaje);
  } catch (err) {
    console.error('❌ Error al intentar registrar un fallo desde el controlador:', err.message);
  }
}


export async function listUsers(req, res) {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export const registrarGastoController = async (req, res) => {
  try {
    console.log("📥 [INICIO] Petición recibida");

    const { idTipoGasto, monto, idProgramacion } = req.body;
    const file = req.files?.comprobante;

    console.log("📦 Datos recibidos:", { idTipoGasto, monto, idProgramacion });

    if (!idTipoGasto || !monto || !idProgramacion) {
      console.log("❌ Faltan datos obligatorios");
      return res.status(400).json({ message: 'Faltan datos obligatorios.' });
    }

    // Validación básica de tipo de dato
    if (isNaN(idTipoGasto)) {
      return res.status(400).json({ message: 'El tipo de gasto debe ser un número válido.' });
    }

    let comprobanteRuta = null;

    if (file) {
      console.log("📎 Archivo recibido:", file.name);

      const mimeAllowed = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!mimeAllowed.includes(file.mimetype)) {
        console.log("❌ Formato de archivo no permitido:", file.mimetype);
        return res.status(400).json({ message: 'Formato de archivo no permitido.' });
      }

      const uploadDir = path.resolve('src', 'uploads', 'comprobantes');
      if (!fs.existsSync(uploadDir)) {
        console.log("📁 Carpeta no existe, creando...");
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const nombreArchivo = `comprobante_${Date.now()}_${file.name}`;
      const rutaFisica = path.join(uploadDir, nombreArchivo);

      try {
        console.log("💾 Guardando archivo en:", rutaFisica);
        await file.mv(rutaFisica);
        comprobanteRuta = `/uploads/comprobantes/${nombreArchivo}`;
        console.log("✅ Archivo guardado con éxito");
      } catch (err) {
        console.error("🔥 Error al guardar el archivo:", err.message);
        return res.status(500).json({ message: 'Error al guardar el archivo.' });
      }
    } else {
      console.log("📭 No se recibió archivo");
    }

    console.log("📝 Registrando en base de datos...");
    const resultado = await registrarGasto(idProgramacion, idTipoGasto, monto, comprobanteRuta);

    console.log("✅ Registro exitoso:", resultado);
    res.status(200).json({
      message: 'Gasto registrado exitosamente.',
      resultado,
    });

  } catch (error) {
    console.error("🔥 [ERROR GENERAL]:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al registrar el gasto.' });
    }
  }
};
export const obtenerTiposGastosController = async (req, res) => {
  try {
    console.log("📥 [INICIO] Consulta de tipos de gastos");

    const tipos = await obtenerTiposGastos();

    console.log("✅ Tipos de gasto obtenidos:", tipos.length);
    res.status(200).json({
      message: 'Tipos de gasto obtenidos correctamente.',
      data: tipos,
    });

  } catch (error) {
    console.error("🔥 [ERROR GENERAL]:", error.message);
    res.status(500).json({ message: 'Error al obtener tipos de gasto.' });
  }
};
export const obtenerCausasDevolucionController = async (req, res) => {
  try {
    console.log("📥 [INICIO] Consulta de causas de devolución");

    const causas = await obtenerCausasDevolucion();

    console.log("✅ Causas de devolución obtenidas:", causas.length);
    res.status(200).json({
      message: 'Causas de devolución obtenidas correctamente.',
      data: causas,
    });

  } catch (error) {
    console.error("🔥 [ERROR GENERAL]:", error.message);
    res.status(500).json({ message: 'Error al obtener causas de devolución.' });
  }
};
export async function anularViajeHandler(req, res) {
  const { idProgramacion } = req.body;

  if (!idProgramacion) {
    return res.status(400).json({
      message: 'El campo idProgramacion es obligatorio.'
    });
  }

  try {
    const resultado = await anularViajeSimulado(idProgramacion);

    return res.status(200).json({
      message: resultado.message
    });

  } catch (error) {
    const msg = error.message || 'Error interno al anular el viaje.';

    if (
      msg.includes('no se encontró') ||
      msg.includes('ya está anulado')
    ) {
      return res.status(409).json({ message: msg });
    }

    console.error('[ERROR] al anular viaje:', msg);
    return res.status(500).json({ message: 'Error interno al anular el viaje.' });
  }
  
}
export async function asignarViajeAConductorHandler(req, res) {
  const { idProgramacion, idConductor } = req.body;

  const camposFaltantes = [];
  if (!idProgramacion) camposFaltantes.push('idProgramacion');
  if (!idConductor) camposFaltantes.push('idConductor');

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      message: `Faltan los siguientes campos obligatorios: ${camposFaltantes.join(', ')}.`
    });
  }

  try {
    const resultado = await asignarViajeAConductor({ idProgramacion, idConductor });

    return res.status(200).json({
      message: resultado.message,
      idsVenta: resultado.idsVenta || [], // ahora sí se retorna al front
    });
  } catch (error) {
    const msg = error.message || 'Error interno al asignar el viaje.';

    if (msg.includes('No se encontró el viaje')) {
      return res.status(404).json({ message: msg });
    }

    console.error('[ERROR] al asignar viaje:', msg);
    return res.status(500).json({ message: 'Error interno al asignar el viaje.' });
  }
}
