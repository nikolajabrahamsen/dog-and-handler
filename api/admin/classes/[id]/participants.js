const { supabase } = require('../../../../lib/supabase');
const { requireAdmin } = require('../../../../lib/http');
const { sendRegistrationConfirmationEmail } = require('../../../../lib/registrationEmail');

const ERROR_MESSAGES = {
  class_not_found: { status: 404, message: 'Class not found' },
  class_full: { status: 409, message: 'This class is full' },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' });

  const { id: classId } = req.query;
  const { owner_name, dog_name, email, phone } = req.body || {};
  if (!owner_name) {
    return res.status(400).json({ error: 'owner_name is required' });
  }

  const { data: reg, error } = await supabase
    .rpc('admin_add_registration', {
      p_class_id: classId,
      p_owner_name: owner_name,
      p_dog_name: dog_name || null,
      p_email: email,
      p_phone: phone,
    })
    .single();

  if (error) {
    const message = error.message || '';
    const known = Object.keys(ERROR_MESSAGES).find((code) => message.includes(code));
    if (known) {
      const { status, message: friendly } = ERROR_MESSAGES[known];
      return res.status(status).json({ error: friendly });
    }
    console.error('admin_add_registration error:', error);
    return res.status(500).json({ error: 'Could not add participant' });
  }

  const { data: cls } = await supabase.from('classes').select('*').eq('id', classId).single();
  if (cls && reg.email) await sendRegistrationConfirmationEmail(reg, cls);

  return res.status(201).json(reg);
};
