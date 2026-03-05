import pool from "../config/db.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import ftp from "basic-ftp";
import { criarSubdominioDirectAdmin, enviarHTMLSubdominio, subdominioExiste, deletarSubdominioDirectAdmin } from "./integracao_directadmin.js";
import dotenv from "dotenv";
dotenv.config();
import { updateGitHubIfIntegrated } from "./updateGitHubOnSiteChange.js";
import { uso_creditos, verificar_creditos_prompt } from "./creditosController.js";
import { consultaPlano } from "./planoController.js";
import { gerar_site } from "./gerar_siteController.js";
// ⚠️ REMOVIDO: import { console, url } from "inspector" — esse import sobrescrevia o console global e suprimia os logs no terminal!

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const USE_GEMINI = false;

//
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 20000;

// Função para gerar cada parte do site
// Função para limpar blocos de markdown ou tags extras
function limparRetorno(codigo) {
  // Remove ```html, ```css, ```js e ```
  codigo = codigo.replace(/```(?:html|css|js)?\n?/gi, "");
  codigo = codigo.replace(/```/g, "");
  return codigo.trim();
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
      `SELECT id, name, html_content FROM generated_sites 
           WHERE id_projeto = $1 and status = 'ativo'
           ORDER BY created_at DESC LIMIT 1`,
      [id_projeto]
    );
    const baseHTML = dadosSite.rows.length > 0 ? dadosSite.rows[0].html_content : "";
    logStep(null, `✅ Dados do site carregados (${Date.now() - t0}ms) | site existente: ${dadosSite.rows.length > 0}`);

    logStep(null, '🔍 Verificando créditos do usuário...');
    const t1 = Date.now();
    const verificar_creditos_prompt_result = await verificar_creditos_prompt(userId, prompt, baseHTML);
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

      // Se tiver imagem faz upload
      const imageFile = req.file ? `/uploads/images/${req.file.filename}` : null;
      const baseURL = "https://back.sitexpres.com.br/uploads/logos/";
      const imageURL = req.file ? `${baseURL}${req.file.filename}` : null;

      // Cria job assincrono para monitorar o progresso
      const jobId = uuidv4();
      jobs[jobId] = { status: "processing", progress: 0, result: null, error: null };
      logStep(jobId, `🚀 Job criado e iniciado`);
      res.json({ success: true, jobId });


      // Inicia job assincrono para gerar o site
      (async () => {
        let client;
        const jobStartTime = Date.now();

        try {
          logStep(jobId, '🔗 Conectando ao banco de dados...');
          client = await pool.connect();
          logStep(jobId, `✅ Conexão com BD estabelecida (${Date.now() - jobStartTime}ms)`);

          // Verifica se já existe site gerado
          logStep(jobId, '🔍 Verificando se site já existe...');
          const t3 = Date.now();
          const existing = await client.query(
            `SELECT id, name, html_content FROM generated_sites 
           WHERE id_projeto = $1 and status = 'ativo'
           ORDER BY created_at DESC LIMIT 1`,
            [id_projeto]
          );
          logStep(jobId, `✅ Consulta BD concluída (${Date.now() - t3}ms) | site existente: ${existing.rows.length > 0}`);

          //qtd sites do cliente
          const qtde_sites = await client.query(
            `SELECT * FROM public.sites   where  user_id =$1`,
            [userId]
          );

          //=============================
          //Validação dos limites free  1 site 
          //=============================
          if (typedo_plano === 'free') {
            const qtde_sites_projeto = existing.rows.length;
            const qtde_sites_cliente = qtde_sites.rows.length;

            if (qtde_sites_projeto == 0 && qtde_sites_cliente >= 1) {
              logStep(jobId, '❌ Limite de sites free atingido — job encerrado');
              jobs[jobId] = {
                status: "error",
                result: null,
                error: "Limite de sites atingido"
              };
              return; // Não envia resposta novamente!
            }
          }

          // Verifica se é a primeira vez
          const primeiraVez = existing.rows.length === 0;
          const baseHTML = primeiraVez ? "" : existing.rows[0].html_content;
          logStep(jobId, `ℹ️  Modo: ${primeiraVez ? 'CRIAÇÃO (primeira vez)' : 'EDIÇÃO (site existente)'}`);

          // Monta prompt final
          const fullPrompt = imageURL
            ? `${prompt}\nUse esta URL da imagem no site: ${imageURL}`
            : prompt;

          // Caso já exista HTML salvo, peça para alterar
          const finalPrompt = primeiraVez
            ? fullPrompt
            : `HTML atual:\n${baseHTML}\nFaça as alterações solicitadas: ${fullPrompt}`;

          // =============================
          // Gera HTML pela API Claude
          // =============================
          logStep(jobId, '🤖 Enviando prompt para a IA (Claude Haiku)... aguarde');
          const tIA = Date.now();
          const html = await gerar_site(
            finalPrompt,
            "HTML",
            req,
            id_projeto,
            baseHTML,
            userId,
            primeiraVez,
            (percent) => {
              jobs[jobId].progress = percent;
            }
          );
          logStep(jobId, `✅ HTML gerado pela IA (${((Date.now() - tIA) / 1000).toFixed(1)}s) | tamanho: ${html?.length ?? 0} chars`);



          // Gera nome do subdomínio via IA
          let nomeSubdominio;
          if (primeiraVez) {
            logStep(jobId, '🔤 Gerando nome do subdomínio via IA...');
            const tSub = Date.now();
            nomeSubdominio = await gerarNomeSubdominio(prompt);
            logStep(jobId, `✅ Subdomínio gerado (${Date.now() - tSub}ms): ${nomeSubdominio}`);

            // Cria subdomínio no DirectAdmin
            logStep(jobId, `🌐 Criando subdomínio no DirectAdmin: ${nomeSubdominio}.sitexpres.com.br`);
            const tDA = Date.now();
            await criarSubdominioDirectAdmin(nomeSubdominio, "sitexpres.com.br");
            logStep(jobId, `✅ Subdomínio criado no DirectAdmin (${Date.now() - tDA}ms)`);

            const siteUrl = `https://${nomeSubdominio}.sitexpres.com.br`;
            const siteName = `Site de ${nomeSubdominio}`;

            await client.query(
              `INSERT INTO sites 
              (user_id, site_name, site_url, credits_used, status, metadata,id_projeto)
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                userId,
                siteName,
                siteUrl,
                10,
                'active',
                JSON.stringify({
                  id_projeto: id_projeto,
                  subdominio: nomeSubdominio,
                  created_by: 'ai_generation'
                }),
                id_projeto
              ]
            );
            logStep(jobId, `✅ Site inserido na tabela 'sites'`);

          } else {
            nomeSubdominio = existing.rows[0].name.replace("Site de ", "").toLowerCase();
            logStep(jobId, `ℹ️  Subdomínio existente recuperado: ${nomeSubdominio}`);
          }

          // Marca todos os registros existentes como inativos
          logStep(jobId, '💾 Salvando HTML no banco de dados...');
          const tDB = Date.now();
          await client.query(
            `UPDATE generated_sites 
            SET status = 'inativo'
            WHERE id_projeto = $1`,
            [id_projeto]
          );

          await client.query(
            `UPDATE site_prompts 
        SET status = 'inativo'
        WHERE id_projeto = $1`,
            [id_projeto]
          );

          // Insere registro no banco
          const insertSite = await client.query(
            `INSERT INTO generated_sites 
           (user_id, name, prompt, html_content, id_projeto, image_path,subdominio,status)
           VALUES ($1, $2, $3, $4, $5, $6 ,$7, $8)
           RETURNING id, name, prompt, html_content, created_at`,
            [userId, `Site de ${nomeSubdominio}`, prompt, html, id_projeto, imageURL, nomeSubdominio, 'ativo']
          );

          const novoId = insertSite.rows[0].id;

          await client.query(
            `INSERT INTO site_prompts (user_id, id_projeto, prompt,id_site_gererate,status)
           VALUES ($1, $2, $3, $4, $5)`,
            [userId, id_projeto, prompt, novoId, 'ativo']
          );
          logStep(jobId, `✅ HTML salvo no banco (${Date.now() - tDB}ms) | id gerado: ${novoId}`);

          const existe_hospedagem = await client.query(
            `SELECT * FROM hospedagens where id_projeto = $1`,
            [id_projeto]
          );

          logStep(jobId, `📤 Enviando HTML via FTP para DirectAdmin... (hospedagem customizada: ${existe_hospedagem.rows.length > 0})`);
          const tFTP = Date.now();

          if (existe_hospedagem.rows.length > 0) {
            var username = existe_hospedagem.rows[0].username;
            var password = existe_hospedagem.rows[0].senha;
            var dominio_hospedagem = existe_hospedagem.rows[0].dominio;

            await enviarHTMLSubdominio(
              "ftp.sitexpres.com.br",
              username,
              password,
              dominio_hospedagem,
              html
            );
          } else {
            await enviarHTMLSubdominio(
              "ftp.sitexpres.com.br",
              process.env.user_directamin,
              process.env.pass_directamin,
              nomeSubdominio + '.sitexpres.com.br',
              html
            );
          }
          logStep(jobId, `✅ HTML enviado via FTP (${Date.now() - tFTP}ms)`);

          // Update no github caso integrado
          logStep(jobId, '🐙 Verificando integração com GitHub...');
          const githubResult = await updateGitHubIfIntegrated(
            userId,
            id_projeto,
            html,
            "Atualização do site via SiteXpress"
          );

          if (githubResult.updated) {
            logStep(jobId, `✅ GitHub atualizado: ${githubResult.repoUrl}`);
          } else {
            logStep(jobId, 'ℹ️  GitHub não integrado — ignorando atualização');
          }

          const totalMs = Date.now() - jobStartTime;
          logStep(jobId, `🎉 Job concluído com SUCESSO em ${(totalMs / 1000).toFixed(1)}s`);
          jobs[jobId] = { status: "done", result: insertSite.rows[0], error: null };

        } catch (error) {
          const totalMs = Date.now() - jobStartTime;
          console.error(`[${new Date().toISOString()}] [JOB:${jobId}] ❌ ERRO após ${(totalMs / 1000).toFixed(1)}s:`, error.message);
          console.error(error);
          jobs[jobId] = { status: "error", result: null, error: error.message };
        } finally {
          if (client) {
            try {
              client.release();
            } catch (ignored) {
              // ignore
            }
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

export const getPromts = async (req, res) => {
  let client;

  try {
    client = await pool.connect();

    const { id_projeto } = req.params;

    const result = await pool.query(
      `SELECT id, id_projeto, prompt, created_at,id_site_gererate,status
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
      `SELECT html_content 
       FROM public.generated_sites
       WHERE id_projeto = $1 
       AND status = 'ativo'`,
      [id_projeto]
    );

    const html_new = resultado.rows[0]?.html_content || "<h5>Nenhum HTML encontrado</h5><br>erro:@$231";

    //##########
    //Fazendo Updade na hospedagem ou subdomínio



    const dados_sites = await pool.query(
      `SELECT site_url FROM public.sites
   WHERE id_projeto = $1`,
      [id_projeto]
    );

    let site_url = dados_sites.rows[0]?.site_url;

    let subdominio = "";

    if (site_url) {
      const url = new URL(site_url);
      subdominio = url.host; // retorna apenas taskmark.sitexpres.com.br
    }

    console.log("Subdomínio ==> " + subdominio);

    await enviarHTMLSubdominio(
      "ftp.sitexpres.com.br",
      process.env.user_directamin,
      process.env.pass_directamin,
      subdominio,
      html_new
    );

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


