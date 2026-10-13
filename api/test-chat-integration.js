import dotenv from "dotenv";
import pool from "./config/db.js";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
});

async function testarPerguntaChatPromax() {
  console.log("\n========================================================");
  console.log("🧪 TESTANDO ASSISTENTE DO CHAT COM MEMÓRIA TÉCNICA PROMAX");
  console.log("========================================================\n");

  // Metadados simulados de um projeto Promax criado
  const projectMetadata = {
    is_promax: true,
    projectName: "crm_advocacia_teste",
    url_dominio: "https://crm-advocacia.sitexpres.com.br",
    url_direta: "http://143.208.9.235:13005",
    port: 13005,
    containers: {
      app: "sitexpress-crm_advocacia-app",
      db: "sitexpress-crm_advocacia-db"
    },
    database: {
      host: "143.208.9.235",
      porta_externa: 12025,
      name: "crm_advocacia_db",
      user: "admin_advocacia",
      password: "SenhaSuperSegura2026",
      internal_url: "postgres://admin_advocacia:SenhaSuperSegura2026@sitexpress-crm_advocacia-db:5432/crm_advocacia_db"
    },
    tecnologia: "Node.js 18 + Express + PostgreSQL 15 + Tailwind CSS"
  };

  const perguntasDoUsuario = [
    "Quais são as credenciais do meu banco de dados?",
    "Como foi feita a API e como ela se conecta no banco?"
  ];

  for (const pergunta of perguntasDoUsuario) {
    console.log(`💬 Usuário no Chat pergunta: "${pergunta}"`);

    const promaxInfoContext = `
[FICHA TÉCNICA DO SISTEMA PROMAX DO CLIENTE]
- Subdomínio Oficial: ${projectMetadata.url_dominio}
- Acesso Direto VPS: ${projectMetadata.url_direta}
- Banco de Dados PostgreSQL 15:
  - Host: ${projectMetadata.database.host}
  - Porta Externa: ${projectMetadata.database.porta_externa}
  - Nome do Banco: ${projectMetadata.database.name}
  - Usuário: ${projectMetadata.database.user}
  - Senha: ${projectMetadata.database.password}
  - Conexão Interna Docker: ${projectMetadata.database.internal_url}
- Containers Docker:
  - Aplicação: ${projectMetadata.containers.app}
  - Banco de Dados: ${projectMetadata.containers.db}
- Stack Tecnológica: ${projectMetadata.tecnologia}
`;

    const intentResp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 450,
      system: `Você é o assistente técnico virtual da Sitexpres. Avalie se o usuário quer modificar o sistema/site ou se está apenas fazendo uma pergunta ou pedindo informações (ex: quais as credenciais do banco?, qual a senha?, como conectar?, como foi feita a api?, qual a porta?).${promaxInfoContext}
Se for PERGUNTA ou DÚVIDA INFORMATIVA, responda EXATAMENTE com [PERGUNTA] seguido de uma resposta amigável, clara e prestativa contendo os dados solicitados (sempre comece com um emoji e use formatação markdown). Se o usuário perguntar sobre o banco de dados, senhas, portas, rotas ou detalhes da API, utilize os dados da FICHA TÉCNICA.
Se for MODIFICAÇÃO, responda EXATAMENTE com [MODIFICACAO].`,
      messages: [
        { role: "user", content: pergunta }
      ]
    });

    const respostaTexto = intentResp.content[0].text.trim();
    console.log("🤖 Resposta do Assistente:\n");
    console.log(respostaTexto.replace("[PERGUNTA]", "").trim());
    console.log("\n--------------------------------------------------------\n");
  }

  process.exit(0);
}

testarPerguntaChatPromax().catch(err => {
  console.error("Erro no teste:", err);
  process.exit(1);
});
