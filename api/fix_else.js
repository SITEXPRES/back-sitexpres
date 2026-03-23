import fs from 'fs';
let code = fs.readFileSync('controllers/paypalController.js', 'utf8');

const buggyBlock = `
            } catch (emailErr) {} } 

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
        ); else {`;

code = code.replace(buggyBlock, `            } catch (emailErr) {}
        } else {`);

fs.writeFileSync('controllers/paypalController.js', code);
console.log('Fixed else syntax error');
