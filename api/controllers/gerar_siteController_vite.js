import pool from "../config/db.js";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { uso_creditos } from "./creditosController.js";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// max_tokens esperado (Sonnet 3.5 pode gerar até 8192, mas usamos ~4000 como baseline para %)
const MAX_TOKENS = 6000;

function limparRetorno(codigo) {
  codigo = codigo.replace(/```(?:jsx|js|tsx|html)?\n?/gi, "");
  codigo = codigo.replace(/```/g, "");
  return codigo.trim();
}

export async function gerar_site(prompt, parte, req, id_projeto, baseHTML = "", userId, primeiraVez, onProgress = null) {
  const inicioGeracao = Date.now();
  const modoLabel = primeiraVez ? 'CRIAÇÃO' : 'EDIÇÃO';
  console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🚀 Iniciando geração de React | modo=${modoLabel} | id_projeto=${id_projeto} | userId=${userId}`);

  const isEditing = baseHTML && baseHTML.trim().length > 0;

  const systemPromptCriacao = `
Você é um Engenheiro UX SÊNIOR especializado em criar interfaces PREMIUM comparáveis ao Lovable, Webflow e Framer.
Sua missão é gerar o código fonte completo de um componente React (App.jsx) utilizando Tailwind v4, Shadcn UI, Framer Motion e Lucide React.


=========================================================
🔥 CRÍTICO PARA O DESIGN E ANIMAÇÕES (LEIA COM ATENÇÃO)
=========================================================
- DETALHES IMPORTAM: O usuário está exigindo um design RICO, não algo básico!
- BACKGROUNDS: Use gradientes complexos (ex: bg-gradient-to-br from-gray-900 via-black to-red-900), efeitos glassmorphism (backdrop-blur), ou imagens de fundo espetaculares com overlays elegantes.
- ANIMAÇÕES: Cada seção DEVE ter 'data-aos' configurado (fade-up, fade-right, zoom-in, etc.). 
- INTERAÇÕES: Botões e cards devem ter efeitos de hover impactantes (hover:scale-105, hover:shadow-2xl, transition-all duration-300).
- CORES PROFUNDAS E MODERNAS: Se for modo escuro, use preto profundo com tons vibrantes de destaque.
- SEJA EXTREMAMENTE DETALHISTA nas sombras, bordas arredondadas e espaçamentos (paddings/margins grandes para respiro). O design final precisa causar EFEITO WOW!

⚠️ RETORNE APENAS O CÓDIGO DO COMPONENTE REACT. Sem explicações, sem markdown, apenas código válido.

REGRAS:
1. Use 'lucide-react' para ícones (ex: import { ChevronRight } from 'lucide-react').
2. Use 'framer-motion' para animações suaves (import { motion } from 'framer-motion').
3. O componente deve ser exportado como 'export default function App() { ... }'.
4. Crie uma interface moderna, clean, com micro-interações, hover states e design premium.
5. Se precisar de imagens, use 'https://source.unsplash.com/...' ou 'https://picsum.photos/...'.
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
    const MODELO = isEditing ? "claude-sonnet-5" : "claude-opus-5-5";
    let reactCode = '';
    const tStream = Date.now();
    if (prompt.toLowerCase().includes('[teste]')) {
      console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🧪 MODO TESTE ATIVADO! Pulando API da IA...`);
      reactCode = `
import React from 'react';
export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-4">Site de Teste</h1>
        <p className="text-gray-600 mb-6">Este é um site gerado instantaneamente pelo modo [teste], sem gastar créditos da IA!</p>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
          Botão Bonito
        </button>
      </div>
    </div>
  );
}
`;
      if (onProgress) onProgress(80);
      
      // Simula uso de créditos fake para não quebrar validações
      await uso_creditos(userId, 100, 100, id_projeto);
    } else {
      console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] 🧠 Chamando Claude API (Sonnet)`);
      const stream = await anthropic.messages.stream({
        model: MODELO,
        max_tokens: 100000,
        system: isEditing ? systemPromptEdicao : systemPromptCriacao,
        messages: [{ role: "user", content: isEditing ? prompt : "Crie a landing page descrita no prompt: " + prompt }]
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
    // PROCESSO DE BUILD
    // ===========================================
    if (onProgress) onProgress(85); // Iniciando build
    console.log(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ⚙️ Iniciando processo de build do Vite...`);
    
    const tmpDirName = `projeto_${id_projeto}_${Date.now()}`;
    const tmpDirPath = path.join(process.cwd(), "tmp", tmpDirName);
    const templatePath = path.join(process.cwd(), "templates", "vite-base");

    // 1. Copiar template
    await fs.cp(templatePath, tmpDirPath, { recursive: true });

    // 2. Sobrescrever App.jsx
    await fs.writeFile(path.join(tmpDirPath, "src", "App.jsx"), reactCode, 'utf8');

    // 3. Executar npm install e build
    if (onProgress) onProgress(90);
    try {
      // Usando npm install caso falte dependencias, mas o ideal é a base já ter os node_modules
      await execPromise('npm install --prefer-offline --no-audit', { cwd: tmpDirPath });
      if (onProgress) onProgress(95);
      await execPromise('npm run build', { cwd: tmpDirPath });
    } catch (buildErr) {
      console.error(`[${new Date().toISOString()}] [GERAR_SITE_VITE] ❌ Erro no build:`, buildErr);
      
      // Criar um dist fake com o erro para mostrar no preview
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
