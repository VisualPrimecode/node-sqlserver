// src/routes/userRoutes.js
import { Router } from 'express';
import { listUsers, loginUser, loginUserJWT,registrarCodigoQRController } from '../controllers/userController.js';


const router = Router();

router.post('/login', loginUser);       // <-- NUEVA RUTA
router.get('/usuarios', listUsers);
router.post('/registro-qr', registrarCodigoQRController); // NUEVA RUTA
router.post('/login-jwt', loginUserJWT);  // <--- NUEVA RUTA



export default router;
