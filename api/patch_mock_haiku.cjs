const fs = require('fs');
const file = 'controllers/gerar_siteController.js';
let content = fs.readFileSync(file, 'utf8');

const mockLogic = `
      // Claude Haiku — mais rápido e econômico
      const MODELO = "claude-haiku-4-5-20251001";
      
      let html = "";
      
      if (prompt.toLowerCase().includes('[teste]')) {
          console.log(\`[\${new Date().toISOString()}] [GERAR_SITE] 🧪 MODO TESTE ATIVADO! Pulando API da IA...\`);
          html = \`<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Site de Teste - SiteXpress</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 flex items-center justify-center min-h-screen">
    <div class="bg-white p-8 rounded-xl shadow-xl text-center max-w-md w-full">
        <h1 class="text-3xl font-bold text-red-600 mb-4">FitnesBlack (Teste)</h1>
        <p class="text-gray-600 mb-6">Este é um site gerado instantaneamente no modo [teste]!</p>
        <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg w-full transition-colors">
            Matricule-se Agora
        </button>
    </div>
</body>
</html>\`;
          if (onProgress) onProgress(80);
          
          // Uso de créditos fake
          await uso_creditos(userId, 50, 50, id_projeto);
      } else {
          console.log(\`[\${new Date().toISOString()}] [GERAR_SITE] 🧠 Chamando Claude API (streaming) | modelo: \${MODELO} | max_tokens: \${MAX_TOKENS_HAIKU}\`);
          const tStream = Date.now();

          const stream = await anthropic.messages.stream({
            model: MODELO,
            max_tokens: MAX_TOKENS_HAIKU,
            system: systemPrompt,
            messages: [{
              role: "user",
              content: systemPrompt
            }]
          });

          console.log(\`[\${new Date().toISOString()}] [GERAR_SITE] 📡 Stream iniciado. Aguardando chunks da IA...\`);
          if (onProgress) onProgress(5); 

          let chunkCount = 0;
          let lastLogChunk = 0;
          let lastReportedPercent = 0;

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta?.text) {
              html += event.delta.text;
              chunkCount++;

              // Estima percentual: quantos chars já chegaram vs total esperado (max 99 durante stream)
              const percent = Math.min(Math.round((html.length / expectedChars) * 94) + 5, 99);
              
              if (onProgress && percent !== lastReportedPercent && percent % 5 === 0) {
                onProgress(percent);
                lastReportedPercent = percent;
              }

              if (chunkCount - lastLogChunk >= 20) {
                const streamTempo = ((Date.now() - tStream) / 1000).toFixed(1);
                console.log(\`[\${new Date().toISOString()}] [GERAR_SITE] ⏳ Streaming... chunk #\${chunkCount} | \${percent}% | HTML: \${html.length} chars | tempo: \${streamTempo}s\`);
                lastLogChunk = chunkCount;
              }
            }
          }

          const streamTime = ((Date.now() - tStream) / 1000).toFixed(1);
          console.log(\`[\${new Date().toISOString()}] [GERAR_SITE] ✅ Streaming finalizado em \${streamTime}s (\${chunkCount} chunks, \${html.length} chars)\`);

          const finalMessage = await stream.finalMessage();
          const inputTokens = finalMessage.usage?.input_tokens ?? 0;
          const outputTokens = finalMessage.usage?.output_tokens ?? 0;
          
          console.log(\`[\${new Date().toISOString()}] [GERAR_SITE] 📊 Tokens: input=\${inputTokens} | output=\${outputTokens} | total=\${inputTokens + outputTokens}\`);

          await uso_creditos(userId, inputTokens + outputTokens, inputTokens + outputTokens, id_projeto);
      }
`;

const regex = /\/\/ Claude Haiku — mais rápido e econômico\s+const MODELO = "claude-haiku-4-5-20251001";[\s\S]*?await uso_creditos\(userId, inputTokens \+ outputTokens, inputTokens \+ outputTokens, id_projeto\);/m;

content = content.replace(regex, mockLogic.trim());

fs.writeFileSync(file, content);
