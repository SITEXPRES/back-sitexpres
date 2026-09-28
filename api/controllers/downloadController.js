import fs from "fs";
import path from "path";
import pool from "../config/db.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");
import { desatrelarHtmlSitexpress, coletarArquivosProjeto } from "../utils/siteAssetHelper.js";

export const downloadSite = async (req, res) => {
  const { id } = req.params;
  const zipsDir = path.join(process.cwd(), "uploads", "zips");
  const zipPath = path.join(zipsDir, `${id}.zip`);

  if (!fs.existsSync(zipPath)) {
    // Tenta gerar sob demanda caso o arquivo ainda não exista
    try {
      if (!fs.existsSync(zipsDir)) {
        fs.mkdirSync(zipsDir, { recursive: true });
      }

      const siteRes = await pool.query(
        `SELECT html_content FROM generated_sites WHERE id_projeto = $1 AND status = 'ativo' ORDER BY created_at DESC LIMIT 1`,
        [id]
      );

      if (siteRes.rows.length === 0 || !siteRes.rows[0].html_content) {
        return res.status(404).json({ success: false, message: "Site não encontrado para download" });
      }

      const html = desatrelarHtmlSitexpress(siteRes.rows[0].html_content);
      const arquivosExtras = await coletarArquivosProjeto(id, html, null, pool);

      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);

        archive.append(html, { name: "index.html" });
        if (Array.isArray(arquivosExtras)) {
          for (const arq of arquivosExtras) {
            archive.file(arq.localPath, { name: `images/${arq.remoteName}` });
          }
        }
        archive.finalize();
      });
    } catch (err) {
      console.error("Erro ao gerar zip sob demanda:", err.message);
      return res.status(500).json({ success: false, message: "Erro ao gerar arquivo para download" });
    }
  }

  res.download(zipPath, `site-${id}.zip`);
};
