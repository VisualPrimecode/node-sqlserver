// src/app.js
import express from 'express';
import userRoutes from './routes/userRoutes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());

// Rutas
app.use('/api', userRoutes);

export default app;
