import 'dotenv/config';
import pool from './config/db.js';

async function listTemplates() {
  try {
    const result = await pool.query("SELECT name, body FROM email_templates WHERE name = 'welcome'");
    const fs = await import('fs');
    result.rows.forEach(row => {
      fs.writeFileSync('template_welcome.html', row.body);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listTemplates();
