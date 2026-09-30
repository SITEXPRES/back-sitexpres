import pool from './config/db.js';

async function addRegistroBrColumns() {
  try {
    console.log("Verificando e adicionando colunas necessárias para Registro.br...");

    // Adiciona colunas em domain_orders
    await pool.query(`
      ALTER TABLE public.domain_orders
      ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(50),
      ADD COLUMN IF NOT EXISTS data_nascimento VARCHAR(50),
      ADD COLUMN IF NOT EXISTS customer_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS customer_complement VARCHAR(100),
      ADD COLUMN IF NOT EXISTS customer_bairro VARCHAR(100),
      ADD COLUMN IF NOT EXISTS registro_retorno TEXT,
      ADD COLUMN IF NOT EXISTS registro_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS ticket_registro VARCHAR(50);
    `).catch(e => console.log("Nota domain_orders:", e.message));

    // Adiciona colunas em users
    await pool.query(`
      ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS data_nascimento VARCHAR(50),
      ADD COLUMN IF NOT EXISTS numero VARCHAR(50),
      ADD COLUMN IF NOT EXISTS complemento VARCHAR(100);
    `).catch(e => console.log("Nota users:", e.message));

    console.log("✅ Colunas para Registro.br verificadas/adicionadas com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao adicionar colunas:", error.message);
    process.exit(1);
  }
}

addRegistroBrColumns();
