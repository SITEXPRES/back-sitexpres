// Edição por blocos SEARCH/REPLACE: a IA devolve só o que mudou e o backend aplica no código atual.
// Reduz drasticamente os tokens de saída (e evita reescrever o arquivo inteiro).

const BLOCK_RE = /<{4,9}\s*SEARCH\r?\n([\s\S]*?)\r?\n={4,9}\r?\n([\s\S]*?)>{4,9}\s*REPLACE/gi;

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
 * Tentativa 3: Se o bloco tiver 3 ou mais linhas e houver alguma variação interna,
 * busca as linhas de âncora inicial e final para delimitar a substituição com precisão.
 */
function applyAnchorFuzzy(original, search, replaceText) {
  const lines = search.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 3) return null;

  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];

  // Garante que a primeira linha é significativa (não é apenas uma chave ou colchete isolado)
  if (firstLine.length < 5) return null;

  const firstIdx = original.indexOf(firstLine);
  if (firstIdx === -1) return null;

  // Busca a última linha a partir da primeira ocorrência, respeitando uma janela plausível
  const searchScope = original.slice(firstIdx, firstIdx + Math.max(search.length * 3, 3000));
  const lastLineInScope = searchScope.lastIndexOf(lastLine);
  if (lastLineInScope !== -1) {
    const endOriginalIdx = firstIdx + lastLineInScope + lastLine.length;
    return original.slice(0, firstIdx) + replaceText + original.slice(endOriginalIdx);
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
      continue;
    }

    // Tentativa 3: "Anchor Fuzzy" - Salva se a IA variar alguma linha intermediária
    const resAnchor = applyAnchorFuzzy(code, search, replace);
    if (resAnchor) {
      code = resAnchor;
      applied++;
      continue;
    }

    failed++;
  }
  return { code, applied, failed };
}
