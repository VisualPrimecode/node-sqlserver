import mssql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

let connectionPool;

export async function getConnection() {
  if (connectionPool) {
    return connectionPool;
  }

  try {
    connectionPool = await mssql.connect(dbConfig);
    console.log('✅ Conectado a la base de datos');
    return connectionPool;
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    throw error;
  }
}
