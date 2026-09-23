const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'api', 'controllers', 'siteController.js');
let content = fs.readFileSync(p, 'utf8');

// 1. Change import of gerar_site
content = content.replace(
  "import { gerar_site } from './gerar_siteController.js';",
  "import { gerar_site } from './gerar_siteController_vite.js';"
);

// 2. Change import in integracao_directadmin
content = content.replace(
  'import { criarSubdominioDirectAdmin, enviarHTMLSubdominio, deletarSubdominioDirectAdmin } from "./integracao_directadmin.js";',
  'import { criarSubdominioDirectAdmin, enviarHTMLSubdominio, deletarSubdominioDirectAdmin, enviarDiretorioSubdominio } from "./integracao_directadmin.js";'
);

// 3. Find the FTP sending logic
content = content.replace(
  /logStep\(jobId, `📤 Enviando HTML via FTP para DirectAdmin\.\.\. \(hospedagem customizada: \$\{existe_hospedagem\.rows\.length > 0\}\)`\);\s*const tFTP = Date\.now\(\);\s*if \(existe_hospedagem\.rows\.length > 0\) {[\s\S]*?await enviarHTMLSubdominio\([\s\S]*?\);\s*}\s*logStep\(jobId, `✅ HTML enviado via FTP \(\$\{Date\.now\(\) - tFTP\}ms\)`\);/g,
  `logStep(jobId, \`📤 Enviando Pasta dist via FTP para DirectAdmin... (hospedagem customizada: \${existe_hospedagem.rows.length > 0})\`);
          const tFTP = Date.now();

          if (existe_hospedagem.rows.length > 0) {
            const username          = existe_hospedagem.rows[0].username;
            const password          = existe_hospedagem.rows[0].senha;
            const dominio_hospedagem = existe_hospedagem.rows[0].dominio;
            await enviarDiretorioSubdominio("ftp.sitexpres.com.br", username, password, dominio_hospedagem, distPath);
          } else {
            await enviarDiretorioSubdominio(
              "ftp.sitexpres.com.br",
              process.env.user_directamin,
              process.env.pass_directamin,
              nomeSubdominio + '.sitexpres.com.br',
              distPath
            );
          }
          logStep(jobId, \`✅ Diretório dist enviado via FTP (\${Date.now() - tFTP}ms)\`);
          
          // Limpa a pasta temporária do build
          const fsPromises = require('fs/promises');
          await fsPromises.rm(tmpDirPath, { recursive: true, force: true }).catch(e => console.error('Erro ao deletar tmp dir:', e));
          `
);

// 4. Find the call to gerar_site and change what is saved to DB and how it handles FTP
// We need to replace the logic after const html = await gerar_site(...)
content = content.replace(
  /const html = await gerar_site\([\s\S]*?logStep\(jobId, `✅ HTML gerado pela IA \(\$\{\(\(Date\.now\(\) - tIA\) \/ 1000\)\.toFixed\(1\)\}s\) \| tamanho: \$\{html\?\.length \?\? 0\} chars`\);/g,
  `const geracaoResult = await gerar_site(
            finalPrompt,
            "REACT",
            req,
            id_projeto,
            baseHTML,
            userId,
            primeiraVez,
            (percent) => {
              jobs[jobId].progress = percent;
            }
          );
          const { reactCode: html, distPath, tmpDirPath, hasError } = geracaoResult;
          logStep(jobId, \`✅ Geração e build concluídos (\${((Date.now() - tIA) / 1000).toFixed(1)}s)\`);`
);

fs.writeFileSync(p, content);
console.log('Update successful');
