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
    const siteRes = await pool.query(
      `SELECT html_content FROM generated_sites WHERE id_projeto = $1 AND status = 'ativo' ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    if (siteRes.rows.length === 0 || !siteRes.rows[0].html_content) {
      return res.status(404).json({ success: false, message: "Site não encontrado para download" });
    }

    const html = desatrelarHtmlSitexpress(siteRes.rows[0].html_content);
    const arquivosExtras = await coletarArquivosProjeto(id, html, null, pool);

    res.attachment(`site-${id}.zip`);
    
    const archive = archiver("zip", { zlib: { level: 9 } });
    
    archive.on("error", (err) => {
      console.error("Erro no archiver:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Erro ao gerar arquivo para download" });
      }
    });

    archive.pipe(res);

    archive.append(html, { name: "index.html" });
    
    if (Array.isArray(arquivosExtras)) {
      for (const arq of arquivosExtras) {
        archive.file(arq.localPath, { name: `images/${arq.remoteName}` });
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
