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
  }
});

export const sendMail = async (to, assunto, mensagem) => {
  /* const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`; */


  const mailOptions = {
    from: 'Sitexpress <' + process.env.MAIL_FROM + '>',
    to: to,
    subject: assunto,
    html: mensagem,
    text: mensagem.replace(/<[^>]*>?/gm, '') // Remove tags HTML rudimentar para fazer o texto plano
  };

  await transporter.sendMail(mailOptions);
};
