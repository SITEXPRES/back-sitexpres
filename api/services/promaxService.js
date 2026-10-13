import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { PROMAX_SYSTEM_PROMPT, buildPromaxMessages } from "../prompts/promax_system_prompt.js";

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
});

/**
 * Remove backticks ou marcações markdown para garantir JSON limpo
 */
function cleanJsonOutput(text) {
  let cleaned = text.trim();
  // Remove ```json no início e ``` no final
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

/**
 * Gera a aplicação completa no formato Promax utilizando a IA Claude
 * @param {string} userPrompt - Pedido do usuário (ex: "Gere um CRM para imobiliária")
 * @returns {Promise<Object>} - Objeto contendo name_app, tecnologia, files, etc.
 */
export async function gerarAplicacaoPromax(userPrompt) {
  const model = "claude-3-5-sonnet-20241022";
  console.log(`[PROMAX_AI] 🧠 Solicitando geração de aplicação para Claude (${model})...`);
  console.log(`[PROMAX_AI] 📝 Prompt do usuário: "${userPrompt}"`);

  const response = await anthropic.messages.create({
    model: model,
    max_tokens: 8192,
    temperature: 0.2, // Baixa temperatura para garantir precisão e JSON estrito
    system: PROMAX_SYSTEM_PROMPT,
    messages: buildPromaxMessages(userPrompt)
  });

  const rawContent = response.content[0]?.text || "";
  console.log(`[PROMAX_AI] 📥 Resposta recebida da IA (${rawContent.length} chars). Validando JSON...`);

  try {
    const cleanedJson = cleanJsonOutput(rawContent);
    const appData = JSON.parse(cleanedJson);

    if (!appData.name_app || !Array.isArray(appData.files)) {
      throw new Error("Estrutura do JSON inválida (faltam name_app ou files)");
    }

    console.log(`[PROMAX_AI] ✅ Aplicação gerada com sucesso: ${appData.name_app} (${appData.files.length} arquivos)`);
    return appData;
  } catch (parseError) {
    console.error("[PROMAX_AI] ❌ Erro ao parsear JSON retornado pela IA:", parseError.message);
    console.error("[PROMAX_AI] Snippet do texto retornado:", rawContent.slice(0, 500));
    throw new Error(`Falha no parse do código gerado pela IA: ${parseError.message}`);
  }
}
