import * as cheerio from 'cheerio';
import pool from "../config/db.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import axios from "axios";
import https from "https";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
import ftp from "basic-ftp";
import { criarSubdominioDirectAdmin, enviarHTMLSubdominio, subdominioExiste, deletarSubdominioDirectAdmin, enviarDiretorioSubdominio } from "./integracao_directadmin.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);
dotenv.config();
import { updateGitHubIfIntegrated } from "./updateGitHubOnSiteChange.js";
import { uso_creditos, verificar_creditos_prompt } from "./creditosController.js";
import { consultaPlano } from "./planoController.js";
import { gerar_site } from "./gerar_siteController_vite.js";
import { desatrelarHtmlSitexpress, coletarArquivosProjeto } from "../utils/siteAssetHelper.js";
import { isFinancialError, CODIGO_ERRO_FINANCEIRO, MENSAGEM_CLIENTE_FINANCEIRO, MENSAGEM_CLIENTE_FALHA_EDICAO } from "../utils/errorHandler.js";

import { executarFluxoPromax } from "../services/promaxOrchestratorService.js";
import {
  detectarAmeacaSeguranca,
  sanitizarRespostaSeguranca,
  REGRAS_SEGURANCA_SYSTEM_PROMPT,
  MENSAGEM_RECUSA_SEGURANCA
} from "../utils/securityGuardrails.js";

export function detectarIntencaoPromax(prompt, metadata = null, tipoProjeto = null, planoUsuario = null) {
  // 1. Se foi explicitamente solicitado como Site / Landing Page pelo frontend (e não for auto) -> NUNCA Promax!
  if (tipoProjeto === 'site' || tipoProjeto === 'site_page') return false;

  // 2. Se o plano do usuário for exclusivo de Sites/Pages ou Free -> NUNCA Promax!
  if (['site_page', 'starter', 'site', 'free'].includes(planoUsuario)) return false;

  // 3. Se for um projeto existente que já é um site normal (DirectAdmin) -> NUNCA migrar para Promax em prompts de edição!
  if (metadata && metadata.is_promax === false) return false;
  if (metadata && !metadata.is_promax && (metadata.subdominio || metadata.projectName)) return false;

  // 4. Se foi explicitamente solicitado como Sistema / CRM pelo frontend -> SEMPRE Promax!
  if (tipoProjeto === 'sistema' || tipoProjeto === 'crm' || tipoProjeto === 'crm_sistema') return true;

  // 5. Se já for um projeto Promax existente -> continua no Promax
  if (metadata && metadata.is_promax) return true;

  const p = (prompt || '').toLowerCase();

  // 1. Termos técnicos explícitos (caso o usuário ou desenvolvedor seja técnico)
  const termosTecnicos = [
    'crm', 'banco de dados', 'postgres', 'postgresql', 'saas', 'fullstack',
    'backend', 'api rest', 'tabela sql', 'docker container', 'crud',
    'banco relacional', 'bd relacional', 'node express', 'painel com banco', 'sistema com banco'
  ];
  if (termosTecnicos.some(t => p.includes(t))) return true;

  // 2. Substantivos indicando sistema / software corporativo
  const ehSistema = /\b(sistema|software|painel|plataforma|aplicativo|app)\b/i.test(p);

  // 3. Módulos de negócio e operações de gestão com persistência (linguagem 100% natural de usuário leigo)
  const termosNegocioGestao = [
    // Cadastros
    'cadastro de cliente', 'cadastrar cliente', 'cadastro de imoveis', 'cadastro de imóveis',
    'cadastrar imoveis', 'cadastrar imóveis', 'cadastro de corretor', 'cadastrar corretor',
    'cadastro de produto', 'cadastrar produto', 'cadastro de paciente', 'cadastrar paciente',
    'cadastro de usuario', 'cadastro de usuário', 'cadastrar usuario', 'cadastrar usuário',
    'cadastro de pedido', 'cadastrar pedido', 'cadastro de aluno', 'cadastrar aluno',
    'cadastro de medico', 'cadastro de médico', 'cadastro de fornecedor', 'cadastrar fornecedor',
    // Gestão de Vendas, Estoque e Finanças
    'controle de estoque', 'gestao de estoque', 'gestão de estoque', 'controlar estoque',
    'controle de venda', 'gestao de venda', 'gestão de venda', 'controlar venda', 'metricas de venda', 'métricas de venda',
    'controle financeiro', 'gestao financeira', 'gestão financeira', 'fluxo de caixa', 'contas a pagar', 'contas a receber',
    'painel administrativo', 'painel de controle', 'painel de gestao', 'painel de gestão',
    'dashboard administrativo', 'dashboard de venda', 'dashboard de vendas', 'dashboard de métricas',
    // Operações e Serviços
    'agendamento de consulta', 'agendar consulta', 'ordem de servico', 'ordem de serviço',
    'ordens de servico', 'ordens de serviço', 'controle de chamado', 'controle de chamados',
    'gestao de pedido', 'gestão de pedido', 'gerenciar pedido', 'gerenciamento de pedido',
    'gerenciar cliente', 'gerenciamento de cliente', 'controle de cliente',
    'funil de venda', 'funil de vendas', 'funil de lead', 'gestao de lead', 'gestão de lead'
  ];

  if (termosNegocioGestao.some(t => p.includes(t))) return true;

  // 4. Se o usuário pediu explicitamente um sistema/painel/software para um nicho comercial/operacional
  // Ex: "Crie um sistema para minha imobiliária", "Faça um software para minha oficina", "Painel de vendas da loja"
  if (ehSistema) {
    const nichosNegocio = /\b(imobili[aá]ria|vendas|loja|com[eé]rcio|oficina|cl[ií]nica|consult[oó]rio|escola|curso|academia|restaurante|pizzaria|hotel|pousada|estoque|pedidos|financeiro|or[cç]amentos|clientes|funcion[aá]rios|mensalidades)\b/i;

    // Se não for explicitamente "apenas um site institucional / vitrine"
    const apenasSiteVitrine = /\b(apenas|somente|só)\s+(um\s+)?(site|landing\s*page|p[aá]gina|institucional|vitrine)\b/i.test(p);

    if (nichosNegocio.test(p) && !apenasSiteVitrine) {
      return true;
    }
  }

  return false;
}
// ⚠️ REMOVIDO: import { console, url } from "inspector" — esse import sobrescrevia o console global e suprimia os logs no terminal!

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || "dummy_claude",
});
const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "dummy_deepseek",
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_gemini");
const USE_GEMINI = false;

//
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 64000;

// Função para gerar cada parte do site
// Função para limpar blocos de markdown ou tags extras
function limparRetorno(codigo) {
  // Remove ```html, ```css, ```js e ```
  codigo = codigo.replace(/```(?:html|css|js)?\n?/gi, "");
  codigo = codigo.replace(/```/g, "");
  return codigo.trim();
}

function extrairReactCode(conteudo) {
  if (!conteudo) return "";
  const match = conteudo.match(/<!-- SITEXPRES_REACT_START -->([\s\S]*?)<!-- SITEXPRES_REACT_END -->/);
  if (match) return match[1].trim();
  return conteudo;
}

async function countTokensManual(systemPrompt) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        system: "Você é um especialista em HTML, CSS e SEO. Sempre gere apenas código HTML puro.",
        messages: [
          { role: "user", content: systemPrompt }
        ]
      })
    });

    return await response.json();
  } catch (err) {
    console.error("Erro ao contar tokens manualmente:", err);
    return null;
  }
}

// Função principal combinada
// Jobs temporários em memória
export const jobs = {}; // { jobId: { status, result, error } }

// Helper para log com timestamp
function logStep(jobId, msg, data = null) {
  const ts = new Date().toISOString();
  if (data !== null && data !== undefined) {
    console.log(`[${ts}] [JOB:${jobId ?? 'init'}] ${msg}`, data);
  } else {
    console.log(`[${ts}] [JOB:${jobId ?? 'init'}] ${msg}`);
  }
}

// Helper: Extrair URLs do prompt e fazer fetch
async function extractUrlsAndFetchContent(prompt, logStep, jobId) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = prompt.match(urlRegex);

  if (!urls || urls.length === 0) return prompt;

  let enrichedPrompt = prompt + '\n\n--- CONTEXTO ADICIONAL LIDO DAS URLs FORNECIDAS ---\n';

  for (const url of urls) {
    if (logStep) logStep(jobId, `🌐 Lendo conteúdo da URL: ${url}`);
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const html = response.data;
      const $ = cheerio.load(html);

      // Remover scripts, styles, etc.
      $('script, style, noscript, iframe, img, svg, video, audio').remove();

      let textContent = $('body').text();
      // Limpar espaços vazios
      textContent = textContent.replace(/\s+/g, ' ').trim();

      // Limitar a quantidade de texto para não estourar os tokens
      if (textContent.length > 20000) {
        textContent = textContent.substring(0, 20000) + '... [Conteúdo Truncado]';
      }

      enrichedPrompt += `\nConteúdo do site ${url}:\n${textContent}\n`;
      if (logStep) logStep(jobId, `✅ URL lida com sucesso (${textContent.length} caracteres extraídos).`);
    } catch (e) {
      console.error("Erro ao ler URL:", e.message);
      if (logStep) logStep(jobId, `⚠️ Não foi possível ler a URL ${url}: ${e.message}`);
      enrichedPrompt += `\nConteúdo do site ${url}: [Não foi possível ler: ${e.message}]\n`;
    }
  }
  return enrichedPrompt;
}

export const newsite = async (req, res) => {
  try {
    const { prompt, id_projeto, userId, tipo_projeto } = req.body;

    logStep(null, `📥 Nova requisição newsite | userId=${userId} | id_projeto=${id_projeto} | tipo_projeto=${tipo_projeto || 'auto'}`);

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: "Prompt não enviado" });
    }

    //================   Validação de créditos ===================
    logStep(null, '🔍 Buscando dados do site para validação de créditos...');
    const t0 = Date.now();

    const dadosSite = await pool.query(
      `SELECT id, name, html_content, js_content FROM generated_sites 
           WHERE id_projeto = $1 and status = 'ativo'
           ORDER BY created_at DESC LIMIT 1`,
      [id_projeto]
    );
    const baseHTML = dadosSite.rows.length > 0 ? (dadosSite.rows[0].js_content || extrairReactCode(dadosSite.rows[0].html_content)) : "";
    logStep(null, `✅ Dados do site carregados (${Date.now() - t0}ms) | site existente: ${dadosSite.rows.length > 0}`);

    logStep(null, '🔍 Verificando créditos do usuário...');
    const t1 = Date.now();
    const verificar_creditos_prompt_result = await verificar_creditos_prompt(userId, prompt, baseHTML);
    const temArquivos = req.files && req.files.length > 0;
    if (temArquivos) {
      if (verificar_creditos_prompt_result.tokensDisponiveis < 100000) verificar_creditos_prompt_result.podeRodar = false;
    } else {
      if (verificar_creditos_prompt_result.tokensDisponiveis < 60000) verificar_creditos_prompt_result.podeRodar = false;
    }
    logStep(null, `✅ Créditos verificados (${Date.now() - t1}ms) | podeRodar: ${verificar_creditos_prompt_result.podeRodar}`);

    if (!verificar_creditos_prompt_result.podeRodar) {
      logStep(null, '❌ Créditos insuficientes — requisição rejeitada');
      return res.status(400).json({ success: false, message: "Créditos insuficientes, faça a compra avusa ou compre o pacote com mais créditos" });
    } else {

      // Verifica plano do cliente
      logStep(null, '🔍 Consultando plano do usuário...');
      const t2 = Date.now();
      const plano = await consultaPlano(userId);
      const isPro = plano.isPro;
      const typedo_plano = plano.plan;
      logStep(null, `✅ Plano consultado (${Date.now() - t2}ms) | plano: ${typedo_plano}`);

      // Validação de tipo de plano vs tipo de projeto (Planos 29,90 / Free NÃO podem criar Sistemas ou CRMs)
      const isPlanoApenasSites = ['site_page', 'starter', 'site', 'free'].includes(typedo_plano);

      if (isPlanoApenasSites) {
        // Bloqueio 1: Se escolheu explicitamente sistema / crm na tela
        if (tipo_projeto === 'sistema' || tipo_projeto === 'crm' || tipo_projeto === 'crm_sistema') {
          return res.status(403).json({
            success: false,
            message: "Seu plano atual (R$ 29,90) é exclusivo para Sites e Landing Pages. Para gerar Sistemas e CRMs com banco de dados PostgreSQL, faça upgrade para o plano Pro / CRM."
          });
        }

        // Bloqueio 2: Se deixou em 'auto' mas o prompt pede claramente um CRM / Sistema com banco de dados
        const querCRM = detectarIntencaoPromax(prompt, null, 'auto', 'premium');
        if (querCRM) {
          return res.status(403).json({
            success: false,
            message: "Identificamos que você solicitou um Sistema/CRM com banco de dados. Seu plano atual (R$ 29,90) é exclusivo para Sites e Landing Pages. Faça upgrade para o plano Pro / CRM para criar Sistemas com PostgreSQL!"
          });
        }
      }

      // Imagens/Logos enviados pelo usuário (suporte a múltiplos)
      const uploadedFiles = req.files && req.files.length > 0 ? req.files : [];
      // Usa o primeiro arquivo como imagem principal para o prompt (compatibilidade)
      const relativeImageURL = uploadedFiles.length > 0 ? `./images/${uploadedFiles[0].filename}` : null;
      const imageURL = relativeImageURL;

      // Cria job assincrono para monitorar o progresso
      const jobId = uuidv4();
      jobs[jobId] = { status: "processing", progress: 0, result: null, error: null };
      logStep(jobId, `🚀 Job criado e iniciado`);
      res.json({ success: true, jobId });


      // Inicia job assincrono para gerar o site
      (async () => {
        let client;
        const jobStartTime = Date.now();

        // Variáveis que precisam sobreviver entre as fases
        let primeiraVez, baseHTML, nomeSubdominio, finalPrompt, existing;

        try {
          // ─── FASE 1: consultas rápidas ao BD ────────────────────────────────
          logStep(jobId, '🔗 Conectando ao banco de dados...');
          client = await pool.connect();
          logStep(jobId, `✅ Conexão com BD estabelecida (${Date.now() - jobStartTime}ms)`);

          logStep(jobId, '🔍 Verificando se site já existe...');
          const t3 = Date.now();
          existing = await client.query(
            `SELECT id, name, html_content, js_content FROM generated_sites 
           WHERE id_projeto = $1 and status = 'ativo'
           ORDER BY created_at DESC LIMIT 1`,
            [id_projeto]
          );
          logStep(jobId, `✅ Consulta BD concluída (${Date.now() - t3}ms) | site existente: ${existing.rows.length > 0}`);

          let projectMetadata = null;
          try {
            const siteMetaRes = await client.query(
              `SELECT metadata, site_url FROM public.sites WHERE id_projeto = $1 ORDER BY id DESC LIMIT 1`,
              [id_projeto]
            );
            if (siteMetaRes.rows.length > 0 && siteMetaRes.rows[0].metadata) {
              projectMetadata = typeof siteMetaRes.rows[0].metadata === 'string'
                ? JSON.parse(siteMetaRes.rows[0].metadata)
                : siteMetaRes.rows[0].metadata;
              logStep(jobId, `ℹ️  Metadata do projeto carregado (Promax: ${!!projectMetadata?.is_promax})`);
            }
          } catch (mErr) {
            console.warn("Aviso ao carregar metadata:", mErr.message);
          }

          const qtde_sites = await client.query(
            `SELECT * FROM public.sites where user_id = $1`,
            [userId]
          );

          //=============================
          // Validação dos limites free
          //=============================
          if (typedo_plano === 'free') {
            if (existing.rows.length === 0 && qtde_sites.rows.length >= 1) {
              logStep(jobId, '❌ Limite de sites free atingido — job encerrado');
              jobs[jobId] = { status: "error", result: null, error: "Limite de sites atingido" };
              client.release();
              return;
            }
          }

          primeiraVez = existing.rows.length === 0;
          baseHTML = primeiraVez ? "" : (existing.rows[0].js_content || extrairReactCode(existing.rows[0].html_content));
          if (!primeiraVez) {
            nomeSubdominio = existing.rows[0].name.replace("Site de ", "").toLowerCase();
          }
          logStep(jobId, `ℹ️  Modo: ${primeiraVez ? 'CRIAÇÃO (primeira vez)' : 'EDIÇÃO (site existente)'}`);

          logStep(jobId, '🔎 Verificando se há URLs no prompt original...');
          const promptWithUrls = await extractUrlsAndFetchContent(prompt, logStep, jobId);

          const fullPrompt = uploadedFiles.length > 0
            ? `${promptWithUrls}\n[INSTRUÇÃO DE IMAGENS/LOGOS: O usuário enviou ${uploadedFiles.length} imagem(ns). Utilize os caminhos absolutos abaixo nas tags <img> correspondentes (ex: "/images/${uploadedFiles[0].filename}"). O nome original do arquivo indica o propósito de cada imagem (ex: "logo.png" → use como logo, "footer.jpg" → use no footer, "banner.jpg" → use como banner):\n${uploadedFiles.map((f, i) => `- Arquivo "${f.originalname}" → caminho: "/images/${f.filename}" (ex: <img src="/images/${f.filename}" alt="${f.originalname.replace(/\.[^.]+$/, '')}">)`).join('\n')}\nNUNCA utilize caminhos relativos (./images/) pois quebram em subpáginas nem links externos!]`
            : promptWithUrls;

          let historyText = "";
          let chatHistory = [];
          if (!primeiraVez) {
            try {
              const pastPrompts = await client.query(
                `SELECT prompt, assistant_message FROM site_prompts
                 WHERE id_projeto = $1
                 ORDER BY created_at ASC LIMIT 10`,
                [id_projeto]
              );
              if (pastPrompts.rows.length > 0) {
                historyText = "\n\n[HISTÓRICO DA CONVERSA]:\n" + pastPrompts.rows.map(p => `Usuário: ${p.prompt}\nAssistente: ${p.assistant_message || ""}`).join("\n\n") + "\n\n";

                pastPrompts.rows.forEach(p => {
                  chatHistory.push({ role: "user", content: p.prompt });
                  if (p.assistant_message) {
                    chatHistory.push({ role: "assistant", content: p.assistant_message });
                  }
                });
              }
            } catch (err) {
              console.error("Erro ao buscar histórico:", err);
            }
          }

          let isQuestionOnly = false;
          let questionAnswer = "";

          // 🛡️ GUARDA DE SEGURANÇA: Interceptação imediata de tentativas de obter credenciais de hospedagem/servidor
          const checagemSeguranca = detectarAmeacaSeguranca(prompt);
          if (checagemSeguranca.ameaca) {
            logStep(jobId, '🛡️ [SEGURANÇA] Tentativa de acesso a dados confidenciais bloqueada!');
            isQuestionOnly = true;
            questionAnswer = checagemSeguranca.resposta || MENSAGEM_RECUSA_SEGURANCA;
          } else if (uploadedFiles.length > 0) {
            // 📎 Se o usuário enviou imagens/arquivos, trata-se OBRIGATORIAMENTE de uma MODIFICAÇÃO no site ou CRM
            logStep(jobId, `📁 Anexos recebidos (${uploadedFiles.length} arquivo(s)) — intenção definida automaticamente como MODIFICAÇÃO (sem recusa por falta de arquivo).`);
            isQuestionOnly = false;
          } else if (!primeiraVez) {
            logStep(jobId, '🤖 Classificando intenção (modificação vs pergunta)...');
            try {
              let promaxInfoContext = "";
              if (projectMetadata && projectMetadata.is_promax) {
                promaxInfoContext = `
\n[FICHA TÉCNICA DO SISTEMA PROMAX DO CLIENTE]
- Subdomínio Oficial: ${projectMetadata.url_dominio || projectMetadata.subdominio || 'Não configurado'}
- Acesso Direto VPS: ${projectMetadata.url_direta || 'http://143.208.9.235:' + projectMetadata.port}
- Porta da Aplicação: ${projectMetadata.port || '3000'}
- Banco de Dados PostgreSQL 15:
  - Host Externo: ${projectMetadata.database?.host || '143.208.9.235'}
  - Porta Externa: ${projectMetadata.database?.porta_externa || projectMetadata.database?.port_externa || '12010'}
  - Nome do Banco: ${projectMetadata.database?.name || (projectMetadata.projectName ? projectMetadata.projectName + '_db' : 'crm_app_db')}
  - Usuário: ${projectMetadata.database?.user || 'admin'}
  - Senha: ${projectMetadata.database?.password || 'definida no deploy'}
  - Conexão Interna Docker: ${projectMetadata.database?.internal_url || 'postgres://...'}
- Containers Docker:
  - Container Aplicação: ${projectMetadata.containers?.app || projectMetadata.container_app}
  - Container Banco de Dados: ${projectMetadata.containers?.db || projectMetadata.container_db}
- Stack Tecnológica: ${projectMetadata.tecnologia || 'Node.js 18 + Express + PostgreSQL 15 + Tailwind CSS'}
- Arquivos do Projeto: ${Array.isArray(projectMetadata.files) ? projectMetadata.files.join(', ') : 'package.json, index.js, public/index.html'}
- Resumo do Sistema: ${projectMetadata.descricao || 'Aplicação Fullstack com Express e PostgreSQL'}
- Arquitetura da API: Backend Express em index.js conectado via pool pg ao container Postgres na rede interna sitexpress-net, servindo frontend estático e rotas REST /api/
`;
              }

              const systemIntentPrompt = `Você é o assistente técnico virtual da Sitexpres. Avalie a mensagem do usuário dentro do contexto da conversa:

1. Se for PERGUNTA, DÚVIDA INFORMATIVA ou RESPOSTA CONVERSACIONAL / CONFIRMAÇÃO (ex: "Sim", "Não", "Ok", "Beleza", "Entendido", "Pode ser", "Combinado", "Vou mandar", "Obrigado", "Bom dia", ou qualquer resposta concordando/conversando sem conter instruções concretas de código):
   - Responda EXATAMENTE com [PERGUNTA] seguido de uma resposta amigável, natural e prestativa no contexto do chat (sempre comece com um emoji).
   - Exemplo: se você acabou de pedir para o usuário enviar uma imagem/arquivo e ele apenas disse "Sim", "Ok" ou "Beleza" sem enviar instruções de alteração, responda: "🎨 Ótimo! Pode anexar a imagem clicando no ícone de anexo 📎 aqui no chat. Assim que você enviar, aplico a alteração diretamente no seu site!"
   - NUNCA responda [MODIFICACAO] se o usuário apenas disse "Sim", "Ok" ou agradeceu sem descrever uma nova alteração de código!
   - Se o usuário perguntar sobre banco de dados, portas, rotas ou dados técnicos, utilize os dados da FICHA TÉCNICA.${promaxInfoContext}
${REGRAS_SEGURANCA_SYSTEM_PROMPT}

2. Se for uma MODIFICAÇÃO REAL no site/sistema (ex: "mude a cor", "adicione botão", "troque o texto X por Y", "remova o rodapé", "insira a foto", "coloque a imagem abaixo da localização"):
   - Responda EXATAMENTE com [MODIFICACAO].`;

              const isUsingDeepSeek = (process.env.AI_PROVIDER || (process.env.USE_DEEPSEEK === 'true' ? 'deepseek' : 'claude')).toLowerCase() === 'deepseek';
              let intentText = "";

              if (isUsingDeepSeek) {
                const deepIntentResp = await deepseek.chat.completions.create({
                  model: "deepseek-chat",
                  max_tokens: 650,
                  messages: [
                    { role: "system", content: systemIntentPrompt },
                    ...chatHistory.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
                    {
                      role: "user",
                      content: `[CÓDIGO ATUAL DO SITE PARA REFERÊNCIA]\n\`\`\`html\n${baseHTML ? baseHTML.substring(0, 30000) : "Nenhum código ainda"}\n\`\`\`\n\nO usuário diz: ${prompt}`
                    }
                  ]
                });
                intentText = deepIntentResp.choices[0]?.message?.content?.trim() || "";
              } else {
                const intentResp = await anthropic.messages.create({
                  model: "claude-haiku-4-5-20251001",
                  max_tokens: 650,
                  system: systemIntentPrompt,
                  messages: [
                    ...chatHistory,
                    {
                      role: "user",
                      content: `[CÓDIGO ATUAL DO SITE PARA REFERÊNCIA]\n\`\`\`html\n${baseHTML ? baseHTML.substring(0, 30000) : "Nenhum código ainda"}\n\`\`\`\n\nO usuário diz: ${prompt}`
                    }
                  ]
                });
                intentText = intentResp.content[0].text.trim();
              }
              if (intentText.startsWith("[PERGUNTA]")) {
                isQuestionOnly = true;
                questionAnswer = sanitizarRespostaSeguranca(intentText.replace("[PERGUNTA]", "").trim());
                logStep(jobId, '✅ Intenção: PERGUNTA. Resposta técnica gerada com sucesso.');
              } else {
                logStep(jobId, '✅ Intenção: MODIFICAÇÃO.');
              }
            } catch (err) {
              console.error("Erro na classificação de intenção:", err);
            }
          }


          finalPrompt = primeiraVez
            ? fullPrompt
            : `[Contexto do Pedido]\nHistórico:\n${historyText}\n\nFaça as alterações solicitadas: ${fullPrompt}`;

          // ─── LIBERA O CLIENT antes da IA (operação longa!) ──────────────────
          client.release();
          client = null;

          if (isQuestionOnly) {
            logStep(jobId, '🔗 Reconectando ao BD para salvar apenas a mensagem (sem gerar código)...');
            client = await pool.connect();
            const novoId = existing?.rows?.[0]?.id || null;
            const sanitizedAnswer = sanitizarRespostaSeguranca(questionAnswer);
            if (novoId) {
              try {
                await client.query(
                  `INSERT INTO site_prompts (user_id, id_projeto, prompt, id_site_gererate, status, assistant_message)
                    VALUES ($1, $2, $3, $4, $5, $6)`,
                  [userId, id_projeto, prompt, novoId, 'ativo', sanitizedAnswer]
                );
              } catch (e) {
                console.error("Erro ao inserir site_prompts para pergunta:", e);
              }
            }
            client.release();
            client = null;

            jobs[jobId].progress = 100;
            jobs[jobId] = {
              status: "done",
              result: {
                html_content: existing?.rows?.[0]?.html_content || "<div></div>",
                assistant_message: sanitizedAnswer,
                is_promax: !!projectMetadata?.is_promax,
                metadata: projectMetadata,
                url_dominio: projectMetadata?.url_dominio,
                url_direta: projectMetadata?.url_direta
              },
              error: null
            };
            logStep(jobId, `🎉 Job concluído (Apenas Resposta)`);
            return;
          }

          logStep(jobId, '🔓 Conexão com BD liberada — iniciando chamada à IA...');

          // ─── FASE 2: chamada à IA (sem conexão BD aberta) ───────────────────
          let html, distPath, tmpDirPath, hasError, geracaoResult;
          let promaxMetadataToSave = null;
          let promaxRawFilesToSave = null;
          let assistantMessageOverride = null;
          const isTestMode = finalPrompt.includes("[teste]");

          if (isTestMode) {
            logStep(jobId, '🤖 [MODO TESTE] Pulando IA (Claude)... gerando mock');
            html = desatrelarHtmlSitexpress("<html><head><title>Site Teste</title><style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0; } h1 { color: #333; }</style></head><body><h1>Site Gerado com Sucesso (Modo Teste)</h1></body></html>");
            distPath = null;
            tmpDirPath = null;
            hasError = false;
            jobs[jobId].progress = 100;
          } else if (detectarIntencaoPromax(prompt, projectMetadata, tipo_projeto, typedo_plano)) {
            logStep(jobId, '🚀 [PROMAX] Intenção identificada: Sistema Fullstack com PostgreSQL. Acionando Maestro...');
            jobs[jobId].progress = 25;

            // 🔄 Carrega arquivos e código anterior caso seja uma edição de sistema existente
            let existingFiles = null;
            if (projectMetadata?.raw_files && Array.isArray(projectMetadata.raw_files) && projectMetadata.raw_files.length > 0) {
              existingFiles = projectMetadata.raw_files;
              logStep(jobId, `📦 [PROMAX] Arquivos anteriores carregados do metadata (${existingFiles.length} arquivos)`);
            } else if (existing?.rows?.[0]?.js_content) {
              try {
                const parsed = JSON.parse(existing.rows[0].js_content);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].path) {
                  existingFiles = parsed;
                  logStep(jobId, `📦 [PROMAX] Arquivos anteriores carregados do histórico do BD (${existingFiles.length} arquivos)`);
                }
              } catch (e) {
                // Não era JSON (era HTML legado)
              }
            }

            const resultadoPromax = await executarFluxoPromax({
              prompt: finalPrompt,
              id_projeto,
              userId,
              existingMetadata: projectMetadata,
              existingFiles: existingFiles,
              uploadedFiles: uploadedFiles
            });

            jobs[jobId].progress = 85;
            const finalUrl = resultadoPromax.url_dominio || resultadoPromax.url_direta;

            html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #020617; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe src="${finalUrl}" title="CRM Sitexpres"></iframe>
</body>
</html>`;

            distPath = null;
            tmpDirPath = null;
            hasError = false;
            promaxRawFilesToSave = resultadoPromax.rawFiles || [];

            promaxMetadataToSave = {
              is_promax: true,
              projectName: resultadoPromax.projectName,
              url_dominio: resultadoPromax.url_dominio,
              url_direta: resultadoPromax.url_direta,
              port: resultadoPromax.port,
              containers: {
                app: resultadoPromax.container_app,
                db: resultadoPromax.container_db
              },
              database: resultadoPromax.db,
              tecnologia: resultadoPromax.tecnologia || 'Node.js 18 + Express + PostgreSQL 15 + Tailwind CSS',
              descricao: resultadoPromax.descricao || '',
              files: resultadoPromax.files || [],
              raw_files: resultadoPromax.rawFiles || [],
              created_at: new Date().toISOString()
            };

            if (!primeiraVez && projectMetadata?.is_promax) {
              const anexosMsg = uploadedFiles.length > 0 ? ` e a(s) imagem(ns) anexa(s) (${uploadedFiles.map(f => f.originalname).join(', ')})` : '';
              assistantMessageOverride = `⚡ **Sistema Atualizado com Sucesso!**

Suas alterações${anexosMsg} foram aplicadas diretamente no container da sua aplicação (porta ${resultadoPromax.port}), mantendo todos os dados do seu banco de dados PostgreSQL intactos.

🌐 **Acesse aqui:** [${finalUrl}](${finalUrl})
🐘 **Banco de Dados:** Conectado ao PostgreSQL (${resultadoPromax.db.name}) existente.`;
            } else {
              const anexosMsg = uploadedFiles.length > 0 ? ` com a(s) imagem(ns) anexa(s)` : '';
              assistantMessageOverride = `🎉 Uau! Seu sistema corporativo${anexosMsg} com banco de dados PostgreSQL foi gerado e colocado no ar com sucesso!

🌐 **Acesse aqui:** [${finalUrl}](${finalUrl})
🐘 **Banco de Dados:** PostgreSQL 15 configurado e conectado na VPS.

*Dica: Você pode me perguntar a qualquer momento quais são as credenciais do banco ou como conectar nele!*`;
            }

            jobs[jobId].progress = 95;
            logStep(jobId, `✅ [PROMAX] Maestro concluiu deploy em ${resultadoPromax.tempoTotalSegundos}s`);

            // 💰 Desconto de créditos proporcional aos tokens utilizados
            try {
              const tokensUsados = resultadoPromax.tokens_usados || 25000;
              logStep(jobId, `💰 Descontando créditos Promax: ${tokensUsados} tokens (${(tokensUsados / 10000).toFixed(2)} créditos) para userId=${userId}`);
              await uso_creditos(userId, tokensUsados, id_projeto);
            } catch (credErr) {
              console.error("[PROMAX] ⚠️ Erro ao descontar créditos:", credErr.message);
            }
          } else {
            const isUsingDeepSeekEdicao = !primeiraVez && ((process.env.AI_PROVIDER_EDICAO || 'deepseek').toLowerCase() === 'deepseek');
            const nomeModeloIa = primeiraVez
              ? 'Claude Sonnet 5.5'
              : (isUsingDeepSeekEdicao ? 'DeepSeek V3 (deepseek-chat)' : 'Claude Haiku');
            logStep(jobId, `🤖 Enviando prompt para a IA (${nomeModeloIa})... aguarde`);
            const tIA = Date.now();
            geracaoResult = await gerar_site(
              finalPrompt,
              "REACT",
              req,
              id_projeto,
              baseHTML,
              userId,
              primeiraVez,
              (percent) => {
                jobs[jobId].progress = percent;
              }
            );
            if (typeof geracaoResult === 'string') {
              // Modo HTML Puro
              html = desatrelarHtmlSitexpress(geracaoResult);
              distPath = null;
              tmpDirPath = null;
              hasError = false;
            } else {
              // Modo React Vite
              html = desatrelarHtmlSitexpress(geracaoResult.reactCode);
              distPath = geracaoResult.distPath;
              tmpDirPath = geracaoResult.tmpDirPath;
              hasError = geracaoResult.hasError;
            }
            logStep(jobId, `✅ Geração e build concluídos (${((Date.now() - tIA) / 1000).toFixed(1)}s)`);
          } // fecha if(!isTestMode)

          // Gera subdomínio (apenas na criação, sem BD ainda)
          if (!promaxMetadataToSave && primeiraVez) {
            logStep(jobId, '🔤 Gerando nome do subdomínio via IA...');
            const tSub = Date.now();
            nomeSubdominio = await gerarNomeSubdominio(prompt);
            logStep(jobId, `✅ Subdomínio gerado (${Date.now() - tSub}ms): ${nomeSubdominio}`);

            logStep(jobId, `🌐 Criando subdomínio no DirectAdmin: ${nomeSubdominio}.sitexpres.com.br`);
            const tDA = Date.now();
            try { await criarSubdominioDirectAdmin(nomeSubdominio, "sitexpres.com.br"); } catch (e) { console.error("Erro DA:", e.message); }
            logStep(jobId, `✅ Subdomínio criado no DirectAdmin (${Date.now() - tDA}ms)`);
          } else if (promaxMetadataToSave) {
            nomeSubdominio = promaxMetadataToSave.projectName;
          } else {
            logStep(jobId, `ℹ️  Subdomínio existente recuperado: ${nomeSubdominio}`);
          }


          // ─── FASE 3: nova conexão para salvar tudo no BD ────────────────────
          logStep(jobId, '🔗 Reconectando ao BD para salvar resultados...');
          client = await pool.connect();

          // 🛡️ GUARDA DE ROLLBACK & PROTEÇÃO AO CLIENTE:
          // Se a IA ou o build falharam durante a edição de um site já existente, NUNCA inativa a versão anterior
          // e NUNCA envia nada para o FTP/DirectAdmin. O site oficial do cliente no ar e o preview continuam 100% intactos!
          if (hasError && !primeiraVez) {
            logStep(jobId, `🛡️ [FAIL-SAFE ATIVADO] Falha na edição. Preservando 100% da versão funcional anterior do cliente!`);

            const isFin = (geracaoResult?.isFinancial || (typeof geracaoResult === 'object' && geracaoResult?.isFinancial));
            const assistantMessageFalha = isFin
              ? MENSAGEM_CLIENTE_FINANCEIRO
              : MENSAGEM_CLIENTE_FALHA_EDICAO;

            try {
              const activeSiteId = existing?.rows?.[0]?.id || null;
              await client.query(
                `INSERT INTO site_prompts (user_id, id_projeto, prompt, id_site_gererate, status, assistant_message)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [userId, id_projeto, prompt, activeSiteId, 'falha', assistantMessageFalha]
              );
            } catch (errP) {
              console.error("Erro ao salvar prompt de falha:", errP);
            }

            if (tmpDirPath) {
              await fs.rm(tmpDirPath, { recursive: true, force: true }).catch(() => {});
            }

            client.release();
            client = null;

            jobs[jobId].progress = 100;
            jobs[jobId] = {
              status: "done",
              result: {
                ...(existing?.rows?.[0] || {}),
                assistant_message: assistantMessageFalha
              },
              error: null
            };
            return;
          }

          logStep(jobId, '💾 Salvando HTML no banco de dados...');
          const tDB = Date.now();

          if (primeiraVez) {
            const siteUrl = promaxMetadataToSave?.url_dominio || `https://${nomeSubdominio}.sitexpres.com.br`;
            const metaToSave = promaxMetadataToSave || {
              id_projeto,
              subdominio: nomeSubdominio,
              is_promax: false,
              tipo_projeto: 'site',
              created_by: 'ai_generation'
            };
            await client.query(
              `INSERT INTO sites 
              (user_id, site_name, site_url, credits_used, status, metadata, id_projeto)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                userId,
                promaxMetadataToSave ? `Sistema ${promaxMetadataToSave.projectName}` : `Site de ${nomeSubdominio}`,
                siteUrl,
                10,
                'active',
                JSON.stringify(metaToSave),
                id_projeto
              ]
            );
            logStep(jobId, `✅ Site inserido na tabela 'sites'`);
          } else if (promaxMetadataToSave) {
            await client.query(
              `UPDATE sites SET metadata = $1, site_url = $2 WHERE id_projeto = $3`,
              [JSON.stringify(promaxMetadataToSave), promaxMetadataToSave.url_dominio || promaxMetadataToSave.url_direta, id_projeto]
            );
          }

          await client.query(
            `UPDATE generated_sites SET status = 'inativo' WHERE id_projeto = $1`,
            [id_projeto]
          );
          await client.query(
            `UPDATE site_prompts SET status = 'inativo' WHERE id_projeto = $1`,
            [id_projeto]
          );

          const previewUrlFinal = promaxMetadataToSave ? (promaxMetadataToSave.url_dominio || promaxMetadataToSave.url_direta) : `https://${nomeSubdominio}.sitexpres.com.br?v=${Date.now()}`;
          const previewHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    iframe { width: 100%; height: 100%; border: none; display: block; opacity: 0; transition: opacity 0.4s ease; }
    iframe.loaded { opacity: 1; }
    #loader { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #090d16; color: #f8fafc; z-index: 10; transition: opacity 0.4s ease, visibility 0.4s; }
    #loader.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
    .spinner-ring { width: 44px; height: 44px; border: 3px solid rgba(56, 189, 248, 0.15); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 14px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .title { font-size: 15px; font-weight: 600; color: #f1f5f9; margin-bottom: 5px; }
    .subtitle { font-size: 12px; color: #94a3b8; max-width: 320px; text-align: center; line-height: 1.4; }
    #react-source { display: none; }
  </style>
</head>
<body>
  <script type="sitexpres/react" id="react-source"><!-- SITEXPRES_REACT_START -->
${html}
<!-- SITEXPRES_REACT_END --></script>
  <div id="loader">
    <div class="spinner-ring"></div>
    <div class="title" id="loader-title">Carregando visualização...</div>
    <div class="subtitle" id="loader-sub">Sincronizando com o servidor. O projeto aparecerá em instantes!</div>
  </div>
  <iframe id="preview-frame" src="" data-src="${previewUrlFinal}" title="Preview"></iframe>
  <script>
    (function() {
      const frame = document.getElementById('preview-frame');
      const loader = document.getElementById('loader');
      const titleEl = document.getElementById('loader-title');
      const subEl = document.getElementById('loader-sub');
      const targetUrl = "${previewUrlFinal}";
      const isPromax = ${!!promaxMetadataToSave};
      let isLoaded = false;

      function revealSite() {
        if (isLoaded) return;
        isLoaded = true;
        frame.classList.add('loaded');
        loader.classList.add('hidden');
      }

      // Já inicia o carregamento no frame imediatamente
      frame.src = targetUrl;
      frame.addEventListener('load', () => setTimeout(revealSite, 300));

      let attempts = 0;
      const maxAttempts = 6;

      async function verificarEExibir() {
        if (isLoaded) return;
        attempts++;

        try {
          const verifyApi = 'https://back.sitexpres.com.br/api/sites/verify-url?url=' + encodeURIComponent(targetUrl) + '&tipo=' + (isPromax ? 'promax' : 'site');
          const res = await fetch(verifyApi, { cache: 'no-store' });
          const data = await res.json();

          if (data && data.ready) {
            if (titleEl) titleEl.innerText = "Site pronto! Renderizando...";
            if (subEl) subEl.innerText = "Sincronização concluída com sucesso.";
            frame.src = targetUrl;
            setTimeout(revealSite, 400);
            return;
          }
        } catch (e) {
          try {
            const probeUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + '_p=' + Date.now();
            const direct = await fetch(probeUrl, { cache: 'no-store' });
            if (direct.ok) {
              const text = (await direct.text()).toLowerCase();
              if (!text.includes('functioning normally') && (text.includes('<html') || text.includes('<!doctype') || text.includes('root') || text.includes('<body') || isPromax)) {
                frame.src = targetUrl;
                setTimeout(revealSite, 400);
                return;
              }
            }
          } catch (directErr) { }
        }

        if (attempts < maxAttempts) {
          setTimeout(verificarEExibir, 1000);
        } else {
          frame.src = targetUrl;
          setTimeout(revealSite, 500);
        }
      }

      verificarEExibir();
    })();
  </script>
</body>
</html>`;

          const jsContentToSave = promaxRawFilesToSave
            ? JSON.stringify(promaxRawFilesToSave)
            : html;

          const insertSite = await client.query(
            `INSERT INTO generated_sites 
           (user_id, name, prompt, html_content, id_projeto, image_path, subdominio, status, js_content)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, name, prompt, html_content, created_at`,
            [userId, `Site de ${nomeSubdominio}`, prompt, previewHtml, id_projeto, relativeImageURL || (existing?.rows?.[0]?.image_path ? desatrelarHtmlSitexpress(existing.rows[0].image_path) : null), nomeSubdominio, 'ativo', jsContentToSave]
          );

          const novoId = insertSite.rows[0].id;

          // Gera a mensagem inteligente com Haiku
          let assistantMessage = "";
          if (assistantMessageOverride) {
            assistantMessage = assistantMessageOverride;
          } else if (hasError || (typeof geracaoResult === 'object' && geracaoResult?.hasError)) {
            assistantMessage = MENSAGEM_CLIENTE_FINANCEIRO;
          } else {
            try {
              if (primeiraVez) {
                assistantMessage = uploadedFiles.length > 0
                  ? "🎉 Uau! Seu site foi gerado e publicado com sucesso com suas imagens incorporadas!"
                  : "🎉 Uau! Seu site foi gerado e publicado com sucesso!";
              } else {
                const attachmentsNote = uploadedFiles.length > 0
                  ? `\n[ARQUIVOS/IMAGENS RECEBIDOS E APLICADOS NO CÓDIGO: ${uploadedFiles.map(f => `"${f.originalname}" (caminho: /images/${f.filename})`).join(', ')}]`
                  : "";
                const isUsingDeepSeek = (process.env.AI_PROVIDER || (process.env.USE_DEEPSEEK === 'true' ? 'deepseek' : 'claude')).toLowerCase() === 'deepseek';
                const assistantSystemPrompt = `Você é o assistente virtual da Sitexpres, amigável e proativo. Informe de forma clara e objetiva o que você acabou de alterar no site dele com base ESTRITAMENTE no pedido atual do usuário ("${prompt}"), usando entre 20 a 40 palavras, e convide-o a conferir o resultado.${uploadedFiles.length > 0 ? ' ATENÇÃO CRÍTICA: O usuário enviou imagem(ns)/arquivo(s) que foram processados e aplicados com sucesso! Confirme expressamente a inclusão/atualização da(s) imagem(ns) no site. NUNCA diga que não recebeu, que não visualizou ou peça para enviar novamente!' : ''} NUNCA mencione alterações antigas (como favicon, logo, rodapé) a menos que o usuário tenha pedido especificamente isso no pedido atual! Sempre comece com um emoji.`;
                const assistantUserContent = `[CÓDIGO NOVO GERADO PARA O SITE]\n\`\`\`html\n${html ? html.substring(0, 30000) : "Nenhum código"}\n\`\`\`\n\nO usuário pediu: ${prompt}${attachmentsNote}`;

                if (isUsingDeepSeek) {
                  const deepAiResp = await deepseek.chat.completions.create({
                    model: "deepseek-chat",
                    max_tokens: 250,
                    messages: [
                      { role: "system", content: assistantSystemPrompt },
                      ...chatHistory.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
                      { role: "user", content: assistantUserContent }
                    ]
                  });
                  assistantMessage = deepAiResp.choices[0]?.message?.content || "";
                } else {
                  const aiResp = await anthropic.messages.create({
                    model: "claude-haiku-4-5-20251001",
                    max_tokens: 250,
                    system: assistantSystemPrompt,
                    messages: [
                      ...chatHistory,
                      {
                        role: "user",
                        content: assistantUserContent
                      }
                    ]
                  });
                  assistantMessage = aiResp.content[0].text;
                }
              }
            } catch (err) {
              console.error("Erro ao gerar mensagem com Haiku", err);
              if (isFinancialError(err)) {
                assistantMessage = MENSAGEM_CLIENTE_FINANCEIRO;
              } else {
                assistantMessage = "Suas alterações foram enviadas com sucesso! Confira o resultado no preview.";
              }
            }
          }

          assistantMessage = sanitizarRespostaSeguranca(assistantMessage);

          try {
            await client.query(
              `INSERT INTO site_prompts (user_id, id_projeto, prompt, id_site_gererate, status, assistant_message)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
              [userId, id_projeto, prompt, novoId, 'ativo', assistantMessage]
            );
          } catch (promptErr) {
            if (promptErr.code === '42703' || (promptErr.message && promptErr.message.includes('assistant_message'))) {
              console.warn(`[${new Date().toISOString()}] ⚠️ Coluna assistant_message ainda não existe em site_prompts. Inserindo sem ela e criando coluna...`);
              await client.query(
                `INSERT INTO site_prompts (user_id, id_projeto, prompt, id_site_gererate, status)
                   VALUES ($1, $2, $3, $4, $5)`,
                [userId, id_projeto, prompt, novoId, 'ativo']
              );
              // Executa migration assíncrona para adicionar a coluna para as próximas chamadas
              pool.query(`ALTER TABLE public.site_prompts ADD COLUMN IF NOT EXISTS assistant_message TEXT;`).catch(() => { });
            } else {
              throw promptErr;
            }
          }
          logStep(jobId, `✅ HTML salvo no banco (${Date.now() - tDB}ms) | id gerado: ${novoId}`);

          // Se for aplicação Promax, o deploy na VPS e a rota no DirectAdmin já foram executados pelo Maestro!
          if (promaxMetadataToSave) {
            logStep(jobId, `⚡ [PROMAX] Deploy e proxy configurados pelo Maestro. Verificando disponibilidade do CRM...`);
            const promaxTargetUrl = promaxMetadataToSave.url_dominio || promaxMetadataToSave.url_direta;
            await aguardarSiteOnline(promaxTargetUrl, {
              tipo: 'promax',
              maxTentativas: 15,
              intervaloMs: 1000,
              log: (msg) => logStep(jobId, msg)
            });
            client.release();
            client = null;
            jobs[jobId].progress = 100;
            jobs[jobId] = {
              status: "done",
              result: {
                html_content: previewHtml,
                assistant_message: assistantMessage,
                is_promax: true,
                url_dominio: promaxMetadataToSave.url_dominio,
                url_direta: promaxMetadataToSave.url_direta,
                metadata: promaxMetadataToSave
              },
              error: null
            };
            return;
          }

          const existe_hospedagem = await client.query(
            `SELECT * FROM hospedagens where id_projeto = $1`,
            [id_projeto]
          );

          // Coleta arquivos e imagens locais para subir junto na hospedagem do cliente
          const arquivosExtras = await coletarArquivosProjeto(id_projeto, html, uploadedFiles, client);
          logStep(jobId, `📁 Assets e imagens do projeto coletados para upload: ${arquivosExtras.length}`);

          // Libera antes do FTP (outra operação longa)
          client.release();
          client = null;

          // ─── FASE 4: envio via FTP ───────────────────────────────────────────
          logStep(jobId, `📤 Enviando site e assets via FTP para DirectAdmin... (hospedagem customizada: ${existe_hospedagem.rows.length > 0})`);
          const tFTP = Date.now();

          // Se for build Vite, copia os assets locais para a pasta dist antes do upload
          if (distPath && arquivosExtras.length > 0) {
            try {
              const imagesDist = path.join(distPath, 'images');
              await fs.mkdir(imagesDist, { recursive: true });
              for (const arq of arquivosExtras) {
                await fs.copyFile(arq.localPath, path.join(imagesDist, arq.remoteName));
              }
              logStep(jobId, `✅ ${arquivosExtras.length} asset(s) copiado(s) para dist/images`);
            } catch (copyErr) {
              console.error("Erro ao copiar imagens para dist:", copyErr);
            }
          }

          if (hasError) {
            logStep(jobId, `🛡️ [FTP CANCELADO] Geração com erro. Upload FTP bloqueado para impedir corrupção do site.`);
          } else if (existe_hospedagem.rows.length > 0) {
            try {
              const username = existe_hospedagem.rows[0].username;
              const password = existe_hospedagem.rows[0].senha;
              const dominio_hospedagem = existe_hospedagem.rows[0].dominio;
              try {
                if (distPath) {
                  await enviarDiretorioSubdominio("ftp.sitexpres.com.br", username, password, dominio_hospedagem, distPath);
                } else {
                  await enviarHTMLSubdominio("ftp.sitexpres.com.br", username, password, dominio_hospedagem, html, arquivosExtras);
                }
              } catch (e1) {
                logStep(jobId, `⚠️ Falha no ftp.sitexpres.com.br. Tentando fallback para srv3br.com.br...`);
                try {
                  if (distPath) {
                    await enviarDiretorioSubdominio("srv3br.com.br", username, password, dominio_hospedagem, distPath);
                  } else {
                    await enviarHTMLSubdominio("srv3br.com.br", username, password, dominio_hospedagem, html, arquivosExtras);
                  }
                  logStep(jobId, `✅ Arquivos enviados via FTP (Fallback srv3br.com.br)`);
                } catch (e2) {
                  logStep(jobId, `⚠️ Erro FTP Customizado (ambos servidores): ${e2.message}`);
                  console.error("Erro FTP Customizado:", e2);
                }
              }
              logStep(jobId, `✅ Site e assets enviados via FTP (${Date.now() - tFTP}ms)`);
            } catch (errFTP) {
              logStep(jobId, `⚠️ Erro ao enviar FTP (Customizado): ${errFTP.message}`);
              console.error("Erro FTP Customizado:", errFTP);
            }
          } else {
            try {
              try {
                if (distPath) {
                  await enviarDiretorioSubdominio("ftp.sitexpres.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", distPath);
                } else {
                  await enviarHTMLSubdominio("ftp.sitexpres.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", html, arquivosExtras);
                }
              } catch (e1) {
                logStep(jobId, `⚠️ Falha no ftp.sitexpres.com.br. Tentando fallback para srv3br.com.br...`);
                try {
                  if (distPath) {
                    await enviarDiretorioSubdominio("srv3br.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", distPath);
                  } else {
                    await enviarHTMLSubdominio("srv3br.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", html, arquivosExtras);
                  }
                  logStep(jobId, `✅ Arquivos enviados via FTP (Fallback srv3br.com.br)`);
                } catch (e2) {
                  logStep(jobId, `⚠️ Erro FTP DirectAdmin (ambos servidores): ${e2.message} (Preview continuará funcionando)`);
                  console.error("Erro FTP DirectAdmin:", e2);
                }
              }
              logStep(jobId, `✅ Site e assets enviados via FTP (${Date.now() - tFTP}ms)`);
            } catch (errFTP) {
              logStep(jobId, `⚠️ Erro ao enviar FTP (DirectAdmin): ${errFTP.message} (Preview continuará funcionando)`);
              console.error("Erro FTP DirectAdmin:", errFTP);
            }
          }

          try {
            const zipsDir = path.join(process.cwd(), 'uploads', 'zips');
            await fs.mkdir(zipsDir, { recursive: true });
            const zipPath = path.join(zipsDir, `${id_projeto}.zip`);

            await new Promise((resolve, reject) => {
              const output = fsSync.createWriteStream(zipPath);
              let archive;
              if (archiver && archiver.ZipArchive) {
                archive = new archiver.ZipArchive({ zlib: { level: 9 } });
              } else if (archiver && archiver.default && archiver.default.ZipArchive) {
                archive = new archiver.default.ZipArchive({ zlib: { level: 9 } });
              } else if (typeof archiver === 'function') {
                archive = archiver('zip', { zlib: { level: 9 } });
              } else if (archiver && typeof archiver.create === 'function') {
                archive = archiver.create('zip', { zlib: { level: 9 } });
              } else if (archiver && typeof archiver.default === 'function') {
                archive = archiver.default('zip', { zlib: { level: 9 } });
              } else {
                throw new Error("Archiver não é suportado: " + typeof archiver);
              }
              output.on('close', resolve);
              archive.on('error', reject);
              archive.pipe(output);

              if (distPath) {
                archive.directory(distPath, false);
              } else {
                archive.append(html, { name: 'index.html' });
                if (Array.isArray(arquivosExtras)) {
                  for (const arq of arquivosExtras) {
                    archive.file(arq.localPath, { name: `images/${arq.remoteName}` });
                  }
                }
              }
              try {
                archive.finalize();
              } catch (finErr) {
                reject(finErr);
              }
            });
            logStep(jobId, `📦 ZIP do projeto criado com arquivos locais`);
          } catch (zipErr) {
            console.error('Erro ao criar zip:', zipErr);
          }

          // Limpa a pasta temporária do build
          if (tmpDirPath) { await fs.rm(tmpDirPath, { recursive: true, force: true }).catch(e => console.error('Erro ao deletar tmp dir:', e)); }


          // Update no github caso integrado
          logStep(jobId, '🐙 Verificando integração com GitHub...');
          const githubResult = await updateGitHubIfIntegrated(
            userId, id_projeto, html, "Atualização do site via SiteXpress"
          );

          if (githubResult.updated) {
            logStep(jobId, `✅ GitHub atualizado: ${githubResult.repoUrl}`);
          } else {
            logStep(jobId, 'ℹ️  GitHub não integrado — ignorando atualização');
          }

          // Verificação ativa: aguarda servidor web propagar os novos arquivos e não exibir mais o placeholder
          const siteTargetUrl = `https://${nomeSubdominio}.sitexpres.com.br`;
          logStep(jobId, `🔍 [VERIFICADOR] Checando se o site já está online e livre do placeholder...`);
          await aguardarSiteOnline(siteTargetUrl, {
            tipo: 'site',
            maxTentativas: 15,
            intervaloMs: 1000,
            log: (msg) => logStep(jobId, msg)
          });

          const totalMs = Date.now() - jobStartTime;
          logStep(jobId, `🎉 Job concluído com SUCESSO em ${(totalMs / 1000).toFixed(1)}s`);
          jobs[jobId] = { status: "done", result: { ...insertSite.rows[0], assistant_message: assistantMessage }, error: null };

        } catch (error) {
          const totalMs = Date.now() - jobStartTime;
          console.error(`[${new Date().toISOString()}] [JOB:${jobId}] ❌ ERRO após ${(totalMs / 1000).toFixed(1)}s:`, error.message);
          console.error(error);
          const isFin = isFinancialError(error);
          const userFacingError = isFin
            ? MENSAGEM_CLIENTE_FINANCEIRO
            : MENSAGEM_CLIENTE_FALHA_EDICAO;

          if (!primeiraVez && existing?.rows?.[0]) {
            jobs[jobId] = {
              status: "done",
              result: {
                ...(existing?.rows?.[0] || {}),
                assistant_message: userFacingError
              },
              error: null
            };
          } else {
            jobs[jobId] = { status: "error", result: null, error: userFacingError };
          }
        } finally {
          if (client) {
            try { client.release(); } catch (ignored) { }
          }
        }
      })();

    }



  } catch (error) {
    //console.error(error);
    console.error("ERRO NO NEW SITE:", error);

    res.status(500).json({ success: false, message: "Erro ao criar job" });
  }

};


// Rota para verificar status do job
export const jobStatus = (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];
  if (!job) return res.status(404).json({ success: false, message: "Job não encontrado" });
  res.json({ success: true, job });
};

export const getSites = async (req, res) => {

  let client;

  try {
    client = await pool.connect();
    /*  const result = await pool.query(
       "SELECT id, name, prompt, views, created_at FROM generated_sites WHERE user_id = $1 ORDER BY created_at DESC",
       [req.userId]
     ); */
    const result = await pool.query(
      `SELECT DISTINCT ON (g.id_projeto)
            g.id,
            g.name,
            g.prompt,
            g.views,
            g.created_at,
            g.html_content,
            g.subdominio,
            g.id_projeto,
            s.metadata,
            s.site_url,
            h.dominio as custom_dominio
        FROM generated_sites g
        LEFT JOIN (
            SELECT DISTINCT ON (id_projeto) id_projeto, metadata, site_url 
            FROM public.sites 
            ORDER BY id_projeto, id DESC
        ) s ON s.id_projeto = g.id_projeto
        LEFT JOIN (
            SELECT DISTINCT ON (id_projeto) id_projeto, dominio 
            FROM public.hospedagens 
            ORDER BY id_projeto, id DESC
        ) h ON h.id_projeto = g.id_projeto
        WHERE g.user_id = $1
        AND g.status = $2
        ORDER BY g.id_projeto, g.created_at DESC`,
      [req.userId, 'ativo']
    );

    const sitesWithPromax = result.rows.map(row => {
      let is_promax = false;
      if (row.metadata) {
        try {
          const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          is_promax = !!meta?.is_promax;
        } catch (e) {}
      }

      // Se o site possui um domínio oficial próprio cadastrado em hospedagens ou sites
      let customUrl = null;
      if (row.custom_dominio) {
        customUrl = `https://${row.custom_dominio}`;
      } else if (row.site_url && !row.site_url.includes('.sitexpres.com.br')) {
        customUrl = row.site_url;
      }

      let updatedHtml = row.html_content;
      if (customUrl && updatedHtml) {
        // Substitui URLs antigas no preview para o novo domínio oficial
        updatedHtml = updatedHtml
          .replace(/data-src="https?:\/\/[^"]+"/g, `data-src="${customUrl}"`)
          .replace(/const targetUrl = "https?:\/\/[^"]+";/g, `const targetUrl = "${customUrl}";`);
      }

      // Se o site já tem mais de 45 segundos de criado, reduz drasticamente o tempo de espera do loader
      if (updatedHtml && row.created_at && (Date.now() - new Date(row.created_at).getTime() > 45000)) {
        updatedHtml = updatedHtml
          .replace('const maxAttempts = 30;', 'const maxAttempts = 2;')
          .replace('const maxAttempts = 6;', 'const maxAttempts = 2;');
      }

      const { metadata, custom_dominio, site_url, ...rest } = row;
      return {
        ...rest,
        html_content: updatedHtml,
        is_promax
      };
    });

    res.json({ success: true, sites: sitesWithPromax });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erro ao buscar sites" });
  }
};

// Retorna os dados de analytics de um site para uso em gráficos
export const getSiteAnalytics = async (req, res) => {
  const { id_projeto } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         TO_CHAR(date, 'YYYY-MM') AS mes,
         date,
         views_count,
         hits,
         files,
         unique_visitors,
         bounce_rate,
         avg_session_duration
       FROM site_analytics
       WHERE id_projeto = $1
       ORDER BY date ASC`,
      [id_projeto]
    );

    res.json({ success: true, analytics: result.rows });
  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar analytics' });
  }
};

export const getPromts = async (req, res) => {
  let client;

  try {
    client = await pool.connect();

    const { id_projeto } = req.params;

    const result = await pool.query(
      `SELECT id, id_projeto, prompt, created_at,id_site_gererate,status,assistant_message
       FROM public.site_prompts
       WHERE id_projeto = $1
       ORDER BY created_at DESC`,
      [id_projeto]
    );

    res.json({ success: true, prompts: result.rows });
  } catch (error) {
    console.error("Erro ao buscar prompts:", error);
    res.status(500).json({ success: false, message: "Erro ao buscar prompts" });
  } finally {
    if (client) client.release();
  }
};

//Check se id _projeto já existe
export const check_id_projeto = async (req, res) => {
  // 1. Obter o ID do projeto dos parâmetros da rota
  const { id_projeto } = req.params;
  let client;

  // 2. Consulta SQL eficiente: COUNT(*)
  const query = `
        SELECT COUNT(*) AS count
        FROM public.generated_sites
        WHERE id_projeto = $1;
    `;

  try {
    // 3. Obter uma conexão do pool
    client = await pool.connect();

    // 4. Executar a consulta, usando $1 para o id_projeto para prevenir SQL Injection
    const result = await client.query(query, [id_projeto]);

    // 5. Extrair e converter o resultado da contagem
    // O resultado da contagem é uma string/BIGINT no PostgreSQL, convertemos para número.
    const rowCount = parseInt(result.rows[0].count, 10);

    // 6. Implementar a lógica solicitada: retornar TRUE se a contagem for ZERO.
    const return_value = rowCount === 0;

    // 7. Enviar a resposta com status 200 (OK)
    // O valor enviado será true ou false.
    console.log(`Verificação de ID Projeto ${id_projeto}: Linhas encontradas: ${rowCount}. Retorno: ${return_value}`);
    res.status(200).json(return_value);

  } catch (err) {
    // 8. Logar o erro e enviar uma resposta de erro 500
    console.error("Erro no check_id_projeto:", err.message);
    res.status(500).json({
      error: "Erro interno do servidor ao verificar a existência do projeto.",
      details: err.message
    });
  } finally {
    // 9. Sempre liberar a conexão de volta ao pool
    if (client) {
      client.release();
    }
  }
};

export async function gerarNomeSubdominio(prompt) {
  try {
    const systemPrompt = `
      Você é um assistente que sugere nomes curtos, únicos e descritivos para projetos de sites.
      Retorne apenas uma palavra ou combinação curta sem espaços ou caracteres especiais,
      adequada para ser usada como subdomínio.
      Exemplo: "site de carro" → "sitecarro"
    `;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",        // modelo atualizado
      system: systemPrompt,     // <-- aqui é o system prompt
      messages: [
        { role: "user", content: `Prompt do projeto: ${prompt}\nNome do subdomínio:` }
      ],
      max_tokens: 1000,
    });

    // A resposta vem em response.content[0].text
    const nomeGerado = response.content?.[0]?.text || "";
    const nome = nomeGerado.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    return nome.length > 15 ? nome.substring(0, 15) : nome;

  } catch (err) {
    console.error("Erro ao gerar nome do subdomínio via IA:", err);
    // fallback manual
    return prompt.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 15);
  }
}

export const testecret_domin = async (req, res) => {
  try {
    const { subdominio } = req.body;

    if (!subdominio) {
      return res.status(400).json({ error: "Informe o subdomínio desejado." });
    }

    console.log("➡️ Criando subdomínio:", subdominio);

    // 1️⃣ Cria o subdomínio via DirectAdmin
    const respostaCriacao = await criarSubdominioDirectAdmin(subdominio, "sitexpres.com.br");
    console.log("✅ Subdomínio criado com resposta:", respostaCriacao);

    // 2️⃣ Gera o HTML temporário
    const htmlExemplo = `
      <!DOCTYPE html>
      <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <title>Bem-vindo ao subdomínio ${subdominio}.sitexpres.com.br</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: linear-gradient(135deg, #6e8efb, #a777e3);
              color: #fff;
              text-align: center;
              padding-top: 100px;
            }
            h1 {
              font-size: 2.5em;
            }
            p {
              font-size: 1.2em;
            }
          </style>
        </head>
        <body>
          <h1>Subdomínio criado com sucesso!</h1>
          <p>Este é um exemplo de página HTML enviada automaticamente.</p>
          <p><b>Subdomínio:</b> ${subdominio}.sitexpres.com.br</p>
        </body>
      </html>
    `;

    console.log("📄 Gerando arquivo temporário HTML...");
    const tempPath = path.join("/tmp", `${subdominio}.html`);
    await fs.writeFile(tempPath, htmlExemplo);

    // 3️⃣ Envia o arquivo via FTP
    console.log("📤 Enviando HTML para o subdomínio via FTP...");

    const client = new ftp.Client();
    client.ftp.verbose = true;

    try {
      await client.access({
        host: "143.208.8.36",
        user: process.env.user_directamin,
        password: process.env.pass_directamin,
        port: 21,
      });

      const remotePath = `/domains/${subdominio}.sitexpres.com.br/public_html/index.html`;
      await client.ensureDir(`/domains/${subdominio}.sitexpres.com.br/public_html`);
      await client.uploadFrom(tempPath, remotePath);
      console.log("✅ HTML enviado com sucesso!");
    } catch (ftpError) {
      console.error("❌ Erro ao enviar HTML via FTP:", ftpError);
      throw ftpError;
    } finally {
      client.close();
      await fs.unlink(tempPath).catch(() => { });
    }

    // 4️⃣ Retorna sucesso
    res.json({
      success: true,
      message: `Subdomínio ${subdominio}.sitexpres.com.br criado e HTML enviado com sucesso!`,
    });
  } catch (error) {
    console.error("❌ Erro ao criar subdomínio de teste:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao criar o subdomínio de teste.",
      detalhes: error.message,
    });
  }
};

export const list_don = async (req, res) => {
  try {
    const existe = await subdominioExiste("finalmengal", "sitexpres.com.br");

    console.log("----- RESULTADO -----");
    console.log(existe);
    console.log("---------------------");

    return res.status(200).json({ existe });
  } catch (err) {
    console.error("Erro ao listar domínios:", err.message);
    return res.status(500).json({ error: "Erro ao consultar subdomínio." });
  }
};

export const get_dominio = async (req, res) => {
  const { id_projeto } = req.params;
  let client;

  try {
    client = await pool.connect();

    // 1. Verifica primeiro na tabela sites (onde fica o metadata completo do Promax)
    const siteMetaRes = await client.query(
      "SELECT site_url, metadata FROM public.sites WHERE id_projeto = $1 ORDER BY id DESC LIMIT 1",
      [id_projeto]
    );

    if (siteMetaRes.rows.length > 0 && siteMetaRes.rows[0].site_url) {
      const siteUrl = siteMetaRes.rows[0].site_url;
      const metadata = typeof siteMetaRes.rows[0].metadata === 'string'
        ? JSON.parse(siteMetaRes.rows[0].metadata)
        : siteMetaRes.rows[0].metadata;

      const isPromax = !!metadata?.is_promax;
      let subdominio = metadata?.projectName || metadata?.subdominio;
      if (!subdominio && siteUrl.includes('.sitexpres.com.br')) {
        subdominio = siteUrl.replace(/^https?:\/\//, '').replace('.sitexpres.com.br', '').split('/')[0];
      }

      return res.json({
        subdominio: subdominio || id_projeto,
        url: siteUrl,
        is_promax: isPromax,
        metadata: isPromax ? metadata : undefined
      });
    }

    // 2. Fallback para generated_sites
    const result = await client.query(
      "SELECT subdominio FROM generated_sites WHERE id_projeto = $1 LIMIT 1",
      [id_projeto]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subdomínio não encontrado." });
    }

    const { subdominio } = result.rows[0];

    return res.json({
      subdominio,
      url: `https://${subdominio}.sitexpres.com.br`,
      is_promax: false
    });
  } catch (error) {
    console.error("Erro ao buscar subdomínio:", error);
    return res.status(500).json({ error: "Erro interno ao buscar subdomínio." });
  } finally {
    if (client) client.release();
  }
};

export const restauracao_versao = async (req, res) => {
  try {
    const { id, id_projeto, id_site_gererate } = req.body;

    console.log('==== Restore Version ====')
    console.log("Dados recebidos:", { id, id_projeto, id_site_gererate });

    // Colocando todos os site_prompts como inativo
    await pool.query(
      `UPDATE public.site_prompts
       SET status = 'inativo'
       WHERE id_projeto = $1`,
      [id_projeto]
    );

    // Ativando 1 site_prompt específico pelo id
    await pool.query(
      `UPDATE public.site_prompts
       SET status = 'ativo'
       WHERE id = $1 AND id_projeto = $2`,
      [id, id_projeto]
    );

    // Colocando todos os generated_sites como inativo
    await pool.query(
      `UPDATE public.generated_sites
       SET status = 'inativo'
       WHERE id_projeto = $1`,
      [id_projeto]
    );

    // Ativando 1 generated_site específico pelo id
    await pool.query(
      `UPDATE public.generated_sites
       SET status = 'ativo'
       WHERE id = $1 AND id_projeto = $2`,
      [id_site_gererate, id_projeto]
    );

    //Consultado Site

    /*  const resultado = await pool.query(
          `SELECT * FROM public.sites
           WHERE id_projeto = $1 
           AND status = 'ativo'`,
          [id_projeto]
        );
        */

    //Consult html 
    const resultado = await pool.query(
      `SELECT html_content, js_content 
       FROM public.generated_sites
       WHERE id_projeto = $1 
       AND status = 'ativo'`,
      [id_projeto]
    );

    let html_new = resultado.rows[0]?.html_content || "<h5>Nenhum HTML encontrado</h5><br>erro:@$231";
    html_new = desatrelarHtmlSitexpress(html_new);

    let js_content = resultado.rows[0]?.js_content || extrairReactCode(html_new);

    const arquivosExtras = await coletarArquivosProjeto(id_projeto, html_new, null, pool);

    const dados_sites = await pool.query(
      `SELECT site_url FROM public.sites
       WHERE id_projeto = $1`,
      [id_projeto]
    );

    let site_url = dados_sites.rows[0]?.site_url;
    let subdominio = "";

    if (site_url) {
      try {
        const url_string = site_url.startsWith('http') ? site_url : 'https://' + site_url;
        const url = new URL(url_string);
        subdominio = url.host;
      } catch (e) {
        subdominio = site_url.replace(/^https?:\/\//, '');
      }
    }

    if (!subdominio) {
      const dados_gen = await pool.query(
        `SELECT subdominio, name FROM public.generated_sites WHERE id_projeto = $1 LIMIT 1`,
        [id_projeto]
      );
      if (dados_gen.rows.length > 0) {
        subdominio = dados_gen.rows[0].subdominio
          ? dados_gen.rows[0].subdominio + '.sitexpres.com.br'
          : dados_gen.rows[0].name.replace("Site de ", "").toLowerCase() + '.sitexpres.com.br';
      }
    }

    console.log("Subdomínio ==> " + subdominio);

    // Identificar hostFTP, userFTP e passFTP (Custom Hosting ou DirectAdmin)
    const existe_hospedagem = await pool.query(
      `SELECT * FROM hospedagens where id_projeto = $1`,
      [id_projeto]
    );

    let isCustomHost = false;
    let userFTP = process.env.user_directamin;
    let passFTP = process.env.pass_directamin;
    let dominioFTP = subdominio;

    if (existe_hospedagem.rows.length > 0) {
      userFTP = existe_hospedagem.rows[0].username;
      passFTP = existe_hospedagem.rows[0].senha;
      dominioFTP = existe_hospedagem.rows[0].dominio;
      isCustomHost = true;
    }

    // Build do Vite
    const __filename_local = fileURLToPath(import.meta.url);
    const __dirname_local = path.dirname(__filename_local);
    const templatePath = path.resolve(__dirname_local, "../templates/vite-base");
    const tmpBase = path.resolve(__dirname_local, "../tmp");
    if (!fsSync.existsSync(tmpBase)) {
      fsSync.mkdirSync(tmpBase, { recursive: true });
    }
    const tmpDirName = `restauracao_${id_projeto}_${Date.now()}`;
    const tmpDirPath = path.join(tmpBase, tmpDirName);

    let distPath = null;

    try {
      if (js_content) {
        await fs.cp(templatePath, tmpDirPath, { recursive: true });
        await fs.writeFile(path.join(tmpDirPath, "src", "App.jsx"), js_content, 'utf8');

        // Atualizar title do index.html
        if (site_url) {
          let siteNome = site_url.replace(/^https?:\/\//, '').replace('.sitexpres.com.br', '');
          siteNome = siteNome.charAt(0).toUpperCase() + siteNome.slice(1);
          const indexHtmlPath = path.join(tmpDirPath, "index.html");
          if (fsSync.existsSync(indexHtmlPath)) {
            let indexHtmlContent = await fs.readFile(indexHtmlPath, 'utf8');
            indexHtmlContent = indexHtmlContent.replace(/<title>.*?<\/title>/i, `<title>${siteNome}</title>`);
            await fs.writeFile(indexHtmlPath, indexHtmlContent, 'utf8');
          }
        }

        const vitePkg = path.join(tmpDirPath, "node_modules", "vite");
        if (!fsSync.existsSync(vitePkg)) {
          const lockPath = path.join(tmpDirPath, "package-lock.json");
          if (fsSync.existsSync(lockPath)) {
            await fs.unlink(lockPath).catch(() => {});
          }
          try {
            await execPromise('npm install --legacy-peer-deps --no-package-lock --include=dev --no-audit', { cwd: tmpDirPath });
          } catch (e1) {
            await execPromise('npm install --force --legacy-peer-deps --include=dev --no-audit', { cwd: tmpDirPath });
          }
        }
        await execPromise('chmod -R +x node_modules/.bin || true', { cwd: tmpDirPath }).catch(() => { });

        try {
          await execPromise('npx --no-install vite build', { cwd: tmpDirPath });
        } catch {
          await execPromise('npm run build', { cwd: tmpDirPath });
        }
        distPath = path.join(tmpDirPath, "dist");

        // Copiar arquivos extras (imagens) para a pasta dist
        if (distPath && arquivosExtras.length > 0) {
          const imagesDist = path.join(distPath, 'images');
          await fs.mkdir(imagesDist, { recursive: true });
          for (const arq of arquivosExtras) {
            await fs.copyFile(arq.localPath, path.join(imagesDist, arq.remoteName));
          }
        }
      }
    } catch (e) {
      console.error("Erro no build da restauração", e);
    }

    // Enviar ao FTP
    try {
      if (distPath && fsSync.existsSync(distPath)) {
        await enviarDiretorioSubdominio(
          "ftp.sitexpres.com.br",
          userFTP,
          passFTP,
          dominioFTP,
          distPath
        );
      } else {
        await enviarHTMLSubdominio(
          "ftp.sitexpres.com.br",
          userFTP,
          passFTP,
          dominioFTP,
          html_new,
          arquivosExtras
        );
      }
    } catch (e1) {
      console.error("Erro ao enviar FTP (restauração), tentando fallback", e1.message);
      try {
        if (distPath && fsSync.existsSync(distPath)) {
          await enviarDiretorioSubdominio("srv3br.com.br", userFTP, passFTP, dominioFTP, distPath);
        } else {
          await enviarHTMLSubdominio("srv3br.com.br", userFTP, passFTP, dominioFTP, html_new, arquivosExtras);
        }
      } catch (e2) {
        console.error("Erro FTP (fallback) na restauração:", e2.message);
      }
    } finally {
      if (tmpDirPath && fsSync.existsSync(tmpDirPath)) {
        await fs.rm(tmpDirPath, { recursive: true, force: true }).catch(e => console.error(e));
      }
    }

    //--------------------

    return res.json({
      success: true,
      message: "Versão restaurada com sucesso!",
      html_new: html_new
    });

    return res.json({
      success: true,
      message: "Versão restaurada com sucesso",
      html_new: "<h5>o novo aqui</h5>"
    });

  } catch (error) {
    console.error("Erro ao restaurar versão:", error);

    return res.status(500).json({
      success: false,
      message: "Erro interno ao restaurar versão"
    });
  }
};


export const send_projeto_para_github = async (req, res) => {

}
export const deletar_site = async (req, res) => {
  try {
    const { id_projeto } = req.body;

    // Validação do parâmetro
    if (!id_projeto) {
      return res.status(400).json({
        success: false,
        message: "ID do projeto não fornecido"
      });
    }

    // Busca os dados do site
    const dados_sites = await pool.query(
      `SELECT * FROM public.sites
       WHERE id_projeto = $1`,
      [id_projeto]
    );

    // Verifica se o projeto existe
    if (!dados_sites.rows || dados_sites.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Projeto não encontrado"
      });
    }
    const url_completa = dados_sites.rows[0].site_url; // Ex: https://upeexservices.sitexpres.com.br

    // Deletando subdomínio do directadmin (com tratamento de erro)
    try {
      if (url_completa) {
        // 1. Cria o objeto URL para facilitar a manipulação
        const urlObj = new URL(url_completa);

        // 2. Pega o hostname (ex: upeexservices.sitexpres.com.br)
        const hostname = urlObj.hostname;

        // 3. Extrai apenas a parte antes do primeiro ponto
        // Se o domínio for sempre "sitexpres.com.br", isso pega exatamente o "upeexservices"
        const subdominio = hostname.split('.')[0];

        console.log(`Extraído: ${subdominio} de ${url_completa}`); // Para debug

        // Chama a função passando apenas o subdomínio limpo
        const retorno_deletarSubdominioDirectAdmin = await deletarSubdominioDirectAdmin(subdominio);

        console.log("DirectAdmin:", retorno_deletarSubdominioDirectAdmin);
      }
    } catch (error) {
      console.error("Erro ao deletar subdomínio no DirectAdmin:", error);
      // Continua mesmo se falhar no DirectAdmin
    }


    // Deleta os registros relacionados
    await pool.query(
      `DELETE FROM public.site_prompts
       WHERE id_projeto = $1`,
      [id_projeto]
    );

    await pool.query(
      `DELETE FROM public.generated_sites
       WHERE id_projeto = $1`,
      [id_projeto]
    );

    await pool.query(
      `DELETE FROM public.sites
       WHERE id_projeto = $1`,
      [id_projeto]
    );

    return res.json({
      success: true,
      url: url_completa,
      message: "Site deletado com sucesso!"
    });

  } catch (error) {
    console.error("Erro ao deletar site:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao deletar site",
      error: error.message
    });
  }
};

/**
 * Aguarda ativamente até que o servidor web (LiteSpeed/DirectAdmin ou Proxy VPS)
 * esteja servindo o HTML real ou CRM do cliente, e NÃO a página de placeholder
 * "Web server is functioning normally" ou respostas temporárias 502/503.
 */
export async function aguardarSiteOnline(url, { tipo = 'site', maxTentativas = 15, intervaloMs = 1000, log = console.log } = {}) {
  if (!url) return { pronto: false };
  log(`⏳ [VERIFICADOR] Checando se ${url} já está respondendo com o conteúdo final...`);

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const probeUrl = `${url}${url.includes('?') ? '&' : '?'}_probe=${Date.now()}`;
      const response = await axios.get(probeUrl, {
        timeout: 3000,
        validateStatus: () => true,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'User-Agent': 'SitexpresVerifier/1.0'
        }
      });

      const status = response.status;
      const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
      const lower = dataStr.toLowerCase();

      // Checa placeholders de DirectAdmin, LiteSpeed e Apache
      const isPlaceholder =
        lower.includes('web server is functioning normally') ||
        lower.includes('apache is functioning normally') ||
        lower.includes('functioning normally') ||
        (lower.includes('litespeed web server') && lower.includes('default page'));

      const isErrorStatus = status >= 500 || status === 404;

      if (!isErrorStatus && !isPlaceholder && status === 200) {
        if (tipo === 'site') {
          const temHtmlReal = lower.includes('<html') || lower.includes('<!doctype') || lower.includes('root') || lower.includes('<body') || lower.includes('<div');
          if (temHtmlReal) {
            log(`✅ [VERIFICADOR] Site verificado e ativo no servidor web (${tentativa}s)!`);
            return { pronto: true, tentativa };
          }
        } else {
          // CRM / Promax
          log(`✅ [VERIFICADOR] CRM verificado e ativo no servidor web (${tentativa}s)!`);
          return { pronto: true, tentativa };
        }
      }

      log(`⏳ [VERIFICADOR] Servidor ainda sincronizando (${tentativa}/${maxTentativas}): HTTP ${status}${isPlaceholder ? ' [placeholder DirectAdmin detectado]' : ''}`);
    } catch (err) {
      log(`⏳ [VERIFICADOR] Aguardando resposta do host (${tentativa}/${maxTentativas}): ${err.message}`);
    }

    await new Promise(r => setTimeout(r, intervaloMs));
  }

  log(`⚠️ [VERIFICADOR] Tempo limite de espera atingido (${maxTentativas}s). Liberando exibição.`);
  return { pronto: false };
}

/**
 * Endpoint de verificação pública para o iframe de preview ou dashboard saber
 * se o site já propagou e se está livre do placeholder "Web server is functioning normally".
 */
export const verifySiteReady = async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const tipo = req.query.tipo || 'site';

    if (!targetUrl) {
      return res.status(400).json({ success: false, ready: false, message: 'URL não informada' });
    }

    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname.toLowerCase();
      let isAllowedHost =
        host.endsWith('.sitexpres.com.br') ||
        host === 'sitexpres.com.br' ||
        host === '143.208.9.235' ||
        host === '143.208.8.36' ||
        host === 'localhost';

      if (!isAllowedHost) {
        // Verifica se é um domínio personalizado cadastrado na tabela hospedagens ou sites
        const cleanHost = host.replace(/^www\./, '');
        try {
          const checkHost = await pool.query(
            `SELECT 1 FROM hospedagens WHERE LOWER(dominio) = $1 OR LOWER(dominio) = $2
             UNION
             SELECT 1 FROM sites WHERE site_url ILIKE $3
             LIMIT 1`,
            [cleanHost, host, `%${cleanHost}%`]
          );
          if (checkHost.rows.length > 0) {
            isAllowedHost = true;
          }
        } catch (dbHostErr) {
          console.warn('Erro ao verificar domínio na tabela hospedagens/sites:', dbHostErr.message);
          // Em caso de falha de consulta no banco, autoriza se for um host válido para não bloquear o preview
          isAllowedHost = true;
        }
      }

      if (!isAllowedHost) {
        return res.status(403).json({ success: false, ready: false, message: 'Host não autorizado' });
      }
    } catch (e) {
      return res.status(400).json({ success: false, ready: false, message: 'URL inválida' });
    }

    const probeUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}_probe=${Date.now()}`;
    const response = await axios.get(probeUrl, {
      timeout: 3000,
      validateStatus: () => true,
      maxRedirects: 5,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'User-Agent': 'SitexpresVerifier/1.0'
      }
    });

    const status = response.status;
    const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
    const lower = dataStr.toLowerCase();

    const isPlaceholder =
      lower.includes('web server is functioning normally') ||
      lower.includes('apache is functioning normally') ||
      lower.includes('functioning normally') ||
      (lower.includes('litespeed web server') && lower.includes('default page'));

    const isErrorStatus = status >= 500 || status === 404;

    if (!isErrorStatus && !isPlaceholder && status === 200) {
      if (tipo === 'site') {
        const temHtmlReal = lower.includes('<html') || lower.includes('<!doctype') || lower.includes('root') || lower.includes('<body') || lower.includes('<div');
        if (temHtmlReal) {
          return res.json({ success: true, ready: true, status: 200 });
        }
      } else {
        return res.json({ success: true, ready: true, status: 200 });
      }
    }

    return res.json({
      success: true,
      ready: false,
      status: status,
      isPlaceholder,
      message: isPlaceholder ? 'Placeholder DirectAdmin detectado' : 'Aguardando inicialização'
    });
  } catch (err) {
    return res.json({
      success: true,
      ready: false,
      error: err.message
    });
  }
};



