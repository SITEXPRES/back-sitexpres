import fs from 'fs';

let interCode = fs.readFileSync('controllers/InterControllers.js', 'utf8');

if (!interCode.includes('buildStyledEmail')) {
    interCode = interCode.replace('import pool from "../config/db.js";', 'import pool from "../config/db.js";\r\nimport { buildStyledEmail } from "../services/emailTemplateBuilder.js";');
}

if (!interCode.includes('✅ Novo Pix e Nota Fiscal Gerada - ${result.rows[0].name}')) {
    const adminSuccess = `
            if (notaFiscal.sucesso) {
                try {
                    await sendMail(
                        "contato@sitexpres.com",
                        \`✅ Novo Pix e Nota Fiscal Gerada - \${result.rows[0].name}\`,
                        \`O Pix de \${result.rows[0].name} foi confirmado!<br>
                        Valor: R$ \${valorPagamento}<br>
                        A nota fiscal foi emitida com sucesso!<br>
                        Chave de Acesso: <b>\${chaveAcesso}</b><br>
                        Link de Consulta: <a href="\${linkNF}">\${linkNF}</a>\`
                    );
                } catch (emailErr) {}
            }
`;
    interCode = interCode.replace('console.log("Link da Nota Fiscal salva:", linkNF);', adminSuccess + '            console.log("Link da Nota Fiscal salva:", linkNF);');
}

fs.writeFileSync('controllers/InterControllers.js', interCode);

let paypalCode = fs.readFileSync('controllers/paypalController.js', 'utf8');

if (!paypalCode.includes('buildStyledEmail')) {
    paypalCode = paypalCode.replace('import pool from "../config/db.js";', 'import pool from "../config/db.js";\r\nimport { buildStyledEmail } from "../services/emailTemplateBuilder.js";');
}

fs.writeFileSync('controllers/paypalController.js', paypalCode);
console.log('Fixed imports and missing admin email');
