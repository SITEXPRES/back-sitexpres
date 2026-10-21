import pool from "../config/db.js";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
import * as cheerio from "cheerio";
import { uso_creditos } from "./creditosController.js";
import { parseEditBlocks, applyEditBlocks } from "../services/editBlocks.js";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);
import { isFinancialError, gerarHtmlErroCliente, CODIGO_ERRO_FINANCEIRO, MENSAGEM_CLIENTE_FINANCEIRO } from "../utils/errorHandler.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Baseline de tokens para cálculo de progresso
const MAX_TOKENS = 64000;

function limparRetorno(codigo) {
  // Remove blocos de markdown com qualquer linguagem (jsx, js, tsx, html, javascript, etc.)
  codigo = codigo.replace(/```(?:javascript|jsx|js|tsx|ts|html|css)?\n?/gi, "");
  codigo = codigo.replace(/```/g, "");
  // Remove "javascript" solto no início caso a IA retorne sem backticks
  codigo = codigo.replace(/^javascript\s*\n?/i, "");
  return codigo.trim();
}

/**
 * Validador e auto-corretor de integridade de rotas.
 * Evita ReferenceError fatal em runtime (ex: RevendaCpanelPageLegacy vs RevendaCpanelPage).
 */
function validarIntegridadeRotas(codigo) {
  if (!codigo || typeof codigo !== "string") return codigo;

  const routesMatch = codigo.match(/const\s+routes\s*=\s*\{([\s\S]*?)\};/);
  if (!routesMatch) return codigo;

  const routesBody = routesMatch[1];
  const routeEntries = [...routesBody.matchAll(/['"]([^'"]+)['"]\s*:\s*([A-Za-z0-9_]+)/g)];

  let codigoCorrigido = codigo;

  for (const [, routePath, componentName] of routeEntries) {
    if (!componentName) continue;

    // Verifica se componentName está declarado como function ou const/let/var
    const isDeclared = new RegExp(`(?:function|const|let|var)\\s+${componentName}\\b`).test(codigoCorrigido);

    if (!isDeclared) {
      console.warn(`[VALIDAR_ROTAS] ⚠️ Componente '${componentName}' na rota '${routePath}' não está explicitamente declarado! Buscando variações...`);

      // Procura se a IA declarou com sufixo (ex: RevendaCpanelPageLegacy, RevendaCpanelPageOld)
      const variationRegex = new RegExp(`function\\s+(${componentName}[A-Za-z0-9_]+)\\s*\\(`, "g");
      const variationMatch = variationRegex.exec(codigoCorrigido);

      if (variationMatch) {
        const foundName = variationMatch[1];
        console.log(`[VALIDAR_ROTAS] 🔧 Auto-corrigindo declaração de '${foundName}' para '${componentName}'!`);
        codigoCorrigido = codigoCorrigido.replace(
          new RegExp(`function\\s+${foundName}\\s*\\(`, "g"),
          `function ${componentName}(`
        );
      } else {
        console.warn(`[VALIDAR_ROTAS] 🚨 Criando alias/fallback seguro para '${componentName}' para evitar tela branca!`);
        codigoCorrigido = `\nconst ${componentName} = () => <div className="min-h-[60vh] flex items-center justify-center text-white/70">Página em carregamento...</div>;\n` + codigoCorrigido;
      }
    }
  }

  return codigoCorrigido;
}

/**
 * Validador de integridade sintática e completude de código React gerado.
 * Impede que códigos truncados pelo limite de tokens da IA (chaves desbalanceadas,
 * strings abertas, export cortado) cheguem ao build e corrompam o site do cliente.
 */
function isCodeComplete(codigo) {
  if (!codigo || typeof codigo !== "string") return false;
  const trimmed = codigo.trim();
  if (trimmed.length < 150) return false;

  // 1. Deve conter export default function App ou export default App
  if (!/(?:export\s+default\s+function\s+App|function\s+App\b[\s\S]*export\s+default\s+App)/.test(trimmed)) {
    console.warn("[INTEGRIDADE] 🚨 Código não possui export default function App!");
    return false;
  }

  // 2. Deve terminar com fechamento de bloco ou função (ex: '}', '};')
  if (!/\}[\s;]*$/.test(trimmed)) {
    console.warn("[INTEGRIDADE] 🚨 Código não termina com caractere de fechamento '}'!");
    return false;
  }

  // 3. Verifica balanceamento de chaves e se há strings cortadas no fim
  let braces = 0;
  let inString = false;
  let quoteChar = "";
  let inComment = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const next = trimmed[i + 1];

    if (inComment) {
      if (inComment === "line" && char === "\n") inComment = false;
      else if (inComment === "block" && char === "*" && next === "/") {
        inComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (char === "\\") {
        i++; // escapa próximo caractere
        continue;
      }
      if (char === quoteChar) {
        inString = false;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      inComment = "line";
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      inComment = "block";
      i++;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      quoteChar = char;
      continue;
    }

    if (char === "{") braces++;
    else if (char === "}") braces--;
  }

  if (inString) {
    console.warn(`[INTEGRIDADE] 🚨 String não fechada (quote '${quoteChar}') no final do arquivo! Código truncado.`);
    return false;
  }

  if (braces !== 0) {
    console.warn(`[INTEGRIDADE] 🚨 Chaves desbalanceadas (saldo: ${braces}). Código truncado.`);
    return false;
  }

  return true;
}

/**
 * Se o prompt do usuário contiver links externos (ex: https://cloudx.com.br/...),
 * faz scraping em tempo real para obter os dados reais (títulos, planos, preços, recursos)
 * e injeta como contexto para que a IA não alucine.
 */
async function enriquecerComUrlsExternas(promptTexto) {
  if (!promptTexto || typeof promptTexto !== "string") return promptTexto;

  const urlRegex = /https?:\/\/[^\s"'>)]+/gi;
  const urls = [...new Set(promptTexto.match(urlRegex) || [])];

  const urlsValidas = urls.filter((u) => {
    const uLow = u.toLowerCase();
    return !uLow.includes("sitexpres") &&
           !uLow.includes("localhost") &&
           !uLow.includes("github") &&
           !uLow.includes("unsplash") &&
           !uLow.includes("picsum");
  });

  if (urlsValidas.length === 0) return promptTexto;

  console.log(`[SCRAPER_PROMPT] 🌐 Encontrada(s) ${urlsValidas.length} URL(s) externa(s) no prompt: ${urlsValidas.join(", ")}`);

  let contextoUrls = "\n\n=========================================================\n" +
                     "🌐 CONTEÚDO EXTRAÍDO EM TEMPO REAL DAS URLS CITADAS NO PEDIDO:\n" +
                     "=========================================================\n";

  for (const url of urlsValidas.slice(0, 2)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) continue;

      const html = await resp.text();
      const $ = cheerio.load(html);

      $("script, style, noscript, svg, iframe, nav, footer, header").remove();

      const pageTitle = $("title").text().trim();
      const metaDesc = $('meta[name="description"]').attr("content") || "";

      const signupLinks = [];
      $('a[href*="assinatura"], a[href*="painel"], a[href*="cart"]').each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim();
        if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
          signupLinks.push(`${text ? text + ": " : ""}${href}`);
        }
      });

      let mainText = $("body").text().replace(/\s+/g, " ").trim();
      if (mainText.length > 3500) {
        mainText = mainText.slice(0, 3500) + "... [conteúdo truncado para economia de tokens]";
      }

      contextoUrls += `\n--- DADOS REAIS DE: ${url} ---\n`;
      if (pageTitle) contextoUrls += `Título da Página: ${pageTitle}\n`;
      if (metaDesc) contextoUrls += `Descrição: ${metaDesc}\n`;
      if (signupLinks.length > 0) {
        contextoUrls += `Links de contratação oficiais encontrados:\n${[...new Set(signupLinks)].slice(0, 6).join("\n")}\n`;
      }
      contextoUrls += `Conteúdo textual principal:\n${mainText}\n-------------------------\n`;

      console.log(`[SCRAPER_PROMPT] ✅ Conteúdo extraído com sucesso de ${url} (${mainText.length} chars)`);
    } catch (err) {
      console.warn(`[SCRAPER_PROMPT] ⚠️ Falha ao raspar URL ${url}:`, err.message);
    }
  }

  contextoUrls += "\nINSTRUÇÃO CRÍTICA: UTILIZE ESTRITAMENTE AS INFORMAÇÕES REAIS ACIMA (planos, nomes, preços e recursos) para preencher a página solicitada pelo usuário!\n";

  return promptTexto + contextoUrls;
}

/**
 * Analisa o código atual do projeto e o prompt bruto do cliente usando Claude Haiku (rápido e econômico).
 * Identifica páginas, seções e padrões visuais existentes (classes CSS, tamanhos de imagens como max-h-[400px], etc.)
 * e traduz o pedido do cliente em uma especificação técnica precisa antes de enviar ao modelo de edição.
 */
async function enriquecerPromptEdicaoComHaiku(promptOriginal, baseHTML) {
  if (!baseHTML || baseHTML.trim().length === 0 || !promptOriginal || promptOriginal.trim().length === 0) {
    return promptOriginal;
  }

  const pLower = promptOriginal.trim().toLowerCase();
  if (['sim', 'ok', 'beleza', 'pode ser', 'concordo', 'continuar'].includes(pLower)) {
    return promptOriginal;
  }

  try {
    const t0 = Date.now();
    console.log(`[${new Date().toISOString()}] [ENRIQUECER_PROMPT] 🧠 Analisando contexto do projeto com Claude Haiku...`);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      temperature: 0.1,
      system: `Você é um Arquiteto Frontend Sênior e Especialista em Engenharia de Prompt do SiteXpress.
Sua missão é analisar o código React (App.jsx) atual do site e o pedido (prompt) do cliente para traduzi-lo em uma especificação técnica PRECISA e detalhada para o modelo de edição.

DIRETRIZES DE ANÁLISE:
1. PÁGINAS E NAVEGAÇÃO:
   - Se o cliente citar uma rota ou página (ex: "/cpanel", "sobre", "contato", "painel"), identifique o componente ou bloco exato correspondente no código.
   - Oriente a edição a ocorrer estritamente nessa página/rota sem afetar as demais.

2. PADRÕES DE IMAGENS E MÍDIAS (MUITO CRÍTICO):
   - Se o usuário pedir para adicionar, trocar ou ajustar imagens (ou se houver instruções de imagens anexadas):
     a) Inspecione as imagens vizinhas ou existentes no mesmo componente/seção no código atual.
     b) Extraia as classes CSS de tamanho e proporção exatas (ex: max-h-[400px], h-48 md:h-64, aspect-video, object-cover, w-full, rounded-xl).
     c) Se o usuário disser "mantenha o padrão de tamanho", "mesmo tamanho" ou não especificar dimensões, DECLARE EXPLICITAMENTE as classes CSS Tailwind que devem ser aplicadas nas novas tags <img> (ex: "aplique obrigatoriamente: 'w-full max-h-[400px] object-cover rounded-xl' para manter a mesma altura das outras imagens").
     d) Certifique-se de que caminhos de imagens locais usem o padrão absoluto da aplicação (ex: "/images/arquivo.png").

3. DESIGN SYSTEM E COMPONENTES:
   - Identifique cores de destaque, gradientes e classes de botões ou cards do contexto para que o novo elemento se integre perfeitamente.

4. CLONAGEM / DUPLICAÇÃO DE PÁGINAS EXISTENTES (CRÍTICO):
   - Se o cliente pedir para "clonar", "duplicar" ou "criar página X baseada na página Y" (ex: "clonar /hospedagem-directadmin/ criando /revenda-hospedagem-cpanel/"):
     a) Localize o componente da página de origem no código atual (ex: DirectAdminHostingPage ou CpanelHostingPage).
     b) Declare explicitamente que a nova página DEVE COPIAR RIGOROSAMENTE A ESTRUTURA VISUAL E O FLUXO desse componente (mesmo Hero de 2 colunas com card lateral flutuante, mesma barra horizontal de 4 benefícios, mesma seção de planos com toggle Mensal/Anual, mesma galeria e mesma grade interativa de tecnologias).
     c) Mantenha os cards de planos PROPORCIONAIS e CONCISOS (4 specs destacadas no topo com check verde + divisor + 5 a 6 itens comuns com check ciano). NUNCA crie listas gigantescas que desalinhem os cards.
     d) Alerte que o nome da função do componente DEVE ser EXATAMENTE igual ao nome registrado no objeto const routes (sem sufixos como Legacy, Old ou Temp).

5. PRESERVAÇÃO DA INTENÇÃO:
   - Mantenha 100% da intenção do usuário, apenas tornando-a técnica, detalhada e à prova de distorção de layout.

FORMATO DE RESPOSTA:
Retorne APENAS o prompt enriquecido final em texto corrido e direto, sem introdução, sem saudações e sem blocos markdown.`,
      messages: [
        {
          role: "user",
          content: `CÓDIGO ATUAL DO COMPONENTE:\n${baseHTML.slice(0, 45000)}\n\nPEDIDO ORIGINAL DO CLIENTE:\n${promptOriginal}`
        }
      ]
    });

    const enrichedText = response.content?.[0]?.text?.trim();
    if (enrichedText && enrichedText.length > 10) {
      console.log(`[${new Date().toISOString()}] [ENRIQUECER_PROMPT] ✅ Prompt enriquecido com sucesso (${Date.now() - t0}ms):\n"${enrichedText.slice(0, 250)}..."`);
      return enrichedText;
    }
  } catch (err) {
    console.warn(`[${new Date().toISOString()}] [ENRIQUECER_PROMPT] ⚠️ Falha ao enriquecer prompt com Haiku (usando original):`, err.message);
  }

  return promptOriginal;
}

export async function gerar_site(prompt, parte, req, id_projeto, baseHTML = "", userId, primeiraVez, onProgress = null) {
  const inicioGeracao = Date.now();
  const modoLabel = primeiraVez ? 'CRIAÇÃO' : 'EDIÇÃO';
  console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🚀 Iniciando geração de React Vite | modo=${modoLabel} | id_projeto=${id_projeto} | userId=${userId}`);

  const isEditing = baseHTML && baseHTML.trim().length > 0;

  // 🌐 Se o prompt contiver links externos, raspa as páginas em tempo real para alimentar a IA com dados reais
  let promptProcessado = prompt;
  promptProcessado = await enriquecerComUrlsExternas(promptProcessado);

  // 🧠 Pré-processamento e enriquecimento do prompt de edição com Claude Haiku
  if (isEditing) {
    if (onProgress) onProgress(2);
    promptProcessado = await enriquecerPromptEdicaoComHaiku(promptProcessado, baseHTML);
  }

  const systemPromptCriacao = `
Você é um Engenheiro UX SÊNIOR especializado em criar interfaces PREMIUM comparáveis ao Lovable, Webflow e Framer.
Sua missão é gerar o código fonte completo de um componente React (App.jsx) utilizando Tailwind v4, Shadcn UI, Framer Motion e Lucide React.

=========================================================
🔥 CRÍTICO PARA O DESIGN E ANIMAÇÕES (LEIA COM ATENÇÃO)
=========================================================
- DETALHES IMPORTAM: O usuário está exigindo um design RICO, não algo básico!
- BACKGROUNDS: Use gradientes complexos (ex: bg-gradient-to-br from-gray-900 via-black to-red-900), efeitos glassmorphism (backdrop-blur), ou imagens de fundo espetaculares com overlays elegantes.
- ANIMAÇÕES: Use framer-motion para transições fluidas e micro-interações.
- INTERAÇÕES: Botões e cards devem ter efeitos de hover impactantes (hover:scale-105, hover:shadow-2xl, transition-all duration-300).
- CORES PROFUNDAS E MODERNAS: Se for modo escuro, use preto profundo com tons vibrantes de destaque.
- SEJA EXTREMAMENTE DETALHISTA nas sombras, bordas arredondadas e espaçamentos (paddings/margins grandes para respiro). O design final precisa causar EFEITO WOW!

⚠️ RETORNE APENAS O CÓDIGO DO COMPONENTE REACT. Sem explicações, sem markdown, apenas código válido.

REGRAS:
1. Use 'lucide-react' para ícones (ex: import { ChevronRight, Star, Check } from 'lucide-react').
2. Use 'framer-motion' para animações suaves (import { motion } from 'framer-motion').
3. O componente deve ser exportado como 'export default function App() { ... }'.
4. Crie uma interface moderna, clean, com micro-interações, hover states e design premium.
5. ÍCONES: NUNCA importe ícones de redes sociais do 'lucide-react' (ex: Facebook, Instagram, Linkedin, Youtube, Twitter). Eles não estão exportados e causarão erro no build! Se precisar, use SVGs inline ou apenas texto (ex: "Instagram").
6. Imagens e Logos:
   - Se o prompt solicitar imagem ou logo enviado pelo usuário, use estritamente o caminho ABSOLUTO (ex: "/images/arquivo.png"). NUNCA use caminhos relativos (./images/) para imagens, pois isso quebra as rotas internas!
   - Para imagens complementares de alta qualidade, use 'https://source.unsplash.com/...' ou 'https://picsum.photos/...'.
   - NUNCA use domínios como back.sitexpres.com.br!
7. O código deve ser self-contained em um único arquivo (incluindo sub-componentes se necessário).
8. ECONOMIA DE TOKENS EM ARRAYS REPETITIVOS: Para seções gigantes como tabelas de planos de preços, galerias com muitas fotos, mega-menus, listas de dezenas de depoimentos ou parceiros, **escreva apenas 1 ou 2 itens de exemplo no código** e omita o restante usando comentários (ex: "// Restante dos planos originais omitidos para poupar espaço").
9. ROTEAMENTO: Se o usuário pedir para criar uma NOVA PÁGINA, você DEVE gerar o componente para ela E registrá-la no objeto de rotas \`routes\` ao final do arquivo!
10. SEGURANÇA E INTEGRIDADE DA INFRAESTRUTURA:
   - NUNCA inclua scripts de terceiros maliciosos, formulários enganosos de captura de credenciais, miners de criptomoeda ou iframes de phishing.
   - NUNCA crie chamadas ou requisições para portas ou serviços internos administrativos (ex: portas 9001, 2222, srv3br, etc.).

Analise o prompt do usuário e gere a melhor interface possível para o cenário descrito.
`;

  const isLegacyHTML = baseHTML && (baseHTML.toLowerCase().includes('<!doctype html') || baseHTML.toLowerCase().includes('<html'));

  const systemPromptEdicao = isLegacyHTML ? `
Você é um Engenheiro UX SÊNIOR especialista em migrar sites legados para componentes React premium.
Você receberá o código fonte HTML atual do site. 
Sua tarefa é CONVERTER ESSE SITE INTEIRO para um componente React (App.jsx) utilizando Tailwind v4, Shadcn UI, Framer Motion e Lucide React, aplicando também as modificações solicitadas pelo usuário.
O novo componente deve manter o mesmo visual ou melhorá-lo, e deve obrigatoriamente ser exportado como 'export default function App() { ... }'.

⚠️ RETORNE APENAS O CÓDIGO REACT ATUALIZADO (JSX). NUNCA retorne HTML puro (sem <!DOCTYPE html>). Sem explicações, sem markdown.
⚠️ ÍCONES: NUNCA importe ícones de redes sociais do 'lucide-react' (ex: Facebook, Instagram, Linkedin, Youtube, Twitter). Eles NÃO estão exportados e causarão erro de build!
⚠️ ECONOMIA DE TOKENS: Em arrays e mapeamentos repetitivos (planos de hospedagem, tabelas de preços, dezenas de depoimentos, parceiros, perguntas frequentes, etc), caso a alteração do usuário NÃO envolva diretamente esses itens, MANTENHA O CÓDIGO CURTO listando apenas 1 ou 2 exemplos e colocando um comentário \`// [demais itens mantidos]\`.
⚠️ NOVA PÁGINA: Se for criar uma página nova, inclua o componente e obrigatoriamente registre-o nas rotas (routes) no final do código.

CÓDIGO HTML ATUAL:
${baseHTML}

PROMPT DO USUÁRIO (O QUE DEVE SER ALTERADO/MIGRADO):
${promptProcessado}
` : `
Você é um Engenheiro UX SÊNIOR especialista em EDITAR componentes React premium existentes.
Você receberá o código fonte atual do componente (App.jsx). 
Faça APENAS as modificações solicitadas pelo usuário, mantendo todo o resto do design system, animações e lógica intactos.

⚠️ RETORNE APENAS O CÓDIGO REACT ATUALIZADO. Sem explicações, sem markdown, apenas código válido.
⚠️ ÍCONES: NUNCA importe ícones de redes sociais do 'lucide-react' (ex: Facebook, Instagram, Linkedin, Youtube, Twitter). Eles NÃO estão exportados e causarão erro de build!
⚠️ ECONOMIA DE TOKENS: Em arrays e componentes repetitivos (ex: lista de dezenas de planos, faq, depoimentos, galerias gigantes), se a alteração NÃO for no meio deles, retorne o código com apenas 1 item de exemplo e diga \`// restante dos depoimentos originais omitidos para poupar espaço\`.
⚠️ CRIAR PÁGINA: Se o prompt pedir para adicionar nova página, crie o componente da página e REGISTRE OBRIGATORIAMENTE no objeto de rotas \`const routes\` no final do arquivo.

⚠️ PADRÃO DE TAMANHO DE IMAGENS E MÍDIAS (MUITO CRÍTICO):
- Ao inserir ou substituir tags <img>, NUNCA deixe a imagem sem restrição de altura que estique ou quebre o layout (ex: esticar para 700px quando os outros cards ou a página é de ~400px).
- SEMPRE respeite e copie o padrão de classes CSS das imagens vizinhas/existentes no mesmo componente (ex: max-h-[400px], h-48 md:h-64, object-cover, aspect-video, w-full, rounded-xl). Se o usuário pedir para "manter o padrão de tamanho", inspecione as outras imagens do componente e copie EXATAMENTE as mesmas classes de altura, largura e proporção.
- NUNCA use caminhos relativos (./images/) para imagens em subpáginas; use o caminho absoluto com barra (ex: "/images/arquivo.png").

⚠️ PÁGINAS E ROTAS ESPECÍFICAS (ex: /cpanel, /dashboard):
- Se o usuário mencionar uma página ou rota específica (ex: /cpanel), localize o componente responsável por essa rota no App.jsx e aplique a modificação ESTRITAMENTE dentro dele.
- Se a página solicitada ainda não existir, crie o componente da nova página e registre-a obrigatoriamente no objeto de rotas const routes.

⚠️ CLONAGEM / DUPLICAÇÃO DE PÁGINAS (MUITO CRÍTICO):
- Se o usuário pedir para clonar uma página existente (ex: "clone da página /hospedagem-directadmin/ criando /revenda-hospedagem-cpanel/"):
  1. Localize o componente da página original e replique EXATAMENTE sua arquitetura visual e layout (Hero 2 colunas com card lateral flutuante, barra de 4 benefícios horizontais, tabela de planos proporcional com toggle Mensal/Anual, galeria e grade de tecnologias).
  2. Mantenha os cards de planos CONCISOS e na mesma proporção das outras páginas (máximo 4 especificações destacadas no topo com check verde + linha divisória + 5 a 6 itens comuns com check ciano). NUNCA crie listas gigantescas de dezenas de itens que quebrem a proporção da página.
  3. NÃO crie seções desconectadas ou avulsas (como fotos de servidores soltas ou depoimentos duplicados) que não existem na página de origem.
  4. NOMEAÇÃO E ROTAS: O nome da função do componente DEVE ser EXATAMENTE IGUAL ao nome usado no objeto const routes (NUNCA adicione sufixos como Legacy, Old, Temp).

CÓDIGO ATUAL:
${baseHTML}

PROMPT DO USUÁRIO:
${promptProcessado}
`;

  // Modo econômico: a IA devolve só blocos SEARCH/REPLACE (o código vai UMA vez, com cache)
  const systemPromptBlocos = `
Você é um Engenheiro UX SÊNIOR especialista em EDITAR componentes React (App.jsx) existentes.
Faça APENAS as modificações pedidas pelo usuário, mantendo todo o resto intacto.

⚠️ OBRIGATÓRIO: NÃO retorne o arquivo inteiro. Retorne SOMENTE os blocos de edição no formato exato abaixo. Se você não usar o formato, o sistema irá falhar.

<<<<<<< SEARCH
[Copie aqui o trecho exato do código original que deseja alterar, incluindo 2 ou 3 linhas acima e abaixo para contexto]
=======
[Escreva aqui o novo código que irá substituir o trecho acima]
>>>>>>> REPLACE

EXEMPLO DE USO GERAL:
<<<<<<< SEARCH
    <footer className="text-gray-500">
      <p>Copyright 2024</p>
    </footer>
=======
    <footer className="text-gray-500 flex justify-between">
      <p>Copyright 2024</p>
      <a href="/termos-de-uso">Termos de Uso</a>
    </footer>
>>>>>>> REPLACE

EXEMPLO PARA CRIAR OU CLONAR UMA NOVA PÁGINA (ex: clonar uma página existente ou criar uma nova rota):
Para adicionar ou clonar uma página, NÃO reescreva o arquivo nem o componente original!
Basta fazer UM bloco localizando "const routes =" e inserindo a nova função de componente logo antes dele e registrando a nova rota dentro dele:
<<<<<<< SEARCH
const routes = {
  '/': HomePage,
=======
function NovaPaginaComponente() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white">
      {/* Componente da nova página completo aqui */}
    </div>
  );
}

const routes = {
  '/': HomePage,
  '/nova-pagina': NovaPaginaComponente,
>>>>>>> REPLACE

REGRAS CRÍTICAS:
- Pode usar vários blocos, na ordem em que aparecem no arquivo.
- O bloco SEARCH deve existir EXATAMENTE igual no código original (copie e cole). Mantenha o bloco SEARCH curto (3 a 6 linhas) apenas para servir de âncora inequívoca.
- NUNCA use "..." (reticências) para omitir código dentro de um bloco REPLACE.
- NUNCA retorne o código inteiro do componente, APENAS os blocos alterados.
- Se não for necessário mudar uma linha, não mude.
- ÍCONES: NUNCA importe ícones de redes sociais do 'lucide-react' (Facebook, Instagram, Linkedin, Youtube, Twitter).
- PADRÃO DE IMAGENS: Ao alterar ou adicionar <img>, NUNCA deixe com altura descontrolada ou esticada. Mantenha rigorosamente as classes de restrição de altura do layout (ex: max-h-[400px], h-48, object-cover, rounded-xl). Use sempre caminhos absolutos /images/...
- ROTAS/PÁGINAS: Se o usuário pedir alteração em uma página específica (ex: /cpanel), altere apenas o bloco daquela página.
- CLONAGEM DE PÁGINAS: Ao clonar ou duplicar uma página existente, copie fielmente a estrutura das seções (Hero 2 colunas, barra de benefícios, planos com toggle mensal/anual) e mantenha a proporção dos cards com dados curtos (máximo 4 specs + divisor + 5-6 comuns). O nome do componente DEVE bater exatamente com o objeto const routes.

CÓDIGO ATUAL (base para o SEARCH):
${baseHTML}
`;

  const systemPrompt = isEditing ? systemPromptEdicao : systemPromptCriacao;
  const expectedChars = MAX_TOKENS * 4;

  try {
    const MODELO = "claude-sonnet-5-5"; // Criação e fallback de reescrita completa
    const MODELO_EDICAO = "claude-sonnet-5-5"; // Edição por blocos usa Sonnet agora (inteligente o suficiente para não errar a formatação)
    const maxTokens = isEditing ? 64000 : 100000;
    let reactCode = '';
    const tStream = Date.now();
    if (prompt.toLowerCase().includes('[teste]')) {
      console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🧪 MODO TESTE ATIVADO! Pulando API da IA...`);
      reactCode = `
import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="bg-white/80 backdrop-blur-md p-10 rounded-2xl shadow-2xl max-w-lg w-full text-center border border-indigo-100">
        <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">Site React + Vite</h1>
        <p className="text-gray-600 mb-8 leading-relaxed">
          Este site foi compilado com sucesso para a pasta <code className="bg-gray-100 px-2 py-1 rounded text-indigo-600 font-mono text-sm">dist/</code> com CSS e JS otimizados!
        </p>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-105 transition-all duration-200">
          Explorar Recursos
        </button>
      </div>
    </div>
  );
}
`;
      if (onProgress) onProgress(80);
      await uso_creditos(userId, 50, 50, id_projeto);
    } else {
      // Chamada com streaming; o system vai com cache_control (releituras ~90% mais baratas)
      const streamClaude = async (systemText, userContent, maxTok, label, modelo = MODELO) => {
        console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🧠 Chamando Claude API (${label}) | modelo: ${modelo} | max_tokens: ${maxTok}`);
        let stream;
        try {
          stream = await anthropic.messages.stream({
            model: modelo,
            max_tokens: maxTok,
            system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userContent }]
          });
        } catch (apiErr) {
          if (isFinancialError(apiErr)) {
            console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ⚠️ ERRO FINANCEIRO ANTHROPIC (${label}):`, apiErr.message);
            const finErr = new Error(MENSAGEM_CLIENTE_FINANCEIRO);
            finErr.isFinancial = true;
            throw finErr;
          }
          throw apiErr;
        }

        if (onProgress) onProgress(5);
        let out = '';
        let lastReportedPercent = 0;
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta?.text) {
              out += event.delta.text;
              const percent = Math.min(Math.round((out.length / expectedChars) * 75) + 5, 80);
              if (onProgress && percent !== lastReportedPercent) {
                onProgress(percent);
                lastReportedPercent = percent;
              }
            }
          }
        } catch (streamErr) {
          if (isFinancialError(streamErr)) {
            console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ⚠️ ERRO FINANCEIRO DURANTE STREAM (${label}):`, streamErr.message);
            const finErr = new Error(MENSAGEM_CLIENTE_FINANCEIRO);
            finErr.isFinancial = true;
            throw finErr;
          }
          throw streamErr;
        }

        const finalMessage = await stream.finalMessage();
        const u = finalMessage.usage || {};
        const inputTokens = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        const outputTokens = u.output_tokens ?? 0;
        console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 📊 Tokens: input=${u.input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0} output=${outputTokens}`);
        await uso_creditos(userId, inputTokens + outputTokens, inputTokens + outputTokens, id_projeto);
        return out;
      };

      let editadoPorBlocos = false;
      if (isEditing && !isLegacyHTML) {
        try {
          const resp = await streamClaude(systemPromptBlocos, promptProcessado, 16000, 'edição por blocos (Haiku)', MODELO_EDICAO);
          const blocks = parseEditBlocks(resp);
          if (blocks.length > 0) {
            const r = applyEditBlocks(baseHTML, blocks);
            console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🧩 Blocos: ${r.applied} aplicados, ${r.failed} falharam`);
            if (r.failed === 0 && r.applied > 0) {
              reactCode = r.code;
              editadoPorBlocos = true;
            }
          } else if (/export\s+default\s+function\s+App/.test(resp)) {
            // a IA devolveu o arquivo completo; aproveita
            reactCode = resp;
            editadoPorBlocos = true;
          }
        } catch (blkErr) {
          console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ⚠️ Edição por blocos falhou:`, blkErr?.message ?? blkErr);
        }
        if (!editadoPorBlocos) console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🔁 Fallback: reescrita completa do arquivo`);
      }

      if (!editadoPorBlocos) {
        const isArquivoGrande = baseHTML && baseHTML.length > 40000;
        if (isArquivoGrande && isEditing) {
          console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ⚠️ Arquivo grande (${baseHTML.length} chars). Tentando 2ª passagem cirúrgica por blocos para evitar truncamento...`);
          try {
            const retryPrompt = `ATENÇÃO: A tentativa anterior falhou. O arquivo possui mais de ${Math.round(baseHTML.length / 1000)}k caracteres e NÃO PODE ser reescrito por inteiro sem estourar o limite de tokens da IA!
Você DEVE OBRIGATORIAMENTE retornar blocos <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE.
Copie EXATAMENTE 3 a 5 linhas do código original no SEARCH como âncora.
Se estiver criando ou clonando página, procure por "const routes =" e insira a nova função de página antes dele e registre a rota.
Pedido do usuário: ${promptProcessado}`;

            const retryResp = await streamClaude(systemPromptBlocos, retryPrompt, 16000, 'edição cirúrgica retry', MODELO_EDICAO);
            const retryBlocks = parseEditBlocks(retryResp);
            if (retryBlocks.length > 0) {
              const r2 = applyEditBlocks(baseHTML, retryBlocks);
              if (r2.applied > 0 && r2.failed === 0) {
                reactCode = r2.code;
                editadoPorBlocos = true;
                console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ✅ 2ª passagem cirúrgica aplicada com sucesso! (${r2.applied} blocos)`);
              }
            }
          } catch (retryPassErr) {
            console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] Erro na 2ª passagem cirúrgica:`, retryPassErr.message);
          }
        }

        if (!editadoPorBlocos) {
          if (isEditing && baseHTML.length > 60000) {
            console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🛑 Abortando reescrita completa em arquivo gigante (${baseHTML.length} chars) para prevenir tela branca/corte de código!`);
            const errGigante = new Error("Arquivo muito extenso para reescrita completa direta.");
            errGigante.isCodeTruncationRisk = true;
            throw errGigante;
          }

          reactCode = await streamClaude(
            systemPrompt,
            isEditing ? promptProcessado : "Crie o componente React conforme solicitado: " + promptProcessado,
            maxTokens,
            isEditing ? 'edição completa' : 'criação'
          );
        }
      }
    }

    reactCode = limparRetorno(reactCode);
    reactCode = validarIntegridadeRotas(reactCode);

    // Validação de integridade e não-truncamento antes do build
    if (!isCodeComplete(reactCode)) {
      console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🚨 Código React incompleto ou truncado detectado! Abortando build para proteção.`);
      return {
        reactCode: baseHTML || reactCode,
        distPath: null,
        tmpDirPath: null,
        hasError: true,
        buildError: "Código truncado ou incompleto detectado pela validação de integridade.",
        isTruncated: true
      };
    }

    // ===========================================
    // PROCESSO DE BUILD DO VITE
    // ===========================================
    if (onProgress) onProgress(85);
    console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ⚙️ Iniciando processo de build do Vite...`);

    const templatePath = path.resolve(__dirname, "../templates/vite-base");
    const tmpBase = path.resolve(__dirname, "../tmp");
    if (!fsSync.existsSync(tmpBase)) {
      fsSync.mkdirSync(tmpBase, { recursive: true });
    }

    // Garante que o template base possui dependências instaladas (executa apenas na 1ª vez)
    const templateVite = path.join(templatePath, "node_modules", "vite");
    if (!fsSync.existsSync(templateVite)) {
      console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 📦 Instalando dependências no template base...`);
      const lockInTemplate = path.join(templatePath, "package-lock.json");
      if (fsSync.existsSync(lockInTemplate)) {
        await fs.unlink(lockInTemplate).catch(() => {});
      }
      try {
        await execPromise('npm install --no-package-lock --include=dev --no-audit', { cwd: templatePath });
      } catch (tmplErr) {
        console.warn(`[GERAR_SITE_VITE] ⚠️ Aviso ao instalar dependências no template base:`, tmplErr.message);
      }
    }

    const tmpDirName = `projeto_${id_projeto}_${Date.now()}`;
    const tmpDirPath = path.join(tmpBase, tmpDirName);

    // 1. Copiar template para a pasta temporária
    await fs.cp(templatePath, tmpDirPath, { recursive: true });

    // 1.5. Atualizar o title do index.html com o nome do site
    try {
      const siteInfo = await pool.query(`SELECT site_url FROM public.sites WHERE id_projeto = $1`, [id_projeto]);
      if (siteInfo.rows.length > 0 && siteInfo.rows[0].site_url) {
        let siteNome = siteInfo.rows[0].site_url.replace(/^https?:\/\//, '').replace('.sitexpres.com.br', '');
        siteNome = siteNome.charAt(0).toUpperCase() + siteNome.slice(1); // Deixa primeira letra maiúscula
        
        const indexHtmlPath = path.join(tmpDirPath, "index.html");
        if (fsSync.existsSync(indexHtmlPath)) {
          let indexHtmlContent = await fs.readFile(indexHtmlPath, 'utf8');
          // Substitui o title padrão (Vite + React) pelo nome do site
          indexHtmlContent = indexHtmlContent.replace(/<title>.*?<\/title>/i, `<title>${siteNome}</title>`);
          await fs.writeFile(indexHtmlPath, indexHtmlContent, 'utf8');
        }
      }
    } catch (errTitle) {
      console.error("Erro ao injetar title no index.html:", errTitle);
    }

    // 2. Sobrescrever App.jsx com o componente gerado pela IA
    // Força a conversão de caminhos relativos de imagens para absolutos (SPA routing fix)
    reactCode = reactCode.replace(/(["'])\.\/images\//g, '$1/images/');
    await fs.writeFile(path.join(tmpDirPath, "src", "App.jsx"), reactCode, 'utf8');

    // 3. Executar npm install (caso falte) e build
    if (onProgress) onProgress(90);
    try {
      const vitePkg = path.join(tmpDirPath, "node_modules", "vite");
      if (!fsSync.existsSync(vitePkg)) {
        console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 📦 Instalando dependências (Vite)...`);
        const lockPath = path.join(tmpDirPath, "package-lock.json");
        if (fsSync.existsSync(lockPath)) {
          await fs.unlink(lockPath).catch(() => {});
        }
        await execPromise('npm install --no-package-lock --include=dev --no-audit', { cwd: tmpDirPath });
      }
      // Garante permissões em .bin
      await execPromise('chmod -R +x node_modules/.bin || true', { cwd: tmpDirPath }).catch(() => {});

      if (onProgress) onProgress(95);
      // Executa Vite build
      try {
        await execPromise('npx --no-install vite build', { cwd: tmpDirPath });
      } catch (npxErr) {
        await execPromise('npm run build', { cwd: tmpDirPath });
      }
    } catch (buildErr) {
      const errMsg = buildErr.message || '';
      const isMissingExport = errMsg.includes('[MISSING_EXPORT]');

      if (isMissingExport) {
        console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🔧 Auto-corrigindo ícones inválidos do lucide-react...`);

        // Extrai os nomes dos ícones inválidos do erro
        const missingIconMatches = [...errMsg.matchAll(/"([^"]+)" is not exported by "node_modules\/lucide-react/g)];
        const missingIcons = missingIconMatches.map(m => m[1]);
        console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🚫 Ícones inválidos encontrados: ${missingIcons.join(', ')}`);

        let fixedCode = reactCode;

        // 1. Remove os ícones inválidos das linhas de import do lucide-react
        fixedCode = fixedCode.replace(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g, (match, iconList) => {
          const icons = iconList.split(',').map(i => i.trim()).filter(i => !missingIcons.includes(i) && i.length > 0);
          if (icons.length === 0) return '// lucide-react import removido (ícones inválidos)';
          return `import { ${icons.join(', ')} } from 'lucide-react'`;
        });

        // 2. Substitui os usos JSX dos ícones inválidos por um SVG genérico seguro
        for (const icon of missingIcons) {
          const safeReplace = `({className=""}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>`;
          // Adiciona uma declaração da função logo após os imports
          const importEnd = fixedCode.indexOf('\n\n', fixedCode.lastIndexOf('from \'lucide-react\''));
          if (importEnd !== -1) {
            fixedCode = fixedCode.slice(0, importEnd) +
              `\nconst ${icon} = ${safeReplace};` +
              fixedCode.slice(importEnd);
          }
        }

        // 3. Sobrescreve App.jsx corrigido e tenta o build novamente
        await fs.writeFile(path.join(tmpDirPath, 'src', 'App.jsx'), fixedCode, 'utf8');
        console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🔁 Tentando build novamente após auto-correção...`);

        try {
          try {
            await execPromise('npx --no-install vite build', { cwd: tmpDirPath });
          } catch {
            await execPromise('npm run build', { cwd: tmpDirPath });
          }
          const distPath = path.join(tmpDirPath, 'dist');
          console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ✅ Build concluído após auto-correção!`);
          return { reactCode: fixedCode, distPath, tmpDirPath, hasError: false };
        } catch (retryErr) {
          console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ❌ Build falhou mesmo após auto-correção:`, retryErr.message?.slice(0, 300));
        }
      } else {
        console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ❌ Erro no build:`, buildErr);
      }

      // Criar um dist de erro para mostrar no preview (sem vazar stack trace técnico ao cliente)
      const distErrorPath = path.join(tmpDirPath, "dist");
      await fs.mkdir(distErrorPath, { recursive: true });
      const errorHtml = gerarHtmlErroCliente(CODIGO_ERRO_FINANCEIRO);
      await fs.writeFile(path.join(distErrorPath, "index.html"), errorHtml);

      return { reactCode, distPath: distErrorPath, tmpDirPath, hasError: true, buildError: buildErr.message, isFinancial: true };
    }

    const distPath = path.join(tmpDirPath, "dist");
    console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ✅ Build concluído com sucesso em ${distPath}`);

    return { reactCode, distPath, tmpDirPath, hasError: false };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ❌ ERRO GERAL:`, error);
    if (error.isFinancial) {
      throw error;
    }
    return {
      reactCode: baseHTML,
      distPath: null,
      tmpDirPath: null,
      hasError: true,
      buildError: error.message,
      isTruncationRisk: error.isCodeTruncationRisk || false
    };
  }
}
