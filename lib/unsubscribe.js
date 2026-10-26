const crypto = require('crypto');

const SECRET = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;

function makeUnsubscribeToken(email) {
  return crypto.createHmac('sha256', SECRET).update(email.toLowerCase().trim()).digest('hex');
}

function verifyUnsubscribeToken(email, token) {
  if (!email || !token) return false;
  const expected = makeUnsubscribeToken(email);
  // Constant-time comparison to avoid leaking the valid token via timing.
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function unsubscribeUrl(baseUrl, email) {
  const token = makeUnsubscribeToken(email);
  return `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

// Confirmation links for front-page signups. A different "purpose" prefix means
// an unsubscribe token can never be used as a confirm token (or vice versa),
// and links expire after 7 days.
const CONFIRM_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function makeConfirmToken(email, ts) {
  return crypto.createHmac('sha256', SECRET).update(`confirm:${email.toLowerCase().trim()}:${ts}`).digest('hex');
}

function verifyConfirmToken(email, ts, token) {
  if (!email || !ts || !token) return false;
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > CONFIRM_MAX_AGE_MS) return false;
  const a = Buffer.from(makeConfirmToken(email, ts));
  const b = Buffer.from(String(token));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function confirmUrl(baseUrl, email) {
  const ts = Date.now();
  return `${baseUrl}/api/newsletter/confirm?email=${encodeURIComponent(email)}&t=${ts}&token=${makeConfirmToken(email, ts)}`;
}

module.exports = { makeUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl, verifyConfirmToken, confirmUrl };
