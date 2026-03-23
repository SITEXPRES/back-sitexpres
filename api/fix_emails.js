import fs from 'fs';

let interCode = fs.readFileSync('controllers/InterControllers.js', 'utf8');

if(!interCode.includes('buildStyledEmail')) {
    interCode = interCode.replace('import { gerarNotaNacional } from "../services/notafiscalService.js";', 'import { gerarNotaNacional } from "../services/notafiscalService.js";\r\nimport { buildStyledEmail } from "../services/emailTemplateBuilder.js";');
}

// InterControllers: Remove old admin email that lacked the key
interCode = interCode.replace(/sendMail\(\s*"contato@sitexpres\.com",\s*`✅ Novo Pix e Nota Fiscal Gerada - \${result\.rows\[0\]\.name}`,\s*`O Pix de \${result\.rows\[0\]\.name} foi confirmado\.<br>[\s\S]*?Link de Consulta:[^`]*`\s*\);/g, 
`// Removido envio duplicado sem a chave (o envio agora ocorre no final com a chave)`);

if(interCode.includes('🚨 ERRO ao Gerar Nota Fiscal (Pix)')){
    // Adds the new Admin email under the error catch
    const newAdminSuccess = `
            if (notaFiscal.sucesso) {
                try {
                    await sendMail(
                        "contato@sitexpres.com",
                        \`✅ Novo Pix e Nota Fiscal Gerada - \${result.rows[0].name}\`,
                        \`O Pix de \${result.rows[0].name} foi confirmado!<br><br>
                        Valor: R$ \${valorPagamento}<br>
                        A nota fiscal foi emitida com sucesso!<br>
                        Chave de Acesso: <b>\${chaveAcesso}</b><br>
                        Link de Consulta: <a href="\${linkNF}">\${linkNF}</a>\`
                    );
                } catch (emailErr) {}
            }`;

    if (!interCode.includes('Novo Pix e Nota Fiscal Gerada - ${result.rows[0].name}')) {
        interCode = interCode.replace(/}\s*catch\s*\(emailErr\)\s*{\s*console.error\("Erro ao notificar falha na nf",\s*emailErr\);\s*}\s*}/g,
            '} catch (emailErr) { console.error("Erro ao notificar falha na nf", emailErr); } }' + newAdminSuccess);
    }
}

fs.writeFileSync('controllers/InterControllers.js', interCode);

let paypalCode = fs.readFileSync('controllers/paypalController.js', 'utf8');
if(!paypalCode.includes('buildStyledEmail')) {
    paypalCode = paypalCode.replace('import { gerarNotaNacional } from "../services/notafiscalService.js";', 'import { gerarNotaNacional } from "../services/notafiscalService.js";\r\nimport { buildStyledEmail } from "../services/emailTemplateBuilder.js";');
}

// Remove old pending admin notifications that lacked keys
paypalCode = paypalCode.replace(/\/\/ Email para o admin\s*sendMail\(\s*"contato@sitexpres\.com",\s*"✅ Novo Domínio Registrado e Pago \(PayPal\)",[\s\S]*?Link Nota Fiscal:[^`]*`\s*\);/g, `// (Notificação Admin movida para depois)`);

paypalCode = paypalCode.replace(/\/\/ Email do site para adm\s*sendMail\(\s*"contato@sitexpres\.com",\s*`✅ \${transactionDetails\.resource\.description} Pago \(PayPal\)`,\s*`Um novo plano\/crédito foi pago via PayPal!<br>[\s\S]*?Link Nota Fiscal:[^`]*`\s*\);/g, `// (Notificação Admin movida para depois)`);
paypalCode = paypalCode.replace(/sendMail\(\s*"contato@sitexpres\.com",\s*`✅ \${transactionDetails\.resource\.description} Pago \(PayPal\)`,\s*`Um novo plano\/crédito foi pago via PayPal![\s\S]*?Link Nota Fiscal:[^`]*`\s*\);/g, `// (Notificação Admin movida para depois)`);

// Apply Credit Client Email
const oldCreditClientEmailRegex = /sendMail\(\s*result.rows\[0\].email,\s*"📄 Sua Nota Fiscal foi gerada!",\s*`<p>Olá \${result.rows\[0\].name},<\/p>[\s\S]*?<a href="\${linkNF}">\${linkNF}<\/a><\/p>`\s*\);/g;

paypalCode = paypalCode.replace(oldCreditClientEmailRegex, `
                const clientHtml = buildStyledEmail(
                    "Sua Nota Fiscal foi gerada! 📄",
                    result.rows[0].name,
                    \`<p class="email-text">Sua Nota Fiscal de Serviços Eletrônica (NFS-e) referente ao seu pagamento via PayPal foi emitida com sucesso!</p>
                     <p class="email-text">Para consultar ou baixar o PDF, <b>copie a Chave de Acesso abaixo</b> e acesse a página oficial do governo:</p>
                     <div class="chave-box">\${chaveAcesso}</div>
                     <p class="email-text"><a href="\${linkNF}">\${linkNF}</a></p>\`,
                    "Consultar NFS-e",
                    linkNF
                );
                await sendMail(result.rows[0].email, "📄 Sua Nota Fiscal foi gerada!", clientHtml);
`);

// Add Admin Credit Success Notification Context safely after the credit transaction logic
if(!paypalCode.includes('Chave da NFS-e: ${chaveAcesso}')) {
    const adminCreditEmail = `
        // Envia notificação ao ADM com chave
        sendMail(
            "contato@sitexpres.com",
            \`✅ \${transactionDetails.resource.description} Pago (PayPal)\`,
            \`<p>Um novo plano/crédito foi pago via PayPal!</p>
             <p><b>Cliente:</b> \${result.rows[0].name} (\${result.rows[0].email})</p>
             <p><b>Descrição:</b> \${transactionDetails.resource.description}</p>
             <p><b>Valor:</b> \${transactionDetails.resource.amount.total} \${transactionDetails.resource.amount.currency}</p>
             <p><b>Transação:</b> \${transactionId}</p>
             <p><b>ID Assinatura:</b> \${subscriptionId}</p>
             \${notaFiscal.sucesso ? \`<p><b>Chave da NFS-e:</b> \${chaveAcesso}</p><p><b>Link da Nota Fiscal:</b> <a href="\${linkNF}">\${linkNF}</a></p>\` : \`<p><b>Nota Fiscal:</b> Falha na geração.</p>\`}\`
        );`;
        
    paypalCode = paypalCode.replace(/} catch \(emailErr\) {}\s*}/g, `} catch (emailErr) {} } \n` + adminCreditEmail);
}

fs.writeFileSync('controllers/paypalController.js', paypalCode);
console.log('Fixed');
