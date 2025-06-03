// src/routes/userRoutes.js
import { Router } from 'express';
import { 
        listUsers,
        registrarCodigoQRController,
        obtenerViajes,getAsientos,
        registrarGastoController,
        obtenerTiposGastosController,
        obtenerViajesConFiltros,
        obtenerConductoresActivos,
        getRutasPorConductorHandler,
        registrarDevolucionHandler,
        obtenerCausasDevolucionController,
        anularViajeHandler,
        asignarViajeAConductorHandler,
        obtenerResumenMensual,
        obtenerGastosPorConductorController,
        marcarEstadoViaje
 } from '../controllers/userController.js';
import { verificarToken } from '../middleware/authMiddleware.js'; // <-- Importa middleware
import {loginUserJWT, refreshTokenController, validarTokenHandler} from '../controllers/authController.js';


const router = Router();

router.get('/usuarios', listUsers);
router.post('/registro-qr', registrarCodigoQRController); // NUEVA RUTA
router.post('/login-jwt', loginUserJWT);  // <--- NUEVA RUTA
router.get('/viajes', verificarToken, obtenerViajes);
router.get('/viajesFiltrados', obtenerViajesConFiltros);
router.post('/refresh-token', refreshTokenController);
router.get('/asientos', getAsientos);
router.get('/conductores', obtenerConductoresActivos);
router.get('/rutasConductores', getRutasPorConductorHandler);
router.post('/gastos', registrarGastoController);
router.post('/registroDevolucion', registrarDevolucionHandler);
router.get('/tipos-gasto', obtenerTiposGastosController);
router.get('/causasDevolucion', obtenerCausasDevolucionController);
router.post('/anularViaje', anularViajeHandler); 
router.post('/asignarViajeConductor', asignarViajeAConductorHandler);
router.get('/obtenerResumen', obtenerResumenMensual);
router.get('/obtenerGastosConductor', obtenerGastosPorConductorController);
router.post('/marcarEstadoViaje', marcarEstadoViaje); 
router.get('/validar-token', verificarToken, validarTokenHandler); // <-- Nueva ruta para validar token

 // <-- Cambia la ruta a la que necesites
// <-- Cambia la ruta a la que necesites





export default router;
