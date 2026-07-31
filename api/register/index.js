const { supabase } = require('../../lib/supabase');
const { createPayment } = require('../../lib/mobilepay');
const { requestBaseUrl } = require('../../lib/http');

const ERROR_MESSAGES = {
  class_not_found: { status: 404, message: 'Class not found' },
  class_closed: { status: 409, message: 'Registration for this class is closed' },
  class_full: { status: 409, message: 'This class just filled up' },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { class_id, owner_name, dog_name, email, phone } = req.body || {};
  if (!class_id || !owner_name || !email || !phone) {
    return res.status(400).json({ error: 'class_id, owner_name, email and phone are required' });
  }

  // Atomic, race-safe capacity check + insert (see supabase/schema.sql).
  const { data: reg, error: rpcError } = await supabase
    .rpc('create_registration', {
      p_class_id: class_id,
      p_owner_name: owner_name,
      p_dog_name: dog_name || null,
      p_email: email,
      p_phone: phone,
    })
    .single();

  if (rpcError) {
    const message = rpcError.message || '';
    const known = Object.keys(ERROR_MESSAGES).find((code) => message.includes(code));
    if (known) {
      const { status, message: friendly } = ERROR_MESSAGES[known];
      return res.status(status).json({ error: friendly });
    }
    console.error('create_registration error:', rpcError);
    return res.status(500).json({ error: 'Could not create registration' });
  }

  const { data: cls } = await supabase.from('classes').select('*').eq('id', class_id).single();
  const base = requestBaseUrl(req);

  try {
    const payment = await createPayment({
      amountDkk: cls.price_dkk,
      reference: reg.id,
      description: `${cls.title} - dog training`.slice(0, 100),
      returnUrl: `${base}/payment-return.html?reg=${reg.id}`,
    });

    await supabase
      .from('registrations')
      .update({ mobilepay_payment_id: payment.reference || reg.id, mobilepay_reference: reg.id })
      .eq('id', reg.id);

    return res.status(201).json({ registration_id: reg.id, redirect_url: payment.redirectUrl });
  } catch (err) {
    console.error('MobilePay payment creation failed:', err);
    await supabase.from('registrations').update({ status: 'failed' }).eq('id', reg.id);
    return res.status(502).json({ error: 'Could not start MobilePay payment. Please try again.' });
  }
};
