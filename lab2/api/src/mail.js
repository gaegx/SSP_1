import nodemailer from 'nodemailer';
import { logger } from './logger.js';

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST || 'localhost';
  const smtpPort = Number(process.env.SMTP_PORT) || 1025;
  const smtpUser = (process.env.SMTP_USER || '').trim();
 //aaaaa
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (smtpUser && smtpPass && smtpHost.includes('gmail')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
    });
  }

  const options = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  };

  if (smtpPort === 587) {
    options.requireTLS = true;
  }

  return nodemailer.createTransport(options);
}

function buildResetHtml(resetUrl) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Сброс пароля</title>
</head>
<body style="margin:0;padding:0;background:#ebe7df;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ebe7df;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 40px rgba(20,32,27,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f7a5f 0%,#0b624c 100%);padding:28px 32px;">
              <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.75);font-weight:600;">Freelance Desk</p>
              <h1 style="margin:8px 0 0;font-size:26px;line-height:1.25;color:#ffffff;font-weight:700;">Восстановление доступа</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#14201b;">
                Здравствуйте! Мы получили запрос на сброс пароля для вашего аккаунта.
              </p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.55;color:#5f6f68;">
                Нажмите кнопку ниже, чтобы задать новый пароль. Ссылка действует <strong style="color:#14201b;">1 час</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 28px;">
                <tr>
                  <td align="center" style="border-radius:999px;background:#0f7a5f;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">
                      Сбросить пароль
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5f6f68;">
                Если кнопка не работает, скопируйте ссылку в браузер:
              </p>
              <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${resetUrl}" style="color:#0f7a5f;text-decoration:underline;">${resetUrl}</a>
              </p>
              <div style="border-top:1px solid #d9d3c8;padding-top:20px;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#5f6f68;">
                  Не запрашивали сброс? Просто проигнорируйте это письмо — пароль останется прежним.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#faf9f6;padding:18px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#5f6f68;">
                Freelance Desk · биржа заказов
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(to, resetUrl) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@freelancedesk.local';
  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from: `"Freelance Desk" <${from}>`,
      to,
      subject: 'Сброс пароля — Freelance Desk',
      text: [
        'Восстановление доступа — Freelance Desk',
        '',
        'Мы получили запрос на сброс пароля.',
        'Перейдите по ссылке (действует 1 час):',
        resetUrl,
        '',
        'Если вы не запрашивали сброс — просто проигнорируйте это письмо.',
      ].join('\n'),
      html: buildResetHtml(resetUrl),
    });
    logger.info({ to, messageId: info.messageId }, 'password_reset_email_sent');
    return info;
  } catch (err) {
    logger.error(
      {
        code: err.code,
        responseCode: err.responseCode,
        command: err.command,
        message: err.message,
      },
      'password_reset_email_failed',
    );
    throw err;
  }
}
