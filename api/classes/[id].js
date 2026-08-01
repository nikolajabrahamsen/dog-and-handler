const { supabase } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/http');

function withComputed(row) {
  const spotsLeft = Math.max(0, row.max_participants - row.held_count);
  const expired = !!row.ends_at && new Date(row.ends_at) < new Date();
  return {
    ...row,
    spots_left: spotsLeft,
    registration_open: !!row.is_open && spotsLeft > 0 && !expired,
    is_expired: expired,
  };
}

module.exports = async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('class_availability')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Class not found' });
    return res.status(200).json(withComputed(data));
  }

  if (req.method === 'PATCH') {
    if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = ['title', 'description', 'starts_at', 'ends_at', 'weekday', 'location', 'max_participants', 'price_dkk', 'is_open'];
    const updates = {};
    for (const key of allowed) {
      if (req.body && req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { error: updateError } = await supabase.from('classes').update(updates).eq('id', id);
    if (updateError) return res.status(500).json({ error: updateError.message });

    const { data, error } = await supabase.from('class_availability').select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Class not found' });
    return res.status(200).json(withComputed(data));
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
};
