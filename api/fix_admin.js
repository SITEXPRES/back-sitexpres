import fs from 'fs';

let interCode = fs.readFileSync('controllers/InterControllers.js', 'utf8');

const oldAdminBlock = `                    sendMail(
                        "contato@sitexpres.com",
                        \`✅ Novo Pix e Nota Fiscal Gerada - \${result.rows[0].name}\`,
                        \`O Pix de \${result.rows[0].name} foi confirmado.<br>
                        Valor: R$ \${valorPagamento}<br>
                        A nota fiscal foi emitida com sucesso!<br>
                        Link de Consulta: <a href="\${linkNF}">\${linkNF}</a>\`
                    );`;

const newAdminBlock = `                    sendMail(
                        "contato@sitexpres.com",
                        \`✅ Novo Pix e Nota Fiscal Gerada - \${result.rows[0].name}\`,
                        \`O Pix de \${result.rows[0].name} foi confirmado!<br>
                        Valor: R$ \${valorPagamento}<br>
                        A nota fiscal foi emitida com sucesso!<br>
                        Chave de Acesso: <b>\${chaveAcesso}</b><br>
                        Link de Consulta: <a href="\${linkNF}">\${linkNF}</a>\`
                    );`;

if (interCode.includes(oldAdminBlock)) {
    interCode = interCode.replace(oldAdminBlock, newAdminBlock);
    fs.writeFileSync('controllers/InterControllers.js', interCode);
    console.log("Fixed Admin email in InterControllers.");
} else {
    // maybe whitespace difference
    if (!interCode.includes("Chave de Acesso: <b>${chaveAcesso}</b><br>")) {
         // fallback replace using a simple regex to match the old block
         const regex = /O Pix de \${result\.rows\[0\]\.name} foi confirmado\.<br>\s*Valor: R\$ \${valorPagamento}<br>\s*A nota fiscal foi emitida com sucesso!<br>\s*Link de Consulta: <a href="\${linkNF}">\${linkNF}<\/a>/g;
         interCode = interCode.replace(regex, `O Pix de \${result.rows[0].name} foi confirmado!<br>
                        Valor: R$ \${valorPagamento}<br>
                        A nota fiscal foi emitida com sucesso!<br>
                        Chave de Acesso: <b>\${chaveAcesso}</b><br>
                        Link de Consulta: <a href="\${linkNF}">\${linkNF}</a>`);
         fs.writeFileSync('controllers/InterControllers.js', interCode);
         console.log("Fixed Admin email in InterControllers via regex.");
    } else {
        console.log("It was already fixed.");
    }
}
