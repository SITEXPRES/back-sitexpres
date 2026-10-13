import { executarFluxoPromax } from "./services/promaxOrchestratorService.js";

// Mock de aplicação Fullstack com conexão real ao Postgres e frontend integrado
const mockAppCompleta = {
  name_app: "crm_imoveis",
  tecnologia: "node",
  descricao: "CRM de Imóveis completo com Banco Postgres e Dashboard Tailwind",
  files: [
    {
      path: "package.json",
      content: JSON.stringify({
        name: "crm-imoveis-promax",
        version: "1.0.0",
        main: "index.js",
        dependencies: {
          express: "^4.19.2",
          pg: "^8.11.5",
          dotenv: "^16.4.5"
        }
      }, null, 2)
    },
    {
      path: "index.js",
      content: `
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Pool de conexão com o PostgreSQL na rede interna
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Auto-inicialização de tabelas e dados de seed
async function initDb() {
  for (let i = 0; i < 5; i++) {
    try {
      console.log('Tentando conectar ao Postgres...');
      await pool.query(\`
        CREATE TABLE IF NOT EXISTS clientes (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(100),
          email VARCHAR(100),
          valor NUMERIC(10,2),
          status VARCHAR(50)
        );
      \`);
      
      const countRes = await pool.query('SELECT COUNT(*) FROM clientes');
      if (parseInt(countRes.rows[0].count) === 0) {
        await pool.query(\`
          INSERT INTO clientes (nome, email, valor, status) VALUES 
          ('Carlos Eduardo', 'carlos@exemplo.com', 450000.00, 'Interessado'),
          ('Mariana Souza', 'mariana@exemplo.com', 820000.00, 'Proposta Enviada'),
          ('Roberto Dias', 'roberto@exemplo.com', 320000.00, 'Fechado');
        \`);
        console.log('Dados de seed inseridos com sucesso!');
      }
      console.log('Banco de dados inicializado com sucesso!');
      return;
    } catch (err) {
      console.log('Aguardando banco inicializar... erro:', err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

initDb();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.get('/api/clientes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 CRM Promax online na porta \${PORT}\`);
});
      `
    },
    {
      path: "public/index.html",
      content: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRM Promax - Imóveis</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans">
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <header class="flex justify-between items-center border-b border-slate-800 pb-4">
      <div>
        <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">SiteXpress Promax CRM</h1>
        <p class="text-xs text-slate-400">Aplicação Fullstack com PostgreSQL na VPS</p>
      </div>
      <div class="flex items-center space-x-2">
        <span class="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
        <span class="text-xs font-semibold text-emerald-400">Online & Conectado</span>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div class="text-slate-400 text-xs">Total em Negociações</div>
        <div class="text-2xl font-bold text-white mt-1">R$ 1.590.000</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div class="text-slate-400 text-xs">Clientes Ativos</div>
        <div class="text-2xl font-bold text-blue-400 mt-1">3 Leads</div>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div class="text-slate-400 text-xs">Banco de Dados</div>
        <div class="text-2xl font-bold text-emerald-400 mt-1">PostgreSQL 15</div>
      </div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6 space-y-4">
      <h2 class="text-lg font-bold text-white">Leads Carregados do Banco</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase bg-slate-800/50 text-slate-400">
            <tr>
              <th class="p-3">ID</th>
              <th class="p-3">Nome</th>
              <th class="p-3">Email</th>
              <th class="p-3">Valor</th>
              <th class="p-3">Status</th>
            </tr>
          </thead>
          <tbody id="tabela-clientes" class="divide-y divide-slate-800">
            <tr><td colspan="5" class="p-4 text-center text-slate-500">Carregando do PostgreSQL...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    async function carregarClientes() {
      try {
        const res = await fetch('/api/clientes');
        const dados = await res.json();
        const tbody = document.getElementById('tabela-clientes');
        tbody.innerHTML = dados.map(c => \`
          <tr class="hover:bg-slate-800/30">
            <td class="p-3 text-slate-500">#\${c.id}</td>
            <td class="p-3 font-semibold text-white">\${c.nome}</td>
            <td class="p-3 text-slate-400">\${c.email}</td>
            <td class="p-3 text-emerald-400 font-medium">R$ \${Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td class="p-3"><span class="px-2.5 py-1 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">\${c.status}</span></td>
          </tr>
        \`).join('');
      } catch (e) {
        console.error(e);
      }
    }
    carregarClientes();
  </script>
</body>
</html>
      `
    }
  ]
};

async function testarMaestro() {
  try {
    const randomId = Math.floor(Math.random() * 900 + 100);
    const resultado = await executarFluxoPromax({
      prompt: "Gere um CRM de Imóveis para mim com gestão de clientes e pipeline",
      id_projeto: `teste_${randomId}`,
      userId: 1,
      mockCode: mockAppCompleta
    });

    console.log("\n========================================================");
    console.log("🎯 RESULTADO DO TESTE DO MAESTRO:");
    console.log(resultado);
    console.log("========================================================\n");
  } catch (err) {
    console.error("❌ ERRO NO TESTE DO MAESTRO:", err);
  }
}

testarMaestro();
