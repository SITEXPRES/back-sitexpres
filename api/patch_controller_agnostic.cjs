const fs = require('fs');
const file = 'controllers/siteController.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix the geracaoResult unpacking
const oldUnpack = 'const { reactCode: html, distPath, tmpDirPath, hasError } = geracaoResult;';
const newUnpack = `
          let html, distPath, tmpDirPath, hasError;
          if (typeof geracaoResult === 'string') {
            // Modo HTML Puro
            html = geracaoResult;
            distPath = null;
            tmpDirPath = null;
            hasError = false;
          } else {
            // Modo React Vite
            html = geracaoResult.reactCode;
            distPath = geracaoResult.distPath;
            tmpDirPath = geracaoResult.tmpDirPath;
            hasError = geracaoResult.hasError;
          }
`;
content = content.replace(oldUnpack, newUnpack.trim());

// 2. Fix the FTP logic
const ftpLogicOld = `
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
const ftpLogicNew = `
              try {
                if (distPath) {
                  await enviarDiretorioSubdominio("ftp.sitexpres.com.br", username, password, dominio_hospedagem, distPath);
                } else {
                  await enviarHTMLSubdominio("ftp.sitexpres.com.br", username, password, dominio_hospedagem, html);
                }
              } catch (e1) {
                logStep(jobId, \`⚠️ Falha no ftp.sitexpres.com.br. Tentando fallback para srv3br.com.br...\`);
                try {
                  if (distPath) {
                    await enviarDiretorioSubdominio("srv3br.com.br", username, password, dominio_hospedagem, distPath);
                  } else {
                    await enviarHTMLSubdominio("srv3br.com.br", username, password, dominio_hospedagem, html);
                  }
                  logStep(jobId, \`✅ Arquivos enviados via FTP (Fallback srv3br.com.br)\`);
                } catch (e2) {
                  logStep(jobId, \`⚠️ Erro FTP Customizado (ambos servidores): \${e2.message}\`);
                  console.error("Erro FTP Customizado:", e2);
                }
              }
`;
content = content.replace(ftpLogicOld.trim(), ftpLogicNew.trim());

const ftpLogicOld2 = `
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
const ftpLogicNew2 = `
              try {
                if (distPath) {
                  await enviarDiretorioSubdominio("ftp.sitexpres.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", distPath);
                } else {
                  await enviarHTMLSubdominio("ftp.sitexpres.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", html);
                }
              } catch (e1) {
                logStep(jobId, \`⚠️ Falha no ftp.sitexpres.com.br. Tentando fallback para srv3br.com.br...\`);
                try {
                  if (distPath) {
                    await enviarDiretorioSubdominio("srv3br.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", distPath);
                  } else {
                    await enviarHTMLSubdominio("srv3br.com.br", process.env.user_directamin, process.env.pass_directamin, nomeSubdominio + ".sitexpres.com.br", html);
                  }
                  logStep(jobId, \`✅ Arquivos enviados via FTP (Fallback srv3br.com.br)\`);
                } catch (e2) {
                  logStep(jobId, \`⚠️ Erro FTP DirectAdmin (ambos servidores): \${e2.message} (Preview continuará funcionando)\`);
                  console.error("Erro FTP DirectAdmin:", e2);
                }
              }
`;
content = content.replace(ftpLogicOld2.trim(), ftpLogicNew2.trim());

// 3. Fix the fs.rm undefined crash
const rmOld = "await fs.rm(tmpDirPath, { recursive: true, force: true }).catch(e => console.error('Erro ao deletar tmp dir:', e));";
const rmNew = "if (tmpDirPath) { await fs.rm(tmpDirPath, { recursive: true, force: true }).catch(e => console.error('Erro ao deletar tmp dir:', e)); }";
content = content.replace(rmOld, rmNew);

fs.writeFileSync(file, content);
