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

module.exports = { makeUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl };
