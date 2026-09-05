const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Must exactly match the address you verified under Settings > Sender
// Authentication > Verify a Single Sender in the SendGrid dashboard -
// SendGrid rejects sends from any address that isn't verified.
const FROM_ADDRESS = process.env.SENDGRID_FROM_EMAIL;

// Sends the "reset your password" email. Kept as its own function (rather
// than inlined in the controller) so the email template and the provider
// can both be swapped later without touching authController.js.
//
// Uses SendGrid's HTTPS API rather than SMTP on purpose: raw SMTP (e.g.
// Gmail) frequently hangs or gets silently blocked when sent FROM cloud
// hosting IPs (Railway, AWS, etc.) due to email providers' anti-abuse IP
// reputation systems - an HTTPS API call sidesteps that entirely.
const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #2563eb; border-radius: 12px;">
          <span style="color: #fff; font-size: 22px; font-weight: 700;">S</span>
        </div>
      </div>
      <h2 style="color: #111827; font-size: 18px; text-align: center; margin: 0 0 8px;">
        Reset your password
      </h2>
      <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0 0 24px;">
        Hi ${name || "there"}, we received a request to reset the password for your SalesHub account.
      </p>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${resetUrl}"
           style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; padding: 12px 32px; border-radius: 999px;">
          Reset password
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0 0 4px;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; word-break: break-all;">
        Or paste this link into your browser: ${resetUrl}
      </p>
    </div>
  `;

  // A plain-text alternative alongside the HTML version - HTML-only emails
  // are a mild spam signal on their own, multipart (text + html) is the
  // standard, more-trusted format. Doesn't fix the underlying Gmail-address
  // spoofing signal below, but it's a legitimate small improvement.
  const text = `Reset your SalesHub password

Hi ${name || "there"}, we received a request to reset the password for your SalesHub account.

Reset it here: ${resetUrl}

This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;

  await sgMail.send({
    text,
    to,
    from: FROM_ADDRESS,
    subject: "Reset your SalesHub password",
    html,
  });
};

module.exports = { sendPasswordResetEmail };
