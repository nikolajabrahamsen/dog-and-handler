// Thin wrapper around Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Uses native fetch - no extra dependency needed on Vercel's Node runtime.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM; // e.g. "Hund & Handler <kvittering@yourdomain.com>"
// Where customer replies go (so replies reach a real inbox, not the sending address).
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO;

async function sendEmail({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html, text, ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}) }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

module.exports = { sendEmail };
