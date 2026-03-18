const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function createTransport() {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized:
        String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false',
    },
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const transporter = createTransport();
  if (!transporter) {
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const logoPath = path.resolve(__dirname, '../../frontend/src/images/image.png');
  const hasLogo = fs.existsSync(logoPath);

  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your Sa7a7ly password',
    text: [
      'Sa7a7ly Password Reset',
      '',
      'We received a request to reset your password.',
      `Reset your password using this link: ${resetUrl}`,
      '',
      'This link will expire in 30 minutes.',
      'Do not share this link with anyone.',
      'If you did not request this reset, you can safely ignore this email.',
    ].join('\n'),
    html: `
      <div style="margin: 0; padding: 24px; background: #f8fafc; font-family: Arial, sans-serif; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden;">
          <div style="padding: 28px 32px; background: linear-gradient(135deg, #0f172a 0%, #065f46 100%); color: #ffffff; text-align: center;">
            ${
              hasLogo
                ? '<img src="cid:sa7a7ly-logo" alt="Sa7a7ly" style="width: 72px; height: 72px; object-fit: contain; border-radius: 18px; background: rgba(255,255,255,0.12); padding: 10px;" />'
                : ''
            }
            <p style="margin: 14px 0 0; font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; color: #a7f3d0;">Sa7a7ly</p>
            <h1 style="margin: 10px 0 0; font-size: 28px; line-height: 1.2;">Reset your password</h1>
          </div>

          <div style="padding: 32px;">
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7;">
              We received a request to reset the password for your Sa7a7ly account.
            </p>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.7;">
              Click the button below to choose a new password. This reset link will expire in <strong>30 minutes</strong>.
            </p>

            <div style="margin: 0 0 28px; text-align: center;">
              <a
                href="${resetUrl}"
                style="display: inline-block; padding: 14px 24px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 700;"
              >
                Reset Password
              </a>
            </div>

            <div style="margin: 0 0 24px; padding: 16px 18px; border: 1px solid #fecaca; background: #fff1f2; border-radius: 12px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #991b1b;">
                <strong>Security notice:</strong> Do not share this reset link with anyone. Anyone with access to this link can change your password.
              </p>
            </div>

            <p style="margin: 0 0 8px; font-size: 14px; color: #475569;">If the button does not work, copy and paste this link into your browser:</p>
            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.7; word-break: break-word;">
              <a href="${resetUrl}" style="color: #047857;">${resetUrl}</a>
            </p>

            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">
              If you did not request a password reset, you can safely ignore this email.
            </p>
          </div>
        </div>
      </div>
    `,
    attachments: hasLogo
      ? [
          {
            path: logoPath,
            cid: 'sa7a7ly-logo',
            contentDisposition: 'inline',
            contentType: 'image/png',
          },
        ]
      : [],
  });

  return true;
}

module.exports = {
  isSmtpConfigured,
  sendPasswordResetEmail,
};
