import fs from "fs";
import path from "path";
import pool from "../config/db.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
import { desatrelarHtmlSitexpress, coletarArquivosProjeto } from "../utils/siteAssetHelper.js";

export const downloadSite = async (req, res) => {
  const { id } = req.params;
  
  try {
    // 1. Tentar enviar o ZIP pré-gerado (que contém todo o build do Vite com assets)
    const zipPath = path.join(process.cwd(), 'uploads', 'zips', `${id}.zip`);
    if (fs.existsSync(zipPath)) {
      return res.download(zipPath, `site-${id}.zip`);
    }

    // 2. Fallback: Gerar ZIP sob demanda
    const siteRes = await pool.query(
      `SELECT html_content, js_content FROM generated_sites WHERE id_projeto = $1 AND status = 'ativo' ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    if (siteRes.rows.length === 0 || !siteRes.rows[0].html_content) {
      return res.status(404).json({ success: false, message: "Site não encontrado para download" });
    }

    const { html_content, js_content } = siteRes.rows[0];
    const html = desatrelarHtmlSitexpress(html_content);
    const arquivosExtras = await coletarArquivosProjeto(id, html, null, pool);

    res.attachment(`site-${id}-source.zip`);
    
    let archive;
    if (archiver && archiver.ZipArchive) {
      archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    } else if (archiver && archiver.default && archiver.default.ZipArchive) {
      archive = new archiver.default.ZipArchive({ zlib: { level: 9 } });
    } else if (typeof archiver === 'function') {
      archive = archiver('zip', { zlib: { level: 9 } });
    } else if (archiver && typeof archiver.create === 'function') {
      archive = archiver.create('zip', { zlib: { level: 9 } });
    } else if (archiver && typeof archiver.default === 'function') {
      archive = archiver.default('zip', { zlib: { level: 9 } });
    } else {
      throw new Error("Archiver não é suportado: " + typeof archiver);
    }
    
    archive.on("error", (err) => {
      console.error("Erro no archiver:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Erro ao gerar arquivo para download" });
      }
    });

    archive.pipe(res);

    if (js_content) {
      // É um projeto Vite/React
      const templatePath = path.join(process.cwd(), "templates", "vite-base");
      if (fs.existsSync(templatePath)) {
        archive.directory(templatePath, false);
      }
      archive.append(js_content, { name: "src/App.jsx" });
      
      const readme = `PROJETO REACT/VITE - SITEXPRESS
Este é o código fonte do seu site gerado por inteligência artificial.

Para rodar este projeto na sua máquina local:
1. Tenha o Node.js instalado (https://nodejs.org).
2. Abra o terminal na pasta deste projeto extraído.
3. Rode o comando: npm install
4. Rode o comando: npm run dev

Seu site estará rodando no endereço http://localhost:5173
`;
      archive.append(readme, { name: "LEIA-ME.txt" });

      if (Array.isArray(arquivosExtras)) {
        for (const arq of arquivosExtras) {
          archive.file(arq.localPath, { name: `public/images/${arq.remoteName}` });
        }
      }
    } else {
      // HTML legado
      archive.append(html, { name: "index.html" });
      if (Array.isArray(arquivosExtras)) {
        for (const arq of arquivosExtras) {
          archive.file(arq.localPath, { name: `images/${arq.remoteName}` });
        }
      }
    }
    
    await archive.finalize();

  } catch (err) {
    console.error("Erro ao gerar zip sob demanda:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Erro ao gerar arquivo para download" });
    }
  }
};
