const { supabase } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/http');

function withComputed(row) {
  const spotsLeft = Math.max(0, row.max_participants - row.held_count);
  const reservedCount = Math.max(0, row.held_count - row.confirmed_count);
  const expired = !!row.ends_at && new Date(row.ends_at) < new Date();
  const notYetReleased = !!row.release_at && new Date(row.release_at) > new Date();
  return {
    ...row,
    spots_left: spotsLeft,
    reserved_count: reservedCount,
    registration_open: !!row.is_open && spotsLeft > 0 && !expired && !notYetReleased,
    is_expired: expired,
    not_yet_released: notYetReleased,
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

    const allowed = ['title', 'description', 'starts_at', 'ends_at', 'weekday', 'location', 'max_participants', 'price_dkk', 'is_open', 'release_at', 'announce_before_release'];
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

  if (req.method === 'DELETE') {
    if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' });

    // Registrations for this class are removed too (foreign key cascade in
    // supabase/schema.sql) - the frontend warns about this before calling.
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ deleted: true });
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};
