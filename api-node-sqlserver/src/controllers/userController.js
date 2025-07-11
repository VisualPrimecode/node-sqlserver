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
        asignarViajeAConductor,
        getResumenMensualPorConductor,
        getGastosPorConductor,
        actualizarEstadoViaje,
        obtenerDatosQRPorIdVenta,
        getDetalleProduccion,
        getDetalleEntregaDinero,
        getDetalleGastos


      } from '../models/userModel.js';
import { getConnection } from '../config/database.js';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

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
function convertirA24Horas(hora12) {
  const match = hora12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return undefined;

  let [_, horas, minutos, ampm] = match;
  horas = parseInt(horas);
  minutos = parseInt(minutos);

  if (ampm.toUpperCase() === 'PM' && horas !== 12) {
    horas += 12;
  } else if (ampm.toUpperCase() === 'AM' && horas === 12) {
    horas = 0;
  }

  return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
}


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
  hora: hora ? convertirA24Horas(hora) : undefined,
  idDestino: idDestino ? parseInt(idDestino) : undefined,
  estado: estado !== undefined ? parseInt(estado) : undefined,
};

    console.log("🚩 [DEBUG] Filtros normalizados:", filtros);
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

  if (!codigo || codigo.trim() === '') {
    const mensaje = 'Código QR requerido';
    await registrarFallo(pool, null, idUsuario, mensaje);
    return res.status(400).json({ message: mensaje });
  }

  console.log('➡️ Código QR recibido:', codigo);

  try {
    if (/^https?:\/\//i.test(codigo.trim())) {
      const mensaje = 'Código QR no válido: contiene una URL no esperada';
      await registrarFallo(pool, null, idUsuario, mensaje);
      return res.status(400).json({ message: mensaje, detalles: [mensaje] });
    }

    const partes = codigo.split(',');

    if (partes.length !== 5) {
      const mensaje = `Formato incorrecto: se esperaban 5 valores (tripId,idVenta,fecha,hora,asiento) pero se recibieron ${partes.length}`;
      await registrarFallo(pool, null, idUsuario, mensaje);
      return res.status(400).json({ message: mensaje, recibido: partes });
    }

    const [qrTripId, qrIdVenta, qrFecha, qrHora, qrAsiento] = partes;

    const formatoValido =
      /^\d+$/.test(qrTripId) &&
      /^\d+$/.test(qrIdVenta) &&
      /^\d+$/.test(qrAsiento) &&
      /^\d{4}-\d{2}-\d{2}$/.test(qrFecha) &&
      /^\d{2}:\d{2}/.test(qrHora);

    if (!formatoValido) {
      const mensaje = 'El código QR escaneado tiene un formato inválido o datos corruptos';
      await registrarFallo(pool, qrIdVenta, idUsuario, mensaje);
      return res.status(400).json({
        message: mensaje,
        recibido: partes
      });
    }

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

    await registrarCodigoQR(pool, qrIdVenta, idUsuario, qrAsiento);

    return res.status(200).json({
      message: 'Código QR recibido y validado correctamente',
      asiento: qrAsiento
    });

  } catch (error) {
    const mensaje = error.message;
    const esErrorDatos = mensaje.includes('no existe') || mensaje.includes('anulada') || mensaje.includes('duplicado');
    const status = esErrorDatos ? 400 : 500;

    console.error('🔥 Excepción al registrar código QR:', mensaje);

    // ⛔️ Solo registrar si el error no fue marcado como ya manejado
    if (!error._handled) {
      await registrarFallo(pool, null, idUsuario, mensaje);
    }

    return res.status(status).json({
      message: 'Error en el registro del código QR',
      detalles: [mensaje]
    });
  }
};

async function registrarFallo(pool, idVenta, idUsuario, mensaje) {
  try {
    const ventaFinal = idVenta && String(idVenta).trim() !== '' ? idVenta : null;
    const usuarioFinal = idUsuario && String(idUsuario).trim() !== '' ? idUsuario : null;
    await registrarError(pool, ventaFinal, usuarioFinal, mensaje);
  } catch (err) {
    console.error('❌ Error al intentar registrar un fallo desde el controlador:', err.message);
  }
}


export async function listUsers(req, res) {
  try {
    console.log("🚩 [DEBUG] Entrando a listUsers");
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export const registrarGastoController = async (req, res) => {
  try {
    console.log("📥 [INICIO] Petición recibida");

    const { idTipoGasto, monto, idProgramacion, comentarios  } = req.body;
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
    const resultado = await registrarGasto(idProgramacion, idTipoGasto, monto, comprobanteRuta, comentarios);

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
// controllers/viajesController.js
export const obtenerResumenMensual = async (req, res) => {
  const idConductor = req.query.idConductor || 162;
  const fechaInicio = req.query.fechaInicio || '01-05-2025';
  const fechaFin = req.query.fechaFin || '31-05-2025';

  try {
    console.log("🚩 [DEBUG] Entrando a obtenerResumenMensual");
    console.log("🚩 [DEBUG] Parámetros recibidos:", { idConductor, fechaInicio, fechaFin });
    const resumen = await getResumenMensualPorConductor(idConductor, fechaInicio, fechaFin);
    res.status(200).json(resumen);
  } catch (error) {
    console.error('❌ Error en obtenerResumenMensual:', error.message);
    res.status(500).json({ message: 'Error al obtener el resumen mensual', error: error.message });
  }
};
//antiguo obtenerTiposGastosController
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

export const getDetalleProduccionHandler = async (req, res) => {
  console.log("🚩 [DEBUG] Entrando a getDetalleProduccionHandler");

  const { idConductor, fecha } = req.query;

  if (!idConductor || !fecha) {
    return res.status(400).json({ message: 'Faltan parámetros: idConductor y fecha son obligatorios' });
  }

  try {
    const data = await getDetalleProduccion(parseInt(idConductor), fecha);
    res.status(200).json(data);
  } catch (error) {
    console.error('[ERROR] al obtener detalle de producción:', error.message);
    res.status(500).json({ message: 'Error interno al obtener detalle de producción' });
  }
};

export const getDetalleEntregaDineroHandler = async (req, res) => {
  console.log("🚩 [DEBUG] Entrando a getDetalleEntregaDineroHandler");

  const { idConductor, fecha } = req.query;

  if (!idConductor || !fecha) {
    return res.status(400).json({ message: 'Faltan parámetros: idConductor y fecha son obligatorios' });
  }

  try {
    const data = await getDetalleEntregaDinero(parseInt(idConductor), fecha);
    res.status(200).json(data);
  } catch (error) {
    console.error('[ERROR] al obtener detalle de entrega de dinero:', error.message);
    res.status(500).json({ message: 'Error interno al obtener detalle de entrega de dinero' });
  }
};


export const getDetalleGastosHandler = async (req, res) => {

  const { idConductor, fecha } = req.query;
  console.log("🚩 [DEBUG] Parámetros recibidos:", { idConductor, fecha });
  if (!idConductor || !fecha) {
    return res.status(400).json({ message: 'Faltan parámetros: idConductor y fecha son obligatorios' });
  }

  try {
    const data = await getDetalleGastos(parseInt(idConductor), fecha);
    res.status(200).json(data);
  } catch (error) {
    console.error('[ERROR] al obtener detalle de gastos:', error.message);
    res.status(500).json({ message: 'Error interno al obtener detalle de gastos' });
  }
};


export const obtenerGastosPorConductorController = async (req, res) => {
  const { idConductor, fechaInicio, fechaFin } = req.query;

  if (!idConductor || !fechaInicio || !fechaFin) {
    return res.status(400).json({ message: 'Faltan parámetros obligatorios: idConductor, fechaInicio, fechaFin.' });
  }

  try {
    console.log("🚩 [DEBUG] Entrando a obtenerGastosPorConductor");
    console.log("🚩 [DEBUG] Parámetros recibidos:", { idConductor, fechaInicio, fechaFin });

    const gastos = await getGastosPorConductor(idConductor, fechaInicio, fechaFin);
    res.status(200).json(gastos);
  } catch (error) {
    console.error('❌ Error en obtenerGastosPorConductor:', error.message);
    res.status(500).json({ message: 'Error al obtener los gastos del conductor', error: error.message });
  }
}
export const marcarEstadoViaje = async (req, res) => {
  try {
    console.log("🚩 [DEBUG] Entrando a marcarEstadoViaje");
    console.log("🚩 [DEBUG] Body recibido:", req.body);

    const { idProgramacion, accion } = req.body;

    // Validaciones básicas
    if (!idProgramacion || !accion) {
      return res.status(400).json({ message: 'Se requieren los campos idProgramacion y accion.' });
    }

    if (!['iniciar', 'finalizar'].includes(accion)) {
      return res.status(400).json({ message: 'La acción debe ser "iniciar" o "finalizar".' });
    }

    const result = await actualizarEstadoViaje({ idProgramacion: parseInt(idProgramacion), accion });

    res.status(200).json({
      message: result.message,
      success: true,
    });

  } catch (error) {
    console.error('❌ Error en marcarEstadoViaje:', error.message);
    res.status(500).json({ message: 'Error al actualizar estado del viaje', error: error.message });
  }
};
export const obtenerDatosQRController = async (req, res) => {
  const { idVenta } = req.params; // o req.query / req.body según tu preferencia
  console.log("🚩 [DEBUG] Entrando a obtenerDatosQRController");
  if (!idVenta) {
    return res.status(400).json({ message: 'Se requiere el parámetro idVenta' });
  }

  try {
    const datosQR = await obtenerDatosQRPorIdVenta(parseInt(idVenta));

    return res.status(200).json({
      message: 'Datos para QR obtenidos correctamente',
      datos: datosQR
    });
  } catch (error) {
    console.error('❌ Error en obtenerDatosQRController:', error.message);
    return res.status(500).json({
      message: 'Error al obtener datos para el QR',
      error: error.message
    });
  }
};
export const generarQRDesdeVenta = async (req, res) => {
  const { idVenta } = req.params;

  if (!idVenta) {
    return res.status(400).json({ message: 'Se requiere el parámetro idVenta' });
  }

  try {
    const datos = await obtenerDatosQRPorIdVenta(parseInt(idVenta));

    if (!datos) {
      return res.status(404).json({ message: 'No se encontraron datos para ese idVenta' });
    }

    const contenidoQR = `${datos.idProgramacion},${datos.idVenta},${datos.fecha},${datos.hora},${datos.asiento}`;

    // Generar imagen QR en base64
    const qrDataURL = await QRCode.toDataURL(contenidoQR);

    return res.status(200).json({
      message: 'QR generado correctamente',
      contenido: contenidoQR,
      qrBase64: qrDataURL
    });
  } catch (error) {
    console.error('❌ Error al generar QR:', error.message);
    return res.status(500).json({
      message: 'Error al generar QR',
      error: error.message
    });
  }
};