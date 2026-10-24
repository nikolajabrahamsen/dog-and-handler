const { finalizeMobilePayRegistration } = require('../../lib/finalizePayment');

// MobilePay calls this URL whenever a payment's state changes (registered via
// the Webhooks API). We never trust the webhook body: it only tells us WHICH
// registration to look at; the real state is re-fetched from MobilePay.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // Serverless functions stop once the response is sent, so do the work first.
  try {
    const reference = req.body?.reference;
    if (reference) await finalizeMobilePayRegistration(reference);
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
  return res.status(200).send('OK');
};
