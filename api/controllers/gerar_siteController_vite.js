import pool from "../config/db.js";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
import { uso_creditos } from "./creditosController.js";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Baseline de tokens para cálculo de progresso
const MAX_TOKENS = 6000;

function limparRetorno(codigo) {
  // Remove blocos de markdown com qualquer linguagem (jsx, js, tsx, html, javascript, etc.)
  codigo = codigo.replace(/```(?:javascript|jsx|js|tsx|ts|html|css)?\n?/gi, "");
  codigo = codigo.replace(/```/g, "");
  // Remove "javascript" solto no início caso a IA retorne sem backticks
  codigo = codigo.replace(/^javascript\s*\n?/i, "");
  return codigo.trim();
}

export async function gerar_site(prompt, parte, req, id_projeto, baseHTML = "", userId, primeiraVez, onProgress = null) {
  const inicioGeracao = Date.now();
  const modoLabel = primeiraVez ? 'CRIAÇÃO' : 'EDIÇÃO';
  console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🚀 Iniciando geração de React Vite | modo=${modoLabel} | id_projeto=${id_projeto} | userId=${userId}`);

  const isEditing = baseHTML && baseHTML.trim().length > 0;

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
5. Imagens e Logos:
   - Se o prompt solicitar imagem ou logo enviado pelo usuário, use estritamente o caminho relativo informado (ex: "./images/arquivo.png").
   - Para imagens complementares de alta qualidade, use 'https://source.unsplash.com/...' ou 'https://picsum.photos/...'.
   - NUNCA use domínios como back.sitexpres.com.br!
6. O código deve ser self-contained em um único arquivo (incluindo sub-componentes se necessário).

Analise o prompt do usuário e gere a melhor interface possível para o cenário descrito.
`;

  const systemPromptEdicao = `
Você é um Engenheiro UX SÊNIOR especialista em EDITAR componentes React premium existentes.
Você receberá o código fonte atual do componente (App.jsx). 
Faça APENAS as modificações solicitadas pelo usuário, mantendo todo o resto do design system, animações e lógica intactos.

⚠️ RETORNE APENAS O CÓDIGO REACT ATUALIZADO. Sem explicações, sem markdown, apenas código válido.

CÓDIGO ATUAL:
${baseHTML}

PROMPT DO USUÁRIO:
${prompt}
`;

  const systemPrompt = isEditing ? systemPromptEdicao : systemPromptCriacao;
  const expectedChars = MAX_TOKENS * 4;

  try {
    const MODELO = isEditing ? "claude-haiku-4-5-20251001" : "claude-sonnet-5-5";
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
      console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🧠 Chamando Claude API (${isEditing ? 'Haiku' : 'Sonnet 5.5'}) | modelo: ${MODELO} | max_tokens: ${maxTokens}`);
      const stream = await anthropic.messages.stream({
        model: MODELO,
        max_tokens: maxTokens,
        system: isEditing ? systemPromptEdicao : systemPromptCriacao,
        messages: [{ role: "user", content: isEditing ? prompt : "Crie o componente React conforme solicitado: " + prompt }]
      });

      if (onProgress) onProgress(5); 
      let chunkCount = 0;
      let lastReportedPercent = 0;

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta?.text) {
          reactCode += event.delta.text;
          chunkCount++;

          const percent = Math.min(Math.round((reactCode.length / expectedChars) * 75) + 5, 80);
          if (onProgress && percent !== lastReportedPercent) {
            onProgress(percent);
            lastReportedPercent = percent;
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      const inputTokens = finalMessage.usage?.input_tokens ?? 0;
      const outputTokens = finalMessage.usage?.output_tokens ?? 0;
      await uso_creditos(userId, inputTokens + outputTokens, inputTokens + outputTokens, id_projeto);
    }

    reactCode = limparRetorno(reactCode);

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

    const tmpDirName = `projeto_${id_projeto}_${Date.now()}`;
    const tmpDirPath = path.join(tmpBase, tmpDirName);

    // 1. Copiar template para a pasta temporária
    await fs.cp(templatePath, tmpDirPath, { recursive: true });

    // 2. Sobrescrever App.jsx com o componente gerado pela IA
    await fs.writeFile(path.join(tmpDirPath, "src", "App.jsx"), reactCode, 'utf8');

    // 3. Executar npm install (caso falte) e build
    if (onProgress) onProgress(90);
    try {
      const vitePkg = path.join(tmpDirPath, "node_modules", "vite");
      if (!fsSync.existsSync(vitePkg)) {
        console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 📦 Instalando dependências (Vite)...`);
        await execPromise('npm install --include=dev --no-audit', { cwd: tmpDirPath });
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
      console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ❌ Erro no build:`, buildErr);

      // Criar um dist de erro para mostrar no preview
      const distErrorPath = path.join(tmpDirPath, "dist");
      await fs.mkdir(distErrorPath, { recursive: true });
      const errorHtml = `<!DOCTYPE html><html><head><title>Erro no Build</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-red-50 p-10"><div class="max-w-3xl mx-auto bg-white p-8 rounded shadow text-red-600"><h1 class="text-2xl font-bold mb-4">Erro ao compilar o projeto</h1><pre class="bg-gray-100 p-4 rounded overflow-auto">${buildErr.message}</pre></div></body></html>`;
      await fs.writeFile(path.join(distErrorPath, "index.html"), errorHtml);

      return { reactCode, distPath: distErrorPath, tmpDirPath, hasError: true, buildError: buildErr.message };
    }

    const distPath = path.join(tmpDirPath, "dist");
    console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ✅ Build concluído com sucesso em ${distPath}`);

    return { reactCode, distPath, tmpDirPath, hasError: false };

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ❌ ERRO GERAL:`, error);
    throw error;
  }
}
