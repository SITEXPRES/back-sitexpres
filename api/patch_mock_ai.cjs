const fs = require('fs');
const file = 'controllers/gerar_siteController_vite.js';
let content = fs.readFileSync(file, 'utf8');

const mockLogic = `
    let reactCode = "";
    
    if (prompt.toLowerCase().includes('[teste]')) {
      console.log(\`[\${new Date().toISOString()}] [GERAR_SITE_VITE] 🧪 MODO TESTE ATIVADO! Pulando API da IA...\`);
      reactCode = \`
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
\`;
      if (onProgress) onProgress(80);
      
      // Simula uso de créditos fake para não quebrar validações
      await uso_creditos(userId, 100, 100, id_projeto);
    } else {
      const stream = await anthropic.messages.stream({
        model: MODELO,
        max_tokens: 8192,
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
`;

content = content.replace(
  /const stream = await anthropic\.messages\.stream\(\{[\s\S]*?await uso_creditos\(userId, inputTokens \+ outputTokens, inputTokens \+ outputTokens, id_projeto\);/m,
  mockLogic.trim()
);

fs.writeFileSync(file, content);
