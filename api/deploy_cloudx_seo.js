import pool from "./config/db.js";
import { aplicarOtimizacoesDist } from "./services/seoGenerator.js";
import { enviarDiretorioSubdominio } from "./controllers/integracao_directadmin.js";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploySiteThiago() {
  console.log("=================================================");
  console.log("🚀 INICIANDO BUILD E DEPLOY SEO DO SITE DO THIAGO");
  console.log("=================================================");

  // 1. Obter o código React oficial da Cloudx do banco (ID 367)
  const gsRes = await pool.query("SELECT id, html_content FROM public.generated_sites WHERE id = 367");
  if (gsRes.rows.length === 0) {
    throw new Error("Registro ID 367 não encontrado no banco!");
  }

  const rawHtml = gsRes.rows[0].html_content;
  const match = rawHtml.match(/<!-- SITEXPRES_REACT_START -->([\s\S]*?)<!-- SITEXPRES_REACT_END -->/);
  let reactCode = match ? match[1].trim() : rawHtml.trim();
  console.log(`✅ Código React recuperado com sucesso (${reactCode.length} chars)`);

  // Corrige caminhos relativos de imagens para absolutos
  reactCode = reactCode.replace(/(["'])\.\/images\//g, '$1/images/');

  // 2. Preparar diretório de build temporário
  const templatePath = path.resolve(__dirname, "./templates/vite-base");
  const tmpBase = path.resolve(__dirname, "./tmp");
  if (!fsSync.existsSync(tmpBase)) fsSync.mkdirSync(tmpBase, { recursive: true });

  const tmpDirPath = path.join(tmpBase, `deploy_cloudx_${Date.now()}`);
  await fs.cp(templatePath, tmpDirPath, { recursive: true });
  console.log(`📁 Template copiado para: ${tmpDirPath}`);

  // Injeta o App.jsx
  await fs.writeFile(path.join(tmpDirPath, "src", "App.jsx"), reactCode, "utf8");

  // 3. Executar o Vite Build
  console.log("⚙️ Executando Vite Build...");
  try {
    try {
      await execPromise("npx --no-install vite build", { cwd: tmpDirPath });
    } catch {
      await execPromise("npm run build", { cwd: tmpDirPath });
    }
  } catch (buildErr) {
    const errMsg = buildErr.message || '';
    if (errMsg.includes('[MISSING_EXPORT]')) {
      console.log("🔧 Auto-corrigindo ícones do lucide-react...");
      const missingIconMatches = [...errMsg.matchAll(/"([^"]+)" is not exported by "node_modules\/lucide-react/g)];
      const missingIcons = missingIconMatches.map(m => m[1]);
      let fixedCode = reactCode;
      for (const icon of missingIcons) {
        fixedCode = fixedCode.replace(new RegExp(`\\b${icon}\\b`, 'g'), 'CircleDot');
      }
      await fs.writeFile(path.join(tmpDirPath, "src", "App.jsx"), fixedCode, "utf8");
      await execPromise("npx --no-install vite build", { cwd: tmpDirPath });
      reactCode = fixedCode;
    } else {
      throw buildErr;
    }
  }

  const distPath = path.join(tmpDirPath, "dist");
  console.log(`✅ Vite Build concluído com sucesso em: ${distPath}`);

  // 4. Aplicar o SEO Generator e Multi-page SSG
  console.log("🧭 Aplicando Otimizações de SEO Técnico e GEO...");
  await aplicarOtimizacoesDist({
    distPath,
    reactCode,
    siteName: "CloudX",
    domain: "cloudx.com.br"
  });

  // 5. Upload via FTP para o DirectAdmin oficial
  const subdominioAlvo = "sugestodesubdom.sitexpres.com.br";
  console.log(`📤 Iniciando Upload FTP para: ${subdominioAlvo}...`);

  const userFTP = process.env.user_directamin;
  const passFTP = process.env.pass_directamin;

  try {
    try {
      console.log("🔌 Tentando FTP primário: ftp.sitexpres.com.br...");
      await enviarDiretorioSubdominio("ftp.sitexpres.com.br", userFTP, passFTP, subdominioAlvo, distPath);
      console.log(`✅ Upload concluído com sucesso via ftp.sitexpres.com.br!`);
    } catch (e1) {
      console.warn(`⚠️ Falha no ftp.sitexpres.com.br (${e1.message}). Tentando fallback srv3br.com.br...`);
      await enviarDiretorioSubdominio("srv3br.com.br", userFTP, passFTP, subdominioAlvo, distPath);
      console.log(`✅ Upload concluído com sucesso via fallback srv3br.com.br!`);
    }
  } finally {
    // Limpeza da pasta temporária
    await fs.rm(tmpDirPath, { recursive: true, force: true }).catch(() => {});
    console.log("🧹 Pasta temporária limpa.");
  }

  console.log("=================================================");
  console.log("🎉 DEPLOY DO THIAGO FINALIZADO COM SUCESSO!");
  console.log("=================================================");
  process.exit(0);
}

deploySiteThiago().catch(err => {
  console.error("❌ ERRO FATAL NO DEPLOY:", err);
  process.exit(1);
});
