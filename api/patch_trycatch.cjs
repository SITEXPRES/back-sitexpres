const fs = require('fs');
const file = 'controllers/siteController.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /await criarSubdominioDirectAdmin\(nomeSubdominio, "sitexpres.com.br"\);/g,
  'try { await criarSubdominioDirectAdmin(nomeSubdominio, "sitexpres.com.br"); } catch (e) { console.error("Erro DA:", e.message); }'
);

content = content.replace(
  /await enviarDiretorioSubdominio\("ftp.sitexpres.com.br", username, password, dominio_hospedagem, distPath\);/g,
  'try { await enviarDiretorioSubdominio("ftp.sitexpres.com.br", username, password, dominio_hospedagem, distPath); } catch (e) { console.error("Erro FTP:", e.message); }'
);

content = content.replace(
  /await enviarDiretorioSubdominio\(\s*"ftp.sitexpres.com.br",\s*process.env.user_directamin,\s*process.env.pass_directamin,\s*nomeSubdominio \+ '\.sitexpres\.com\.br',\s*distPath\s*\);/g,
  'try { await enviarDiretorioSubdominio("ftp.sitexpres.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", distPath); } catch (e) { console.error("Erro FTP DA:", e.message); }'
);

fs.writeFileSync(file, content);
