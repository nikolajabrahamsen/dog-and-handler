// One serverless function for all PUBLIC newsletter links (Vercel's free plan
// allows only 12 functions). The public URLs are unchanged - vercel.json
// rewrites /api/unsubscribe, /api/newsletter/subscribe and
// /api/newsletter/confirm to this file with ?action=...
const subscribe = require('../lib/handlers/newsletterSubscribe');
const confirm = require('../lib/handlers/newsletterConfirm');
const unsubscribe = require('../lib/handlers/unsubscribe');

module.exports = async function handler(req, res) {
  const action = String(req.query.action || '');
  if (action === 'subscribe') return subscribe(req, res);
  if (action === 'confirm') return confirm(req, res);
  if (action === 'unsubscribe') return unsubscribe(req, res);
  return res.status(404).json({ error: 'Not found' });
};
