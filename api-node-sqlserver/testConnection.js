import mssql from 'mssql';
import * as dotenv from 'dotenv';

dotenv.config();
const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT), // Aseguramos que sea número
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true', // Convierte string a booleano
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
    }
  };

async function testConnection() {
  try {
    console.log('⌛ Intentando conectar...');
    const pool = await mssql.connect(config);
    console.log('✅ Conexión exitosa a la base de datos');
    await pool.close();
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
  } finally {
    mssql.close(); // Cierra cualquier conexión pendiente
  }
}

testConnection();