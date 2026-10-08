import * as cheerio from 'cheerio';
import pool from "../config/db.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import axios from "axios";
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
// ⚠️ REMOVIDO: import { console, url } from "inspector" — esse import sobrescrevia o console global e suprimia os logs no terminal!

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
    const { prompt, id_projeto, userId } = req.body;

    logStep(null, `📥 Nova requisição newsite | userId=${userId} | id_projeto=${id_projeto}`);

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
        let primeiraVez, baseHTML, nomeSubdominio, finalPrompt;

        try {
          // ─── FASE 1: consultas rápidas ao BD ────────────────────────────────
          logStep(jobId, '🔗 Conectando ao banco de dados...');
          client = await pool.connect();
          logStep(jobId, `✅ Conexão com BD estabelecida (${Date.now() - jobStartTime}ms)`);

          logStep(jobId, '🔍 Verificando se site já existe...');
          const t3 = Date.now();
          const existing = await client.query(
            `SELECT id, name, html_content, js_content FROM generated_sites 
           WHERE id_projeto = $1 and status = 'ativo'
           ORDER BY created_at DESC LIMIT 1`,
            [id_projeto]
          );
          logStep(jobId, `✅ Consulta BD concluída (${Date.now() - t3}ms) | site existente: ${existing.rows.length > 0}`);

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
          baseHTML    = primeiraVez ? "" : (existing.rows[0].js_content || extrairReactCode(existing.rows[0].html_content));
          if (!primeiraVez) {
            nomeSubdominio = existing.rows[0].name.replace("Site de ", "").toLowerCase();
          }
          logStep(jobId, `ℹ️  Modo: ${primeiraVez ? 'CRIAÇÃO (primeira vez)' : 'EDIÇÃO (site existente)'}`);

          logStep(jobId, '🔎 Verificando se há URLs no prompt original...');
          const promptWithUrls = await extractUrlsAndFetchContent(prompt, logStep, jobId);

          const fullPrompt = uploadedFiles.length > 0
            ? `${promptWithUrls}\n[INSTRUÇÃO DE IMAGENS/LOGOS: O usuário enviou ${uploadedFiles.length} imagem(ns). Utilize os caminhos relativos abaixo nas tags <img> correspondentes. O nome original do arquivo indica o propósito de cada imagem (ex: "logo.png" → use como logo, "footer.jpg" → use no footer, "banner.jpg" → use como banner):\n${uploadedFiles.map((f, i) => `- Arquivo "${f.originalname}" → caminho: "./images/${f.filename}" (ex: <img src="./images/${f.filename}" alt="${f.originalname.replace(/\.[^.]+$/, '')}">)`).join('\n')}\nNUNCA utilize links absolutos apontando para back.sitexpres.com.br nem links externos para esses arquivos!]`
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

          if (!primeiraVez) {
            logStep(jobId, '🤖 Classificando intenção (modificação vs pergunta)...');
            try {
               const intentResp = await anthropic.messages.create({
                 model: "claude-haiku-4-5-20251001",
                 max_tokens: 300,
                 system: "Você é um avaliador de intenção. Avalie se o usuário quer modificar o site (ex: adicione, mude cor, crie botão, apague, remova, etc) ou se está apenas fazendo uma pergunta ou batendo papo (ex: quantas imagens tem?, qual a cor atual?, por que fez isso?). Se for APENAS pergunta/bate-papo, responda EXATAMENTE com [PERGUNTA] seguido da resposta amigável (sempre comece a resposta com um emoji). Se for qualquer tipo de modificação, responda EXATAMENTE com [MODIFICACAO].",
                 messages: [
                   ...chatHistory, 
                   { 
                     role: "user", 
                     content: `[CÓDIGO ATUAL DO SITE PARA REFERÊNCIA]\n\`\`\`html\n${baseHTML ? baseHTML.substring(0, 30000) : "Nenhum código ainda"}\n\`\`\`\n\nO usuário diz: ${prompt}` 
                   }
                 ]
               });
               const intentText = intentResp.content[0].text.trim();
               if (intentText.startsWith("[PERGUNTA]")) {
                 isQuestionOnly = true;
                 questionAnswer = intentText.replace("[PERGUNTA]", "").trim();
                 logStep(jobId, '✅ Intenção: PERGUNTA. Resposta gerada.');
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
             const novoId = existing.rows[0].id;
             try {
               await client.query(
                 `INSERT INTO site_prompts (user_id, id_projeto, prompt, id_site_gererate, status, assistant_message)
                  VALUES ($1, $2, $3, $4, $5, $6)`,
                 [userId, id_projeto, prompt, novoId, 'ativo', questionAnswer]
               );
             } catch (e) {
               console.error("Erro ao inserir site_prompts para pergunta:", e);
             }
             client.release();
             client = null;
             
             jobs[jobId].progress = 100;
             jobs[jobId] = { status: "done", result: { html_content: existing.rows[0].html_content, assistant_message: questionAnswer }, error: null };
             logStep(jobId, `🎉 Job concluído (Apenas Resposta)`);
             return;
          }

          logStep(jobId, '🔓 Conexão com BD liberada — iniciando chamada à IA...');

          // ─── FASE 2: chamada à IA (sem conexão BD aberta) ───────────────────
          let html, distPath, tmpDirPath, hasError;
          const isTestMode = finalPrompt.includes("[teste]");

          if (isTestMode) {
            logStep(jobId, '🤖 [MODO TESTE] Pulando IA (Claude)... gerando mock');
            html = desatrelarHtmlSitexpress("<html><head><title>Site Teste</title><style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0; } h1 { color: #333; }</style></head><body><h1>Site Gerado com Sucesso (Modo Teste)</h1></body></html>");
            distPath = null;
            tmpDirPath = null;
            hasError = false;
            jobs[jobId].progress = 100;
          } else {
            const nomeModeloIa = baseHTML ? 'Claude Haiku' : 'Claude Sonnet 5.5';
            logStep(jobId, `🤖 Enviando prompt para a IA (${nomeModeloIa})... aguarde`);
          const tIA = Date.now();
          const geracaoResult = await gerar_site(
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
          if (primeiraVez) {
            logStep(jobId, '🔤 Gerando nome do subdomínio via IA...');
            const tSub = Date.now();
            nomeSubdominio = await gerarNomeSubdominio(prompt);
            logStep(jobId, `✅ Subdomínio gerado (${Date.now() - tSub}ms): ${nomeSubdominio}`);

            logStep(jobId, `🌐 Criando subdomínio no DirectAdmin: ${nomeSubdominio}.sitexpres.com.br`);
            const tDA = Date.now();
            try { await criarSubdominioDirectAdmin(nomeSubdominio, "sitexpres.com.br"); } catch (e) { console.error("Erro DA:", e.message); }
            logStep(jobId, `✅ Subdomínio criado no DirectAdmin (${Date.now() - tDA}ms)`);
          } else {
            logStep(jobId, `ℹ️  Subdomínio existente recuperado: ${nomeSubdominio}`);
          }

          // ─── FASE 3: nova conexão para salvar tudo no BD ────────────────────
          logStep(jobId, '🔗 Reconectando ao BD para salvar resultados...');
          client = await pool.connect();

          logStep(jobId, '💾 Salvando HTML no banco de dados...');
          const tDB = Date.now();

          if (primeiraVez) {
            const siteUrl = `https://${nomeSubdominio}.sitexpres.com.br`;
            await client.query(
              `INSERT INTO sites 
              (user_id, site_name, site_url, credits_used, status, metadata, id_projeto)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                userId,
                `Site de ${nomeSubdominio}`,
                siteUrl,
                10,
                'active',
                JSON.stringify({ id_projeto, subdominio: nomeSubdominio, created_by: 'ai_generation' }),
                id_projeto
              ]
            );
            logStep(jobId, `✅ Site inserido na tabela 'sites'`);
          }

          await client.query(
            `UPDATE generated_sites SET status = 'inativo' WHERE id_projeto = $1`,
            [id_projeto]
          );
          await client.query(
            `UPDATE site_prompts SET status = 'inativo' WHERE id_projeto = $1`,
            [id_projeto]
          );

          const previewHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #ffffff; }
    iframe { width: 100%; height: 100%; border: none; }
    #react-source { display: none; }
  </style>
</head>
<body>
  <script type="sitexpres/react" id="react-source"><!-- SITEXPRES_REACT_START -->
${html}
<!-- SITEXPRES_REACT_END --></script>
  <iframe src="https://${nomeSubdominio}.sitexpres.com.br?v=${Date.now()}" title="Preview"></iframe>
</body>
</html>`;

          const insertSite = await client.query(
            `INSERT INTO generated_sites 
           (user_id, name, prompt, html_content, id_projeto, image_path, subdominio, status, js_content)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, name, prompt, html_content, created_at`,
            [userId, `Site de ${nomeSubdominio}`, prompt, previewHtml, id_projeto, relativeImageURL || (existing.rows[0]?.image_path ? desatrelarHtmlSitexpress(existing.rows[0].image_path) : null), nomeSubdominio, 'ativo', html]
          );

          const novoId = insertSite.rows[0].id;

            // Gera a mensagem inteligente com Haiku
            let assistantMessage = "";
            try {
              if (primeiraVez) {
                 assistantMessage = "🎉 Uau! Seu site foi gerado e publicado com sucesso!";
              } else {
                 const aiResp = await anthropic.messages.create({
                   model: "claude-haiku-4-5-20251001",
                   max_tokens: 250,
                   system: "Você é o assistente virtual da Sitexpres, amigável e proativo. Se o usuário pediu uma alteração, informe o que você acabou de alterar no site dele com base no pedido recebido (ex: rodapé, cabeçalho, textos) de forma clara, usando entre 20 a 40 palavras, e convide-o a conferir o resultado. Se o usuário fizer uma pergunta, responda de forma natural com base no contexto do chat. (Mesmo que não saiba detalhes muito técnicos do código gerado, dê uma resposta coerente e prestativa). Sempre comece com um emoji.",
                   messages: [
                     ...chatHistory, 
                     { 
                       role: "user", 
                       content: `[CÓDIGO NOVO GERADO PARA O SITE]\n\`\`\`html\n${html ? html.substring(0, 30000) : "Nenhum código"}\n\`\`\`\n\nO usuário pediu: ${prompt}` 
                     }
                   ]
                 });
                 assistantMessage = aiResp.content[0].text;
              }
            } catch (err) {
              console.error("Erro ao gerar mensagem com Haiku", err);
            }

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
                pool.query(`ALTER TABLE public.site_prompts ADD COLUMN IF NOT EXISTS assistant_message TEXT;`).catch(() => {});
              } else {
                throw promptErr;
              }
            }
          logStep(jobId, `✅ HTML salvo no banco (${Date.now() - tDB}ms) | id gerado: ${novoId}`);

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

          if (existe_hospedagem.rows.length > 0) {
            try {
              const username          = existe_hospedagem.rows[0].username;
              const password          = existe_hospedagem.rows[0].senha;
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

          const totalMs = Date.now() - jobStartTime;
          logStep(jobId, `🎉 Job concluído com SUCESSO em ${(totalMs / 1000).toFixed(1)}s`);
          jobs[jobId] = { status: "done", result: { ...insertSite.rows[0], assistant_message: assistantMessage }, error: null };

        } catch (error) {
          const totalMs = Date.now() - jobStartTime;
          console.error(`[${new Date().toISOString()}] [JOB:${jobId}] ❌ ERRO após ${(totalMs / 1000).toFixed(1)}s:`, error.message);
          console.error(error);
          jobs[jobId] = { status: "error", result: null, error: error.message };
        } finally {
          if (client) {
            try { client.release(); } catch (ignored) {}
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
      `SELECT DISTINCT ON (id_projeto)
            id,
            name,
            prompt,
            views,
            created_at,
            html_content,
            subdominio,
            id_projeto
        FROM generated_sites
        WHERE user_id = $1
        AND status = $2
        ORDER BY id_projeto, created_at DESC`,
      [req.userId, 'ativo']
    );

    res.json({ success: true, sites: result.rows });
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

    const result = await client.query(
      "SELECT subdominio FROM generated_sites WHERE id_projeto = $1 LIMIT 1",
      [id_projeto]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subdomínio não encontrado." });
    }

    const { subdominio } = result.rows[0];

    // Retorna também a URL completa, se quiser
    return res.json({
      subdominio,
      url: `https://${subdominio}.sitexpres.com.br`,
    });
  } catch (error) {
    console.error("Erro ao buscar subdomínio:", error);
    return res.status(500).json({ error: "Erro interno ao buscar subdomínio." });
  } finally {
    if (client) client.release(); // 🔥 importante para evitar vazamento de conexão
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
          await execPromise('npm install --include=dev --no-audit', { cwd: tmpDirPath });
        }
        await execPromise('chmod -R +x node_modules/.bin || true', { cwd: tmpDirPath }).catch(() => {});
        
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


