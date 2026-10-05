import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'adminsitexpress',
  host: '143.208.9.218',
  database: 'db_sitexpress',
  password: '@#sitex2025#new',
  port: 5432,
});

async function run() {
  try {
    console.log("Simulando query do ADM para Lista de Sites:");
    const query = `
      SELECT 
        gs.*,
        us.plan as user_plan
      FROM generated_sites gs
      LEFT JOIN user_subscriptions us ON us.user_id = gs.user_id
      ORDER BY gs.created_at DESC
    `;
    const res = await pool.query(query);
    console.log("Total retornado pela query do ADM:", res.rows.length);
    // Agrupar por id_projeto para ver o que tem
    const projects = {};
    res.rows.forEach(r => {
      projects[r.id_projeto] = (projects[r.id_projeto] || 0) + 1;
    });
    console.log("Sites agrupados por id_projeto:");
    console.table(Object.entries(projects).map(([k, v]) => ({ id_projeto: k, count: v })));
    
  } catch (e) {
    console.error("Erro:", e.message);
  } finally {
    pool.end();
  }
}

run();
