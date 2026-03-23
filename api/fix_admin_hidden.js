import fs from 'fs';

let interCode = fs.readFileSync('controllers/InterControllers.js', 'utf8');

const targetString = "${linkNF ? `<p><b>Link Nota Fiscal:</b> <a href=\"${linkNF}\">${linkNF}</a></p>` : ''}`";
const replaceString = "${notaFiscal.sucesso ? `<p><b>Chave de Acesso:</b> ${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href=\"${linkNF}\">${linkNF}</a></p>` : ''}`";

if (interCode.includes(targetString)) {
    interCode = interCode.replace(targetString, replaceString);
    fs.writeFileSync('controllers/InterControllers.js', interCode);
    console.log("Admin email text replaced successfully.");
} else {
    // try a regex approach if it contains line breaks or spaces
    const re = /\$\{linkNF \? `<p><b>Link Nota Fiscal:<\/b> <a href="\$\{linkNF\}">\$\{linkNF\}<\/a><\/p>` : ''\}`/g;
    if (re.test(interCode)) {
        interCode = interCode.replace(re, replaceString);
        fs.writeFileSync('controllers/InterControllers.js', interCode);
        console.log("Admin email text replaced via regex.");
    } else {
        console.log("Target string not found anywhere! Check manual view file.");
    }
}
