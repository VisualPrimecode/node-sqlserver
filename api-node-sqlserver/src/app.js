// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.js';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// Servir la carpeta de comprobantes de manera estática
const comprobantesDir = path.resolve('src', 'uploads', 'comprobantes');

if (!fs.existsSync(comprobantesDir)) {
  fs.mkdirSync(comprobantesDir, { recursive: true });
}
app.use('/uploads/comprobantes', express.static(path.resolve('src', 'uploads', 'comprobantes')));

// Rutas
app.use('/api', userRoutes);

export default app;
