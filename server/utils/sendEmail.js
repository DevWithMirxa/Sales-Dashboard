const nodemailer = require("nodemailer");

// Free option: sends through your own Gmail account via SMTP, using a
// Gmail "App Password" (NOT your normal Google password - see setup notes).
// Unlike Resend's unverified/sandbox mode, this works for ANY recipient
// with no domain purchase or DNS verification required. Free up to Gmail's
// own sending limits (~500/day on a regular account, 2000/day on Google
// Workspace) - far more than a password-reset flow will ever need.
// Built lazily (inside sendPasswordResetEmail, not here at module-load
// time) so it always reads process.env.GMAIL_USER / GMAIL_APP_PASSWORD
// AFTER dotenv has had a chance to run - if this module gets require()'d
// before your entry file calls dotenv.config(), building the transporter
// here would permanently bake in `undefined` credentials, which is what
// produces the "Missing credentials for PLAIN" error even with a correct
// .env file.
let transporter = null;
const getTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must both be set in your environment " +
        "before sending email. Check your .env file (and Railway's env vars in " +
        "production), and make sure dotenv.config() runs before anything that " +
        "sends email.",
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
};

const getFromAddress = () =>
  process.env.GMAIL_USER ? `SalesHub <${process.env.GMAIL_USER}>` : "SalesHub";

// Sends the "reset your password" email. Kept as its own function (rather
// than inlined in the controller) so the email template and the provider
// can both be swapped later without touching authController.js.
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

  await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject: "Reset your SalesHub password",
    html,
  });
};

module.exports = { sendPasswordResetEmail };
