import nodemailer from 'nodemailer';
import { logger } from './logger.js';

const smtpHost = process.env.SMTP_HOST || 'localhost';
const smtpPort = Number(process.env.SMTP_PORT) || 1025;
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const from = process.env.MAIL_FROM || smtpUser || 'noreply@freelancedesk.local';

const transportOptions = {
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  tls: { rejectUnauthorized: false },
};

if (smtpUser && smtpPass) {
  transportOptions.auth = {
    user: smtpUser,
    pass: smtpPass,
  };
}

const transporter = nodemailer.createTransport(transportOptions);

export async function sendPasswordResetEmail(to, resetUrl) {
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Восстановление доступа — Freelance Desk',
    text: `Сброс пароля: перейдите по ссылке (действует 1 час):\n\n${resetUrl}\n\nЕсли вы не запрашивали сброс — игнорируйте письмо.`,
    html: `<p>Сброс пароля для Freelance Desk.</p><p><a href="${resetUrl}">Сбросить пароль</a></p><p>Ссылка действует 1 час.</p>`,
  });
  logger.info({ to, messageId: info.messageId }, 'password_reset_email_sent');
  return info;
}
