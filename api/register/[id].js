const { supabase } = require('../../lib/supabase');
const { finalizeMobilePayRegistration, loadGroup, loadClassMap } = require('../../lib/finalizePayment');

// `id` is a registration GROUP id (or, for older links, a single registration id).
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  let regs = await loadGroup(id);
  if (!regs.length) return res.status(404).json({ error: 'Registration not found' });

  // The return page polls this. If the customer already approved in MobilePay
  // but the webhook has not arrived yet, settle it here (also captures the money).
  if (regs.some((r) => r.status === 'pending') && regs[0].payment_method === 'mobilepay') {
    try {
      await finalizeMobilePayRegistration(id);
      regs = await loadGroup(id);
    } catch (e) {
      console.error('Return-page settle failed:', e);
    }
  }

  const statuses = regs.map((r) => r.status);
  const done = (s) => s === 'confirmed';
  const dead = (s) => ['failed', 'cancelled', 'expired'].includes(s);
  let status = 'pending';
  if (statuses.every(done)) status = 'confirmed';
  else if (statuses.every(dead)) status = statuses.includes('failed') ? 'failed' : statuses[0];
  else if (statuses.some(done) && statuses.some(dead) && !statuses.includes('pending')) status = 'partial';

  const classes = await loadClassMap(regs);
  return res.status(200).json({
    status,
    payment_method: regs[0].payment_method,
    classes: regs.map((r) => ({ title: classes[r.class_id]?.title || '', status: r.status })),
  });
};
