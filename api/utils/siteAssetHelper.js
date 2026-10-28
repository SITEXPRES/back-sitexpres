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

  // Substitui URLs absolutas ou relativas do backend (/uploads/logos/ ou /uploads/images/)
  // por caminhos locais relativos ./images/
  // Ex: https://back.sitexpres.com.br/uploads/logos/123.png -> ./images/123.png
  // Ex: /uploads/logos/123.png -> ./images/123.png
  let sanitized = htmlContent.replace(
    /(?:https?:\/\/(?:back\.sitexpres\.com\.br|localhost:[0-9]+))?\/uploads\/(?:logos|images)\/([a-zA-Z0-9_.-]+)/gi,
    "./images/$1"
  );

  return sanitized;
}

/**
 * Coleta todos os arquivos (imagens/logos) atrelados a um projeto,
 * verificando o upload atual, o HTML no disco local e com fallback remoto (HTTP)
 * para garantir que o ZIP baixado nunca fique sem imagens.
 *
 * @param {string} id_projeto - ID do projeto
 * @param {string} htmlContent - Código HTML do site
 * @param {object|null} currentFile - Arquivo enviado na requisição atual (req.file ou req.files)
 * @param {object|null} dbClientOrPool - Conexão ou pool PostgreSQL
 * @param {string|null} subdominio - Subdomínio do projeto (ex: meudominio.sitexpres.com.br)
 * @returns {Promise<Array<{localPath?: string, buffer?: Buffer, remoteName: string, remoteSubdir: string}>>}
 */
export async function coletarArquivosProjeto(id_projeto, htmlContent, currentFile = null, dbClientOrPool = null, subdominio = null) {
  const arquivos = [];
  const adicionados = new Set();

  const diretoriosBusca = [
    path.join(process.cwd(), "uploads", "logos"),
    path.join(process.cwd(), "uploads", "images"),
    path.join(process.cwd(), "api", "uploads", "logos"),
    path.join(process.cwd(), "api", "uploads", "images"),
    path.join(process.cwd(), "uploads"),
    path.join(process.cwd(), "api", "uploads"),
    path.resolve("uploads/logos"),
    path.resolve("uploads/images"),
    path.resolve("api/uploads/logos"),
    path.resolve("api/uploads/images")
  ];

  // Helper para verificar existência no disco
  function encontrarArquivoNoDisco(filename) {
    if (!filename) return null;
    for (const dir of diretoriosBusca) {
      const full = path.join(dir, filename);
      if (fsSync.existsSync(full)) return full;
    }
    return null;
  }

  // Helper para buscar arquivo via HTTP caso não esteja local no disco
  async function baixarArquivoRemoto(filename) {
    if (!filename) return null;
    const urlsCandidatas = [];

    // Se temos subdomínio conhecido (ex: sugestodesubdom.sitexpres.com.br)
    if (subdominio) {
      const host = subdominio.includes(".") ? subdominio : `${subdominio}.sitexpres.com.br`;
      urlsCandidatas.push(`https://${host}/images/${filename}`);
      urlsCandidatas.push(`https://${host}/${filename}`);
    }

    // URLs do backend de uploads
    urlsCandidatas.push(`https://back.sitexpres.com.br/uploads/logos/${filename}`);
    urlsCandidatas.push(`https://back.sitexpres.com.br/uploads/images/${filename}`);

    for (const url of urlsCandidatas) {
      try {
        const resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: AbortSignal.timeout(4000)
        });
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          if (ab && ab.byteLength > 0) {
            return Buffer.from(ab);
          }
        }
      } catch (e) {
        // Ignora e tenta próxima URL
      }
    }
    return null;
  }

  async function processarArquivo(filename) {
    if (!filename || adicionados.has(filename)) return;

    // 1. Tenta achar no disco local
    const localPath = encontrarArquivoNoDisco(filename);
    if (localPath) {
      arquivos.push({
        localPath,
        remoteName: filename,
        remoteSubdir: "images"
      });
      adicionados.add(filename);
      return;
    }

    // 2. Se não estiver no disco, tenta baixar via HTTP (subdomínio ou back.sitexpres)
    try {
      const buffer = await baixarArquivoRemoto(filename);
      if (buffer) {
        arquivos.push({
          buffer,
          remoteName: filename,
          remoteSubdir: "images"
        });
        adicionados.add(filename);
        return;
      }
    } catch (err) {
      console.warn(`⚠️ Não foi possível recuperar arquivo remoto: ${filename}`, err.message);
    }
  }

  // 1. Arquivo(s) recebido(s) na requisição atual (suporte a array ou único)
  const filesArray = Array.isArray(currentFile)
    ? currentFile                              // req.files (múltiplos)
    : currentFile ? [currentFile] : [];        // req.file (único, legado)

  for (const file of filesArray) {
    if (file && file.path) {
      const filename = file.filename || path.basename(file.path);
      if (!adicionados.has(filename)) {
        arquivos.push({
          localPath: path.resolve(file.path),
          remoteName: filename,
          remoteSubdir: "images"
        });
        adicionados.add(filename);
      }
    }
  }

  // 2. Extrair arquivos referenciados no HTML
  if (htmlContent && typeof htmlContent === "string") {
    // A. Imagens em /images/ ou ./images/
    const regexImg = /(?:src|href|url\()=?["']?(?:\.|\/)?\/?images\/([a-zA-Z0-9_.-]+)["'\)]?/gi;
    let match;
    while ((match = regexImg.exec(htmlContent)) !== null) {
      await processarArquivo(match[1]);
    }

    // B. Imagens em /uploads/logos/ ou /uploads/images/
    const regexUploads = /(?:https?:\/\/[^\/]+)?\/uploads\/(?:logos|images)\/([a-zA-Z0-9_.-]+)/gi;
    let matchUpload;
    while ((matchUpload = regexUploads.exec(htmlContent)) !== null) {
      await processarArquivo(matchUpload[1]);
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
        await processarArquivo(filename);
      }
    } catch (e) {
      console.warn("⚠️ Aviso ao buscar imagens históricas do projeto:", e.message);
    }
  }

  return arquivos;
}
