import fs from 'fs';

let code = fs.readFileSync('services/notafiscalService.js', 'utf8');

const targetStr = `      const isForeign = documentoNormalizado.length === 0;`;
const replacementStr = `      const isForeign = (documentoNormalizado.length === 0 || uf === "EX" || cep === "00000000");`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('services/notafiscalService.js', code);
    console.log("Updated isForeign logic in notafiscalService.js");
} else {
    // maybe it was replaced earlier?
    console.log("String not found, assuming already updated or different format.");
}
