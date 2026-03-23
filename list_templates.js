import pool from './api/config/db.js';

async function listTemplates() {
  try {
    const result = await pool.query("SELECT name, body FROM email_templates");
    result.rows.forEach(row => {
      console.log(`==== TEMPLATE: ${row.name} ====`);
      console.log(row.body);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listTemplates();
