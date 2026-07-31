const { supabase } = require('../../lib/supabase');
const { isAdmin } = require('../../lib/http');

function withComputed(row) {
  const spotsLeft = Math.max(0, row.max_participants - row.held_count);
  return {
    ...row,
    spots_left: spotsLeft,
    registration_open: !!row.is_open && spotsLeft > 0,
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('class_availability')
      .select('*')
      .order('starts_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data.map(withComputed));
  }

  if (req.method === 'POST') {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

    const { title, description, starts_at, weekday, location, max_participants, price_dkk } = req.body || {};
    if (!title || !starts_at || !max_participants || price_dkk == null) {
      return res.status(400).json({ error: 'title, starts_at, max_participants and price_dkk are required' });
    }

    const { data, error } = await supabase
      .from('classes')
      .insert({ title, description, starts_at, weekday, location, max_participants, price_dkk })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(withComputed({ ...data, confirmed_count: 0, held_count: 0 }));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
