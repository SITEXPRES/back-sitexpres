import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.POSTGRES_PORT) || 5432,

  // 🔑 ESSENCIAIS PARA NÃO TRAVAR
  max: 10,                     // máximo de conexões
  idleTimeoutMillis: 30000,    // fecha conexão ociosa
  connectionTimeoutMillis: 5000, // timeout ao conectar

  ssl: false, // ajuste se usar RDS / externo
});

// 🔥 Captura erros silenciosos do pool
pool.on("error", (err) => {
  console.error("🔥 PostgreSQL Pool Error:", err);
});

export default pool;
