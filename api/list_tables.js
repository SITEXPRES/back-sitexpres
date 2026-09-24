import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.POSTGRES_PORT) || 5432,
});

(async () => {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log("Tabelas existentes no banco de dados:");
    res.rows.forEach(row => console.log("- " + row.table_name));
  } catch(e) {
    console.error("Erro ao listar tabelas:", e);
  } finally {
    process.exit();
  }
})();
