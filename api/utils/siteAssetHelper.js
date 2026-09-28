import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

/**
 * Remove qualquer vínculo de URLs apontando para o servidor back.sitexpres.com.br,
 * convertendo os caminhos para caminhos relativos locais (ex: ./images/logo.png).
 *
 * @param {string} htmlContent - Código HTML do site
 * @returns {string} HTML sanitizado com caminhos relativos
 */
export function desatrelarHtmlSitexpress(htmlContent) {
  if (!htmlContent || typeof htmlContent !== "string") return htmlContent;

  // Substitui URLs absolutas do backend (logos ou images) por caminhos locais relativos ./images/
  // Ex: https://back.sitexpres.com.br/uploads/logos/123.png -> ./images/123.png
  // Ex: https://back.sitexpres.com.br/uploads/images/123.png -> ./images/123.png
  let sanitized = htmlContent.replace(
    /https?:\/\/(?:back\.sitexpres\.com\.br|localhost:[0-9]+)\/uploads\/(?:logos|images)\/([a-zA-Z0-9_.-]+)/gi,
    "./images/$1"
  );

  return sanitized;
}

/**
 * Coleta todos os arquivos locais (imagens/logos) atrelados a um projeto,
 * verificando o upload atual, o HTML e registros anteriores no banco.
 *
 * @param {string} id_projeto - ID do projeto
 * @param {string} htmlContent - Código HTML do site
 * @param {object|null} currentFile - Arquivo enviado na requisição atual (req.file)
 * @param {object|null} dbClientOrPool - Conexão ou pool PostgreSQL
 * @returns {Promise<Array<{localPath: string, remoteName: string, remoteSubdir: string}>>}
 */
export async function coletarArquivosProjeto(id_projeto, htmlContent, currentFile = null, dbClientOrPool = null) {
  const arquivos = [];
  const adicionados = new Set();

  const uploadsLogosDir = path.join(process.cwd(), "uploads", "logos");
  const uploadsImagesDir = path.join(process.cwd(), "uploads", "images");

  // Helper para verificar existência no disco
  function encontrarArquivoNoDisco(filename) {
    if (!filename) return null;
    const p1 = path.join(uploadsLogosDir, filename);
    if (fsSync.existsSync(p1)) return p1;
    const p2 = path.join(uploadsImagesDir, filename);
    if (fsSync.existsSync(p2)) return p2;
    return null;
  }

  // 1. Arquivo recebido na requisição atual
  if (currentFile && currentFile.path) {
    const filename = currentFile.filename || path.basename(currentFile.path);
    arquivos.push({
      localPath: path.resolve(currentFile.path),
      remoteName: filename,
      remoteSubdir: "images"
    });
    adicionados.add(filename);
  }

  // 2. Extrair arquivos referenciados em ./images/ ou images/ no HTML
  if (htmlContent && typeof htmlContent === "string") {
    const regexImg = /(?:src|href|url\()=?["']?(?:\.\/)?images\/([a-zA-Z0-9_.-]+)["'\)]?/gi;
    let match;
    while ((match = regexImg.exec(htmlContent)) !== null) {
      const filename = match[1];
      if (filename && !adicionados.has(filename)) {
        const localPath = encontrarArquivoNoDisco(filename);
        if (localPath) {
          arquivos.push({
            localPath,
            remoteName: filename,
            remoteSubdir: "images"
          });
          adicionados.add(filename);
        }
      }
    }
  }

  // 3. Consultar imagens anteriores salvas no banco para o projeto
  if (id_projeto && dbClientOrPool) {
    try {
      const prev = await dbClientOrPool.query(
        `SELECT image_path FROM generated_sites WHERE id_projeto = $1 AND image_path IS NOT NULL ORDER BY created_at DESC LIMIT 10`,
        [id_projeto]
      );
      for (const row of prev.rows) {
        if (!row.image_path) continue;
        const filename = path.basename(row.image_path);
        if (filename && !adicionados.has(filename)) {
          const localPath = encontrarArquivoNoDisco(filename);
          if (localPath) {
            arquivos.push({
              localPath,
              remoteName: filename,
              remoteSubdir: "images"
            });
            adicionados.add(filename);
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ Aviso ao buscar imagens históricas do projeto:", e.message);
    }
  }

  return arquivos;
}
