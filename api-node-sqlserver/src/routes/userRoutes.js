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
        registrarDevolucionHandler
 } from '../controllers/userController.js';
import { verificarToken } from '../middleware/authMiddleware.js'; // <-- Importa middleware
import {loginUserJWT, refreshTokenController} from '../controllers/authController.js';


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




export default router;
