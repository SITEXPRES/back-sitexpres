import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true se usar 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  },
  logger: true,
  debug: true
});

export const sendMail = async (to, assunto, mensagem) => {
  /* const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`; */

  const fromAddress = process.env.MAIL_FROM || process.env.EMAIL_USER;

  const mailOptions = {
    from: '"Sitexpres" <' + fromAddress + '>',
    to: to,
    subject: assunto,
    html: mensagem,
    text: mensagem.replace(/<[^>]*>?/gm, '') // Remove tags HTML rudimentar para fazer o texto plano
  };

  try {
      console.log(`⏳ Enviando e-mail para ${to} (Assunto: ${assunto})...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ E-mail enviado com sucesso para ${to}. ID: ${info.messageId}`);
  } catch (err) {
      console.error(`❌ Falha no disparo do e-mail para ${to}:`, err);
      throw err;
  }
};
