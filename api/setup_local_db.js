import pool from './config/db.js';
import bcrypt from 'bcrypt';

async function run() {
    try {
        console.log("Criando tabelas...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sites (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                name VARCHAR(255),
                domain VARCHAR(255),
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS generated_sites (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                name VARCHAR(255),
                prompt TEXT,
                html_content TEXT,
                css_content TEXT,
                js_content TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS site_prompts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                id_projeto INTEGER,
                id_site_gererate INTEGER,
                prompt TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS user_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                plan VARCHAR(100),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                amount DECIMAL(10,2),
                status VARCHAR(50),
                payment_method VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS domain_orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                domain VARCHAR(255),
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS hospedagens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                domain VARCHAR(255),
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS emails (
                id SERIAL PRIMARY KEY,
                id_user INTEGER REFERENCES users(id),
                "user" VARCHAR(255),
                email VARCHAR(255),
                password VARCHAR(255),
                domain VARCHAR(255),
                quota INTEGER,
                send_limit INTEGER,
                userhospedagem VARCHAR(255),
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS affiliates (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                pix_key VARCHAR(255),
                pix_beneficiary VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS affiliate_links (
                id SERIAL PRIMARY KEY,
                affiliate_id INTEGER REFERENCES affiliates(id),
                code VARCHAR(255) UNIQUE,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS affiliate_referrals (
                id SERIAL PRIMARY KEY,
                affiliate_id INTEGER REFERENCES affiliates(id),
                referred_user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS affiliate_commissions (
                id SERIAL PRIMARY KEY,
                affiliate_id INTEGER REFERENCES affiliates(id),
                referred_user_id INTEGER REFERENCES users(id),
                order_id INTEGER,
                amount DECIMAL(10,2),
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
                id SERIAL PRIMARY KEY,
                affiliate_id INTEGER REFERENCES affiliates(id),
                amount DECIMAL(10,2),
                pix_key VARCHAR(255),
                pix_beneficiary VARCHAR(255),
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS github_connections (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                github_username VARCHAR(255),
                access_token TEXT,
                token_type VARCHAR(50),
                scope TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                token VARCHAR(255),
                expires_at TIMESTAMP,
                used BOOLEAN DEFAULT false
            );

            CREATE TABLE IF NOT EXISTS deleted_accounts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                name VARCHAR(255),
                email VARCHAR(255),
                ip_address VARCHAR(255),
                deleted_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS site_analytics (
                id SERIAL PRIMARY KEY,
                id_projeto INTEGER,
                visits INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Tabelas criadas com sucesso!");

        // Inserir Admin
        const hash = await bcrypt.hash('@#sitex2025#new', 10);
        await pool.query(`
            INSERT INTO users (name, email, password_hash, role)
            VALUES ('Admin Local', 'admin@sitexpress.com.br', $1, 'admin')
            ON CONFLICT (email) DO NOTHING
        `, [hash]);

        console.log("✅ Usuário Admin inserido: admin@sitexpress.com.br / @#sitex2025#new");

        process.exit(0);
    } catch(e) {
        console.error("❌ Erro:", e);
        process.exit(1);
    }
}
run();
