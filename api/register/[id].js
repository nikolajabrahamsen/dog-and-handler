const { supabase } = require('../../lib/supabase');
const { finalizeMobilePayRegistration } = require('../../lib/finalizePayment');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  let { data, error } = await supabase.from('registrations').select('*').eq('id', id).single();
  if (error || !data) return res.status(404).json({ error: 'Registration not found' });

  // The return page polls this. If the customer already approved in MobilePay
  // but the webhook has not arrived yet, settle it here (also captures the money).
  if (data.status === 'pending' && data.payment_method === 'mobilepay') {
    try {
      await finalizeMobilePayRegistration(id);
      const refreshed = await supabase.from('registrations').select('*').eq('id', id).single();
      if (refreshed.data) data = refreshed.data;
    } catch (e) {
      console.error('Return-page settle failed:', e);
    }
  }
  return res.status(200).json(data);
};
