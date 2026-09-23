const fs = require('fs');
const file = 'controllers/siteController.js';
let content = fs.readFileSync(file, 'utf8');

// The current logic in siteController.js after my previous script:
// try { await enviarDiretorioSubdominio("ftp.sitexpres.com.br", username, password, dominio_hospedagem, distPath); } catch (e) { console.error("Erro FTP:", e.message); }

// E para o DirectAdmin default:
// try { await enviarDiretorioSubdominio("ftp.sitexpres.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", distPath); } catch (e) { console.error("Erro FTP DA:", e.message); }

const novoCustom = `
            try {
              await enviarDiretorioSubdominio("ftp.sitexpres.com.br", username, password, dominio_hospedagem, distPath);
            } catch (e1) {
              logStep(jobId, \`⚠️ Falha no ftp.sitexpres.com.br. Tentando fallback para srv3br.com.br...\`);
              try {
                await enviarDiretorioSubdominio("srv3br.com.br", username, password, dominio_hospedagem, distPath);
                logStep(jobId, \`✅ Diretório dist enviado via FTP (Fallback srv3br.com.br)\`);
              } catch (e2) {
                logStep(jobId, \`⚠️ Erro FTP Customizado (ambos servidores): \${e2.message}\`);
                console.error("Erro FTP Customizado:", e2);
              }
            }
`;

const novoDefault = `
            try {
              await enviarDiretorioSubdominio("ftp.sitexpres.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", distPath);
            } catch (e1) {
              logStep(jobId, \`⚠️ Falha no ftp.sitexpres.com.br. Tentando fallback para srv3br.com.br...\`);
              try {
                await enviarDiretorioSubdominio("srv3br.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", distPath);
                logStep(jobId, \`✅ Diretório dist enviado via FTP (Fallback srv3br.com.br)\`);
              } catch (e2) {
                logStep(jobId, \`⚠️ Erro FTP DirectAdmin (ambos servidores): \${e2.message} (Preview continuará funcionando)\`);
                console.error("Erro FTP DirectAdmin:", e2);
              }
            }
`;

content = content.replace(
  /try \{ await enviarDiretorioSubdominio\(\"ftp\.sitexpres\.com\.br\", username, password, dominio_hospedagem, distPath\); \} catch \(e\) \{ console\.error\(\"Erro FTP:\", e\.message\); \}/g,
  novoCustom.trim()
);

content = content.replace(
  /try \{ await enviarDiretorioSubdominio\(\"ftp\.sitexpres\.com\.br\", process\.env\.user_directamin, process\.env\.pass_directamin, nomeSubdominio \+ \"\.sitexpres\.com\.br\", distPath\); \} catch \(e\) \{ console\.error\(\"Erro FTP DA:\", e\.message\); \}/g,
  novoDefault.trim()
);

fs.writeFileSync(file, content);
