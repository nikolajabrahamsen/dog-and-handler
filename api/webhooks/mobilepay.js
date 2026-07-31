const { supabase } = require('../../lib/supabase');
const { getPayment } = require('../../lib/mobilepay');

// MobilePay calls this URL whenever a payment's state changes. Register it
// via the Webhooks API: https://developer.vippsmobilepay.com/docs/APIs/webhooks-api/
//
// IMPORTANT: never trust the webhook body alone. It tells you *that
// something changed*; we always re-fetch the authoritative status from
// MobilePay's API before granting the seat. In production, also verify
// the request signature MobilePay sends (the signing secret is issued
// when you register the webhook) before doing any processing below.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // Acknowledge immediately; MobilePay retries if you don't respond fast.
  res.status(200).send('OK');

  try {
    const reference = req.body?.reference;
    if (!reference) return;

    const { data: reg } = await supabase.from('registrations').select('*').eq('id', reference).single();
    if (!reg) return;
    if (reg.status === 'confirmed') return; // already handled

    const payment = await getPayment(reference);
    const state = payment.state; // 'CREATED' | 'AUTHORIZED' | 'TERMINATED' | 'EXPIRED'

    if (state === 'AUTHORIZED') {
      // Atomic confirm + auto-close-if-full (see supabase/schema.sql).
      const { error } = await supabase.rpc('confirm_registration', { p_reg_id: reference });
      if (error) console.error('confirm_registration error:', error);
    } else if (state === 'TERMINATED' || state === 'EXPIRED') {
      await supabase
        .from('registrations')
        .update({ status: state === 'EXPIRED' ? 'expired' : 'cancelled' })
        .eq('id', reference);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
};
