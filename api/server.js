import express from "express";
import cors from "cors";
import 'dotenv/config';
import pool from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import siteRoutes from "./routes/siteRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import paypalRoutes from "./routes/paypalRoutes.js";
import interRoutes from "./routes/InterRoutes.js";
import githubIntegrationRoutes from "./routes/githubIntegrationRoutes.js";
import notafiscalRoutes from "./routes/notaRoutes.js";
import transactionsRoutes from "./routes/transactionsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import hospedagemRoutes from "./routes/hospedagemRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import ressellerRoutes from "./routes/ressellerRoutes.js";

import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.set('trust proxy', true);

// Middlewares globais
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:8080', 'https://seusitefrontend.com', 'https://app.sitexpres.com.br', 'https://back.sitexpres.com.br', 'https://site-ai-launchpad.lovable.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.urlencoded({ extended: true }));

// Teste de conexão
app.get("/dbtest", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "Conectado ao banco!", hora: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Endpoint de teste geral solicitado pelo usuário
app.get("/teste.js", async (req, res) => {
  try {
    const response = { banco: {}, claude: {} };

    // Testar banco e pegar quantidades
    try {
      const usersQuery = await pool.query("SELECT COUNT(*) FROM users");
      const sitesQuery = await pool.query("SELECT COUNT(*) FROM generated_sites");
      
      response.banco = {
        status: "✅ Conectado com sucesso",
        qtd_users: parseInt(usersQuery.rows[0].count),
        qtd_sites: parseInt(sitesQuery.rows[0].count)
      };
    } catch (err) {
      response.banco = { status: "❌ Erro ao conectar no banco", detalhe: err.message };
    }

    // Testar Claude
    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
      // Só cria uma mensagem simples para validar a chave
      const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 10,
        messages: [{ role: "user", content: "Diga 'ok'" }]
      });
      response.claude = { status: "✅ Conectado com sucesso", resposta: msg.content[0].text };
    } catch (err) {
      response.claude = { status: "❌ Erro ao conectar no Claude", detalhe: err.message };
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ erro_critico: err.message });
  }
});

// Rotas principais
app.use("/api/reset-password", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/user", userRoutes);
app.use("/api/integrations/github", githubIntegrationRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/pix-inter", interRoutes);
app.use("/api/notafiscal", notafiscalRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hospedagem", hospedagemRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/resseller", ressellerRoutes);




const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Servir arquivos estáticos da pasta uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rota padrão
app.get("/", (req, res) => {
  res.send("awaiting command");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    system: {
      uptimeSeconds: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage()
    },
    integrations: {
      cloudx: {
        configured: !!process.env.user_directamin && !!process.env.pass_directamin
      }
    }
  });
});

app.get('/teste-lento', async (req, res) => {
  console.log("🔹 Requisição recebida em /teste-lento");

  // Espera 120 segundos (2 minutos)
  await new Promise(resolve => setTimeout(resolve, 150000));

  res.json({
    success: true,
    message: "✅ Endpoint lento respondeu depois de 120 segundos!"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
