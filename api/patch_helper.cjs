const fs = require('fs');
const file = 'controllers/siteController.js';
let content = fs.readFileSync(file, 'utf8');

const helper = `
// Helper: Extrair URLs do prompt e fazer fetch
async function extractUrlsAndFetchContent(prompt, logStep, jobId) {
  const urlRegex = /(https?:\\/\\/[^\\s]+)/g;
  const urls = prompt.match(urlRegex);
  
  if (!urls || urls.length === 0) return prompt;

  let enrichedPrompt = prompt + '\\n\\n--- CONTEXTO ADICIONAL LIDO DAS URLs FORNECIDAS ---\\n';
  
  for (const url of urls) {
    if (logStep) logStep(jobId, \`🌐 Lendo conteúdo da URL: \${url}\`);
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
      textContent = textContent.replace(/\\s+/g, ' ').trim();
      
      // Limitar a quantidade de texto para não estourar os tokens
      if (textContent.length > 20000) {
        textContent = textContent.substring(0, 20000) + '... [Conteúdo Truncado]';
      }
      
      enrichedPrompt += \`\\nConteúdo do site \${url}:\\n\${textContent}\\n\`;
      if (logStep) logStep(jobId, \`✅ URL lida com sucesso (\${textContent.length} caracteres extraídos).\`);
    } catch (e) {
      console.error("Erro ao ler URL:", e.message);
      if (logStep) logStep(jobId, \`⚠️ Não foi possível ler a URL \${url}: \${e.message}\`);
      enrichedPrompt += \`\\nConteúdo do site \${url}: [Não foi possível ler: \${e.message}]\\n\`;
    }
  }
  return enrichedPrompt;
}
`;

// Insert after imports
let lines = content.split('\n');
const insertIndex = lines.findIndex(l => l.includes('export const newsite'));
if (insertIndex !== -1) {
    lines.splice(insertIndex, 0, helper);
}

// Modify finalPrompt = primeiraVez ...
let finalPromptRegex = /finalPrompt = primeiraVez\s*\n\s*\? fullPrompt\s*\n\s*: \`HTML atual:\\n\$\{baseHTML\}\\nFaça as alterações solicitadas: \$\{fullPrompt\}\`;/s;
let newFinalPrompt = `finalPrompt = primeiraVez
            ? fullPrompt
            : \`HTML atual:\\n\${baseHTML}\\nFaça as alterações solicitadas: \${fullPrompt}\`;
          
          logStep(jobId, '🔎 Verificando se há URLs no prompt...');
          finalPrompt = await extractUrlsAndFetchContent(finalPrompt, logStep, jobId);`;

content = lines.join('\n');
content = content.replace(finalPromptRegex, newFinalPrompt);

fs.writeFileSync(file, content);
