import pool from './config/db.js';

async function createAdminSettings() {
    try {
        console.log("Criando tabela admin_settings...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.admin_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(255) UNIQUE NOT NULL,
                setting_value VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            INSERT INTO public.admin_settings (setting_key, setting_value)
            VALUES ('maintenance_mode', 'false')
            ON CONFLICT (setting_key) DO NOTHING;
        `);
        console.log("✅ Tabela admin_settings criada e populada com sucesso!");
        process.exit(0);
    } catch(e) {
        console.error("❌ Erro:", e);
        process.exit(1);
    }
}
createAdminSettings();
