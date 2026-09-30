import nodemailer from 'nodemailer';

async function testEmail() {
    const transporter = nodemailer.createTransport({
        host: 'mail.sitexpres.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: 'naoresponda@sitexpres.com',
            pass: 'tQzX6kMg8dpvJBgUfqzz'
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log("Testando conexão SMTP...");
        const success = await transporter.verify();
        if (success) {
            console.log("✅ Conexão com o servidor de e-mail realizada com sucesso!");
        }
    } catch (error) {
        console.error("❌ Falha na conexão com o e-mail:");
        console.error(error);
    }
}
testEmail();
