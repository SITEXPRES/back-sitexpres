// Edição por blocos SEARCH/REPLACE: a IA devolve só o que mudou e o backend aplica no código atual.
// Reduz drasticamente os tokens de saída (e evita reescrever o arquivo inteiro).

const BLOCK_RE = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)>>>>>>> REPLACE/g;

export function parseEditBlocks(text) {
  const blocks = [];
  for (const m of text.matchAll(BLOCK_RE)) {
    blocks.push({ search: m[1], replace: m[2].replace(/\r?\n$/, '') });
  }
  return blocks;
}

function applyFuzzy(lines, searchLines, replaceText) {
  // fallback: compara linhas ignorando indentação/espaços nas pontas
  const norm = (l) => l.trim();
  const s = searchLines.map(norm);
  if (!s.length || s.every((l) => l === '')) return null;
  for (let i = 0; i <= lines.length - s.length; i++) {
    let ok = true;
    for (let j = 0; j < s.length; j++) {
      if (norm(lines[i + j]) !== s[j]) { ok = false; break; }
    }
    if (ok) {
      return [...lines.slice(0, i), ...replaceText.split('\n'), ...lines.slice(i + s.length)];
    }
  }
  return null;
}

/**
 * Aplica os blocos no código. Retorna { code, applied, failed }.
 * Se qualquer bloco falhar, o chamador deve cair para reescrita completa.
 */
export function applyEditBlocks(original, blocks) {
  let code = original.replace(/\r\n/g, '\n');
  let applied = 0;
  let failed = 0;
  for (const b of blocks) {
    const search = b.search.replace(/\r\n/g, '\n');
    const replace = b.replace.replace(/\r\n/g, '\n');
    const idx = code.indexOf(search);
    if (idx !== -1 && search.trim() !== '') {
      code = code.slice(0, idx) + replace + code.slice(idx + search.length);
      applied++;
      continue;
    }
    const res = applyFuzzy(code.split('\n'), search.split('\n'), replace);
    if (res) { code = res.join('\n'); applied++; } else failed++;
  }
  return { code, applied, failed };
}
