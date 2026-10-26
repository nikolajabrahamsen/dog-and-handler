const { supabase } = require('../../lib/supabase');
const { createPayment } = require('../../lib/mobilepay');
const { requestBaseUrl } = require('../../lib/http');
const { sendGroupConfirmationEmail } = require('../../lib/registrationEmail');

const ERROR_MESSAGES = {
  class_not_found: { status: 404, message: 'Class not found' },
  class_closed: { status: 409, message: 'Registration for this class is closed' },
  class_full: { status: 409, message: 'This class just filled up' },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CLASSES_PER_ORDER = 10;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { owner_name, email, phone } = req.body || {};
  const dogNames = req.body?.dog_names && typeof req.body.dog_names === 'object' ? req.body.dog_names : {};
  const dog_name = typeof req.body?.dog_name === 'string' ? req.body.dog_name : '';
  const payment_method = req.body?.payment_method === 'pay_at_class' ? 'pay_at_class' : 'mobilepay';
  const newsletter_opt_in = req.body?.newsletter_opt_in === true;

  // One or several classes. `class_id` (single) is still accepted.
  let classIds = Array.isArray(req.body?.class_ids) ? req.body.class_ids : (req.body?.class_id ? [req.body.class_id] : []);
  classIds = [...new Set(classIds.map(String))];

  if (!classIds.length || !owner_name || !email || !phone) {
    return res.status(400).json({ error: 'class_ids, owner_name, email and phone are required' });
  }
  if (classIds.length > MAX_CLASSES_PER_ORDER || !classIds.every((id) => UUID_RE.test(id))) {
    return res.status(400).json({ error: 'Invalid class selection' });
  }

  // Enforce the payment methods the admin allowed for every selected class.
  const { data: classes } = await supabase.from('classes').select('*').in('id', classIds);
  if (!classes || classes.length !== classIds.length) {
    return res.status(404).json({ error: 'Class not found' });
  }
  const notAllowed = classes.some((c) => {
    const allowed = c.payment_options || 'both';
    return allowed !== 'both' && allowed !== payment_method;
  });
  if (notAllowed) {
    return res.status(400).json({ error: 'This payment method is not available for this class' });
  }

  // Atomic, race-safe capacity check + insert for ALL classes at once.
  // If any class is full/closed, nothing at all is reserved.
  const { data: regs, error: rpcError } = await supabase.rpc('create_registration_group', {
    p_class_ids: classIds,
    p_owner_name: owner_name,
    p_dog_name: dog_name || null,
    p_email: email,
    p_phone: phone,
    p_payment_method: payment_method,
    p_newsletter_opt_in: newsletter_opt_in,
  });

  if (rpcError || !regs || !regs.length) {
    const message = rpcError?.message || '';
    const known = Object.keys(ERROR_MESSAGES).find((code) => message.includes(code));
    if (known) {
      const { status, message: friendly } = ERROR_MESSAGES[known];
      const badId = (message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0];
      const bad = classes.find((c) => c.id === badId);
      return res.status(status).json({ error: friendly, class_title: bad?.title || null });
    }
    console.error('create_registration_group error:', rpcError);
    return res.status(500).json({ error: 'Could not create registration' });
  }

  // Each class can have its own dog; fall back to the single dog name.
  for (const reg of regs) {
    const name = String(dogNames[reg.class_id] ?? dog_name ?? '').trim().slice(0, 100) || null;
    reg.dog_name = name;
    await supabase.from('registrations').update({ dog_name: name }).eq('id', reg.id);
  }

  const groupId = regs[0].group_id;
  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
  const base = requestBaseUrl(req);
  const returnUrl = `${base}/payment-return.html?group=${groupId}`;

  // --- Pay at class: confirm every seat immediately, no MobilePay involved. ---
  if (payment_method === 'pay_at_class') {
    const confirmedRegs = [];
    for (const reg of regs) {
      const { data: confirmed, error: confirmError } = await supabase
        .rpc('confirm_registration', { p_reg_id: reg.id })
        .single();
      if (confirmError) {
        console.error('confirm_registration error:', confirmError);
        continue;
      }
      if (confirmed?.status === 'confirmed') confirmedRegs.push(confirmed);
    }
    if (!confirmedRegs.length) {
      return res.status(500).json({ error: 'Could not confirm registration' });
    }
    await sendGroupConfirmationEmail(confirmedRegs, classMap);
    return res.status(201).json({ registration_id: groupId, group_id: groupId, redirect_url: returnUrl });
  }

  // --- MobilePay: ONE payment for the total; reference = group id. ---
  try {
    const total = classes.reduce((sum, c) => sum + Number(c.price_dkk || 0), 0);
    const titles = regs.map((r) => classMap[r.class_id]?.title).filter(Boolean).join(' + ');
    const payment = await createPayment({
      amountDkk: total,
      reference: groupId,
      description: [titles, owner_name, [...new Set(regs.map((r) => r.dog_name).filter(Boolean))].join(', ')].filter(Boolean).join(' - ').slice(0, 100),
      returnUrl,
    });

    await supabase
      .from('registrations')
      .update({ mobilepay_payment_id: payment.reference || groupId, mobilepay_reference: groupId })
      .eq('group_id', groupId);

    return res.status(201).json({ registration_id: groupId, group_id: groupId, redirect_url: payment.redirectUrl });
  } catch (err) {
    console.error('MobilePay payment creation failed:', err);
    await supabase.from('registrations').update({ status: 'failed' }).eq('group_id', groupId);
    return res.status(502).json({ error: 'Could not start MobilePay payment. Please try again.' });
  }
};
