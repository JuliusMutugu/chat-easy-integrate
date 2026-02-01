/**
 * Email channel – our own engine via SMTP (Nodemailer).
 * No Twilio dependency. Configure your own SMTP (Gmail, SendGrid, self-hosted).
 */

import nodemailer from "nodemailer";

export async function sendEmail(config, { to, subject, text, html }) {
  const { host, port, secure, user, pass, from } = config;
  if (!host || !user || !pass) {
    throw new Error("Email config missing: need host, user, pass (and optionally from)");
  }
  const transporter = nodemailer.createTransport({
    host: host || "localhost",
    port: parseInt(port, 10) || 587,
    secure: secure === true,
    auth: { user, pass },
  });
  const info = await transporter.sendMail({
    from: from || user,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject: subject || "(No subject)",
    text: text || "",
    html: html || undefined,
  });
  return { messageId: info.messageId, accepted: info.accepted };
}

export function validateEmailConfig(config) {
  if (!config) return { valid: false, error: "No config" };
  if (!config.host || !config.user || !config.pass) return { valid: false, error: "Missing host, user, or pass" };
  return { valid: true };
}
