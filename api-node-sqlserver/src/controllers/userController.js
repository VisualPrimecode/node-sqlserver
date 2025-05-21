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
        registrarDevolucion
      } from '../models/userModel.js';
import { getConnection } from '../config/database.js';
import path from 'path';
import fs from 'fs';

export async function registrarDevolucionHandler(req, res) {
  const {
    idVenta, // ya no se usa directamente para buscar
    numeroBoleto,
    fechaDevolucion,
    monto,
    fechaTransferencia,
    idUsuario,
    comentario,
    idCausaDevolucion,

    // Nuevos campos necesarios para encontrar la venta correcta
    numeroAsiento,
    fechaViaje,
    idDestino,
    horaSalida
  } = req.body;

  // ✅ Validación básica de campos obligatorios
  const camposFaltantes = [];

if (!numeroBoleto) camposFaltantes.push('numeroBoleto');
if (!fechaDevolucion) camposFaltantes.push('fechaDevolucion');
if (!monto) camposFaltantes.push('monto');
if (!idUsuario) camposFaltantes.push('idUsuario');
if (!numeroAsiento) camposFaltantes.push('numeroAsiento');
if (!fechaViaje) camposFaltantes.push('fechaViaje');
if (!idDestino) camposFaltantes.push('idDestino');
if (!horaSalida) camposFaltantes.push('horaSalida');

if (camposFaltantes.length > 0) {
  return res.status(400).json({
    message: `Faltan los siguientes campos obligatorios: ${camposFaltantes.join(', ')}.`
  });
}

  try {
    await registrarDevolucion({
      numeroBoleto,
      fechaDevolucion,
      monto,
      fechaTransferencia,
      idUsuario,
      comentario,
      idCausaDevolucion,
      numeroAsiento,
      fechaViaje,
      idDestino,
      horaSalida
    });

    return res.status(201).json({ message: 'Devolución registrada correctamente.' });

  } catch (error) {
    const msg = error.message || 'Error interno al registrar la devolución.';

    // Errores conocidos del proceso de negocio
    if (
      msg.includes('no se encontró') ||
      msg.includes('ya está anulado')
    ) {
      return res.status(409).json({ message: msg }); // Conflicto lógico
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

  const pool = await getConnection(); // ✅ conexión única

  if (!codigo) {
    const mensaje = 'Código QR requerido';
    await registrarFallo(pool, 'SIN_ID', idUsuario, mensaje);
    return res.status(400).json({ message: mensaje });
  }

  console.log('➡️ Código QR recibido:', codigo);

  try {
    const partes = codigo.split(',');

    if (partes.length < 5) {
      const mensaje = 'Formato de código QR inválido';
      await registrarFallo(pool, 'SIN_ID', idUsuario, mensaje);
      return res.status(400).json({ message: mensaje, recibido: partes });
    }

    const [qrTripId, qrIdVenta, qrFecha, qrHora, qrAsiento] = partes;

    const horaNormalizadaQR = normalizarHora(qrHora);
    const horaNormalizadaBody = normalizarHora(tripTime);

    const esValido =
      qrTripId === String(tripId) &&
      qrFecha === tripDate &&
      horaNormalizadaQR === horaNormalizadaBody;

    if (!esValido) {
      const mensaje = 'Datos del código QR no coinciden con los esperados';
      await registrarFallo(pool, qrIdVenta, idUsuario, mensaje);

      return res.status(400).json({
        message: mensaje,
        esperado: { tripId, tripDate, tripTime: horaNormalizadaBody },
        recibido: { tripId: qrTripId, tripDate: qrFecha, tripTime: horaNormalizadaQR }
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
      return res.status(500).json({ message: mensaje });
    }

  } catch (error) {
    console.error('🔥 Excepción al registrar código QR:', error.message);
    await registrarFallo(pool, 'SIN_ID', idUsuario, 'Excepción: ' + error.message);
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
