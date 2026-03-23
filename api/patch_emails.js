import fs from 'fs';

let pxCode = fs.readFileSync('controllers/InterControllers.js', 'utf8');
let pyCode = fs.readFileSync('controllers/paypalController.js', 'utf8');

// --- INTER ---
const interTarget = \`                // Enviar email para o cliente com a nota fiscal
                try {
                    const clientHtml = buildStyledEmail(
                        "Sua Nota Fiscal foi gerada! 📄",
                        result.rows[0].name,
                        \\`<p class="email-text">Sua Nota Fiscal de Serviços Eletrônica (NFS-e) foi emitida com sucesso!</p>
                         <p class="email-text">Você pode consultar e baixar o PDF da sua nota no portal oficial do governo.<br>
                         Para isso, <b>copie a Chave de Acesso abaixo</b> e cole na seguinte página:</p>
                         <div class="chave-box">\${chaveAcesso}</div>
                         <p class="email-text"><a href="\${linkNF}">\${linkNF}</a></p>\\`,
                        "Consultar NFS-e",
                        linkNF
                    );

                    await sendMail(
                        result.rows[0].email,
                        "📄 Sua Nota Fiscal foi gerada!",
                        clientHtml
                    );\`;

const interReplace = \`                // Enviar email para o cliente com a nota fiscal
                try {
                    const isForeign = (result.rows[0].uf === "EX" || result.rows[0].cep === "00000000");
                    let clientTheme = {
                        title: "Sua Nota Fiscal foi gerada! 📄",
                        subject: "📄 Sua Nota Fiscal foi gerada!",
                        text1: "Sua Nota Fiscal de Serviços Eletrônica (NFS-e) foi emitida com sucesso!",
                        text2: "Você pode consultar e baixar o PDF da sua nota no portal oficial do governo.<br>Para isso, <b>copie a Chave de Acesso abaixo</b> e cole na seguinte página:",
                        btn: "Consultar NFS-e"
                    };
                    if (isForeign) {
                        clientTheme = {
                            title: "Your Invoice has been generated! 📄",
                            subject: "📄 Your Invoice has been generated!",
                            text1: "Your Commercial Invoice (NFS-e) has been successfully issued!",
                            text2: "You can view and download the PDF of your invoice on the official government portal.<br>To do so, <b>copy the Access Key below</b> and paste it on the following page:",
                            btn: "View Invoice"
                        };
                    }

                    const clientHtml = buildStyledEmail(
                        clientTheme.title,
                        result.rows[0].name,
                        \\`<p class="email-text">\${clientTheme.text1}</p>
                         <p class="email-text">\${clientTheme.text2}</p>
                         <div class="chave-box">\${chaveAcesso}</div>
                         <p class="email-text"><a href="\${linkNF}">\${linkNF}</a></p>\\`,
                        clientTheme.btn,
                        linkNF
                    );

                    await sendMail(result.rows[0].email, clientTheme.subject, clientHtml);\`;

if (pxCode.includes('Sua Nota Fiscal de Serviços Eletrônica (NFS-e) foi emitida com sucesso!</p>')) {
    pxCode = pxCode.replace(interTarget, interReplace);
    console.log("Inter client email patched");
}

const interAdminTarget = \`            if (notaFiscal.sucesso) {
                try {
                    await sendMail(
                        "contato@sitexpres.com",
                        \\`✅ Novo Pix e Nota Fiscal Gerada - \${result.rows[0].name}\\`,
                        \\`O Pix de \${result.rows[0].name} foi confirmado!<br>
                        Valor: R$ \${valorPagamento}<br>
                        A nota fiscal foi emitida com sucesso!<br>
                        Chave de Acesso: <b>\${chaveAcesso}</b><br>
                        Link de Consulta: <a href="\${linkNF}">\${linkNF}</a>\\`
                    );
                } catch (emailErr) {}
            }\`;

const interAdminReplace = \`            if (notaFiscal.sucesso) {
                try {
                    const isForeign = (result.rows[0].uf === "EX" || result.rows[0].cep === "00000000");
                    
                    let subjectAdmin = \\`✅ Novo Pix e Nota Fiscal Gerada - \${result.rows[0].name}\\`;
                    let bodyAdmin = \\`O Pix de \${result.rows[0].name} foi confirmado!<br>
                        Valor: R$ \${valorPagamento}<br>
                        A nota fiscal foi emitida com sucesso!<br>
                        Chave de Acesso: <b>\${chaveAcesso}</b><br>
                        Link de Consulta: <a href="\${linkNF}">\${linkNF}</a>\\`;
                        
                    if (isForeign) {
                        subjectAdmin = \\`✅ [GRINGO] Novo Pix Exportação - \${result.rows[0].name}\\`;
                        bodyAdmin = \\`<b>⚠️ PAGAMENTO DE CLIENTE GRINGO (EXTERIOR)</b><br><br>\\` + bodyAdmin;
                    }
                    
                    await sendMail("contato@sitexpres.com", subjectAdmin, bodyAdmin);
                } catch (emailErr) {}
            }\`;

if (pxCode.includes('✅ Novo Pix e Nota Fiscal Gerada')) {
    pxCode = pxCode.replace(interAdminTarget, interAdminReplace);
    console.log("Inter admin email patched");
}

// --- PAYPAL DOMINIO ---
const pyDomTarget = \`            try {
                const clientHtml = buildStyledEmail(
                    "Sua Nota Fiscal foi gerada! 📄",
                    result_user.rows[0].name,
                    \\`<p class="email-text">Sua Nota Fiscal de Serviços Eletrônica (NFS-e) para o domínio \${transacao.full_domain} foi emitida com sucesso!</p>
                     <p class="email-text">Para consultar ou baixar o PDF, <b>copie a Chave de Acesso abaixo</b> e acesse a página oficial do governo:</p>
                     <div class="chave-box">\${chaveAcesso}</div>
                     <p class="email-text"><a href="\${linkNF}">\${linkNF}</a></p>\\`,
                    "Consultar NFS-e",
                    linkNF
                );

                await sendMail(
                    result_user.rows[0].email,
                    "📄 Sua Nota Fiscal foi gerada!",
                    clientHtml
                );\`;

const pyDomReplace = \`            try {
                const isForeign = (result_user.rows[0].uf === "EX" || result_user.rows[0].cep === "00000000");
                let clientTheme = {
                    title: "Sua Nota Fiscal foi gerada! 📄",
                    subject: "📄 Sua Nota Fiscal foi gerada!",
                    text1: \\`Sua Nota Fiscal de Serviços Eletrônica (NFS-e) para o domínio \${transacao.full_domain} foi emitida com sucesso!\\`,
                    text2: "Para consultar ou baixar o PDF, <b>copie a Chave de Acesso abaixo</b> e acesse a página oficial do governo:",
                    btn: "Consultar NFS-e"
                };
                if (isForeign) {
                    clientTheme = {
                        title: "Your Invoice has been generated! 📄",
                        subject: "📄 Your Invoice has been generated!",
                        text1: \\`Your Commercial Invoice (NFS-e) for the domain \${transacao.full_domain} has been successfully issued!\\`,
                        text2: "To view or download the PDF of your invoice, <b>copy the Access Key below</b> and paste it on the official government page:",
                        btn: "View Invoice"
                    };
                }

                const clientHtml = buildStyledEmail(
                    clientTheme.title,
                    result_user.rows[0].name,
                    \\`<p class="email-text">\${clientTheme.text1}</p>
                     <p class="email-text">\${clientTheme.text2}</p>
                     <div class="chave-box">\${chaveAcesso}</div>
                     <p class="email-text"><a href="\${linkNF}">\${linkNF}</a></p>\\`,
                    clientTheme.btn,
                    linkNF
                );

                await sendMail(result_user.rows[0].email, clientTheme.subject, clientHtml);\`;

if (pyCode.includes('NFS-e) para o domínio')) {
    pyCode = pyCode.replace(pyDomTarget, pyDomReplace);
    console.log("Paypal domain client email patched");
}

const pyAdminDomTarget = \`        // Envia notificação ao ADM com chave
        sendMail(
            "contato@sitexpres.com",
            \\`✅ \${transactionDetails.resource.description} Pago (PayPal)\\`,
            \\`<p>Um novo plano/crédito foi pago via PayPal!</p>
             <p><b>Cliente:</b> \${result_user.rows[0].name} (\${result_user.rows[0].email})</p>
             <p><b>Descrição:</b> \${transactionDetails.resource.description}</p>
             <p><b>Valor:</b> \${transactionDetails.resource.amount.total} \${transactionDetails.resource.amount.currency}</p>
             <p><b>Transação:</b> \${transactionId}</p>
             <p><b>ID Assinatura:</b> \${subscriptionId}</p>
             \${notaFiscal.sucesso ? \\`<p><b>Chave da NFS-e:</b> \${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href="\${linkNF}">\${linkNF}</a></p>\\` : \\`<p><b>Nota Fiscal:</b> Falha na geração.</p>\\`}\\`
        );\`;

const pyAdminDomReplace = \`        // Envia notificação ao ADM com chave
        let isForeignAdmin = (result_user.rows[0].uf === "EX" || result_user.rows[0].cep === "00000000");
        let subj = isForeignAdmin ? \\`✅ [GRINGO] \${transactionDetails.resource.description} Pago (PayPal)\\` : \\`✅ \${transactionDetails.resource.description} Pago (PayPal)\\`;
        let pbody = \\`<p>Um novo plano/crédito foi pago via PayPal!</p>
             <p><b>Cliente:</b> \${result_user.rows[0].name} (\${result_user.rows[0].email})</p>
             <p><b>Descrição:</b> \${transactionDetails.resource.description}</p>
             <p><b>Valor:</b> \${transactionDetails.resource.amount.total} \${transactionDetails.resource.amount.currency}</p>
             <p><b>Transação:</b> \${transactionId}</p>
             <p><b>ID Assinatura:</b> \${subscriptionId}</p>
             \${notaFiscal.sucesso ? \\`<p><b>Chave da NFS-e:</b> \${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href="\${linkNF}">\${linkNF}</a></p>\\` : \\`<p><b>Nota Fiscal:</b> Falha na geração.</p>\\`}\\`;
        
        if (isForeignAdmin) pbody = \\`<b>⚠️ PAGAMENTO DE CLIENTE GRINGO (EXTERIOR)</b><br><br>\\` + pbody;
             
        sendMail("contato@sitexpres.com", subj, pbody);\`;

if (pyCode.includes('Pago (PayPal)')) {
    pyCode = pyCode.replace(pyAdminDomTarget, pyAdminDomReplace);
    console.log("Paypal domain admin email patched");
}

// --- PAYPAL CREDITS ---
const pyCredTarget = \`            try {
                const clientHtml = buildStyledEmail(
                    "Sua Nota Fiscal foi gerada! 📄",
                    result.rows[0].name,
                    \\`<p class="email-text">Sua Nota Fiscal de Serviços Eletrônica (NFS-e) referente ao seu pagamento via PayPal foi emitida com sucesso!</p>
                     <p class="email-text">Para consultar ou baixar o PDF, <b>copie a Chave de Acesso abaixo</b> e acesse a página oficial do governo:</p>
                     <div class="chave-box">\${chaveAcesso}</div>
                     <p class="email-text"><a href="\${linkNF}">\${linkNF}</a></p>\\`,
                    "Consultar NFS-e",
                    linkNF
                );
                await sendMail(result.rows[0].email, "📄 Sua Nota Fiscal foi gerada!", clientHtml);\`;

const pyCredReplace = \`            try {
                const isForeign = (result.rows[0].uf === "EX" || result.rows[0].cep === "00000000");
                let clientTheme = {
                    title: "Sua Nota Fiscal foi gerada! 📄",
                    subject: "📄 Sua Nota Fiscal foi gerada!",
                    text1: "Sua Nota Fiscal de Serviços Eletrônica (NFS-e) referente ao seu pagamento via PayPal foi emitida com sucesso!",
                    text2: "Para consultar ou baixar o PDF, <b>copie a Chave de Acesso abaixo</b> e acesse a página oficial do governo:",
                    btn: "Consultar NFS-e"
                };
                if (isForeign) {
                    clientTheme = {
                        title: "Your Invoice has been generated! 📄",
                        subject: "📄 Your Invoice has been generated!",
                        text1: "Your Commercial Invoice (NFS-e) for your PayPal payment has been successfully issued!",
                        text2: "To view or download the PDF of your invoice, <b>copy the Access Key below</b> and paste it on the official government page:",
                        btn: "View Invoice"
                    };
                }

                const clientHtml = buildStyledEmail(
                    clientTheme.title,
                    result.rows[0].name,
                    \\`<p class="email-text">\${clientTheme.text1}</p>
                     <p class="email-text">\${clientTheme.text2}</p>
                     <div class="chave-box">\${chaveAcesso}</div>
                     <p class="email-text"><a href="\${linkNF}">\${linkNF}</a></p>\\`,
                    clientTheme.btn,
                    linkNF
                );
                await sendMail(result.rows[0].email, clientTheme.subject, clientHtml);\`;

if (pyCode.includes('NFS-e) referente ao seu pagamento via PayPal')) {
    pyCode = pyCode.replace(pyCredTarget, pyCredReplace);
    console.log("Paypal credits client email patched");
}

const pyAdminCredTarget = \`        // Envia notificação ao ADM com chave
        sendMail(
            "contato@sitexpres.com",
            \\`✅ \${transactionDetails.resource.description} Pago (PayPal)\\`,
            \\`<p>Um novo plano/crédito foi pago via PayPal!</p>
             <p><b>Cliente:</b> \${result.rows[0].name} (\${result.rows[0].email})</p>
             <p><b>Descrição:</b> \${transactionDetails.resource.description}</p>
             <p><b>Valor:</b> \${transactionDetails.resource.amount.total} \${transactionDetails.resource.amount.currency}</p>
             <p><b>Transação:</b> \${transactionId}</p>
             <p><b>ID Assinatura:</b> \${subscriptionId}</p>
             \${notaFiscal.sucesso ? \\`<p><b>Chave da NFS-e:</b> \${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href="\${linkNF}">\${linkNF}</a></p>\\` : \\`<p><b>Nota Fiscal:</b> Falha na geração.</p>\\`}\\`
        );\`;

const pyAdminCredReplace = \`        // Envia notificação ao ADM com chave
        let isForeignAdminCred = (result.rows[0].uf === "EX" || result.rows[0].cep === "00000000");
        let subjCred = isForeignAdminCred ? \\`✅ [GRINGO] \${transactionDetails.resource.description} Pago (PayPal)\\` : \\`✅ \${transactionDetails.resource.description} Pago (PayPal)\\`;
        let pbodyCred = \\`<p>Um novo plano/crédito foi pago via PayPal!</p>
             <p><b>Cliente:</b> \${result.rows[0].name} (\${result.rows[0].email})</p>
             <p><b>Descrição:</b> \${transactionDetails.resource.description}</p>
             <p><b>Valor:</b> \${transactionDetails.resource.amount.total} \${transactionDetails.resource.amount.currency}</p>
             <p><b>Transação:</b> \${transactionId}</p>
             <p><b>ID Assinatura:</b> \${subscriptionId}</p>
             \${notaFiscal.sucesso ? \\`<p><b>Chave da NFS-e:</b> \${chaveAcesso}</p><p><b>Link de Consulta:</b> <a href="\${linkNF}">\${linkNF}</a></p>\\` : \\`<p><b>Nota Fiscal:</b> Falha na geração.</p>\\`}\\`;
             
        if (isForeignAdminCred) pbodyCred = \\`<b>⚠️ PAGAMENTO DE CLIENTE GRINGO (EXTERIOR)</b><br><br>\\` + pbodyCred;

        sendMail("contato@sitexpres.com", subjCred, pbodyCred);\`;

if (pyCode.includes('Pago (PayPal)')) {
    pyCode = pyCode.replace(pyAdminCredTarget, pyAdminCredReplace);
    console.log("Paypal credits admin email patched");
}

fs.writeFileSync('controllers/InterControllers.js', pxCode);
fs.writeFileSync('controllers/paypalController.js', pyCode);
