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

function applyUltraFuzzy(original, search, replaceText) {
  // Remove TODOS os espaços/quebras de linha para busca
  const stripSpaces = (str) => str.replace(/\s+/g, '');
  const searchStripped = stripSpaces(search);
  
  if (searchStripped.length === 0) return null;

  // Cria um mapa: índice da string "espremida" -> índice original no arquivo
  let strippedIdx = 0;
  const indexMap = [];
  for (let i = 0; i < original.length; i++) {
    if (!/\s/.test(original[i])) {
      indexMap[strippedIdx] = i;
      strippedIdx++;
    }
  }

  const originalStripped = stripSpaces(original);
  const matchIdx = originalStripped.indexOf(searchStripped);

  if (matchIdx !== -1) {
    // Encontrou! Mapeia de volta para os índices do arquivo original
    const startOriginalIdx = indexMap[matchIdx];
    const endOriginalIdx = indexMap[matchIdx + searchStripped.length - 1];
    
    // Substitui exatamente aquele bloco (preservando o restante do arquivo)
    const before = original.slice(0, startOriginalIdx);
    const after = original.slice(endOriginalIdx + 1);
    return before + replaceText + after;
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
    
    // Tentativa 1: Exata
    const idx = code.indexOf(search);
    if (idx !== -1 && search.trim() !== '') {
      code = code.slice(0, idx) + replace + code.slice(idx + search.length);
      applied++;
      continue;
    }
    
    // Tentativa 2: "Ultra Fuzzy" - Salva a vida se a IA errar espaços ou pular linhas!
    const res = applyUltraFuzzy(code, search, replace);
    if (res) { 
      code = res; 
      applied++; 
    } else {
      failed++;
    }
  }
  return { code, applied, failed };
}
