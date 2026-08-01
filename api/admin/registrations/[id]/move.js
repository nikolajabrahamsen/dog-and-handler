const { supabase } = require('../../../../lib/supabase');
const { requireAdmin } = require('../../../../lib/http');
const { sendRegistrationConfirmationEmail } = require('../../../../lib/registrationEmail');

const ERROR_MESSAGES = {
  registration_not_found: { status: 404, message: 'Registration not found' },
  class_not_found: { status: 404, message: 'Class not found' },
  class_full: { status: 409, message: 'The target class is full' },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  const { new_class_id } = req.body || {};
  if (!new_class_id) return res.status(400).json({ error: 'new_class_id is required' });

  const { data: moved, error } = await supabase
    .rpc('move_registration', { p_reg_id: id, p_new_class_id: new_class_id })
    .single();

  if (error) {
    const message = error.message || '';
    const known = Object.keys(ERROR_MESSAGES).find((code) => message.includes(code));
    if (known) {
      const { status, message: friendly } = ERROR_MESSAGES[known];
      return res.status(status).json({ error: friendly });
    }
    console.error('move_registration error:', error);
    return res.status(500).json({ error: 'Could not move registration' });
  }

  // Let them know their class changed, if their seat is actually confirmed
  // (no point emailing about a still-pending/unpaid registration).
  if (moved?.status === 'confirmed') {
    const { data: cls } = await supabase.from('classes').select('*').eq('id', new_class_id).single();
    if (cls) await sendRegistrationConfirmationEmail(moved, cls);
  }

  return res.status(200).json(moved);
};
