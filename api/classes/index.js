const { supabase } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/http');

const MAX_OLD_CLASSES_SHOWN = 10;

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
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('class_availability')
      .select('*')
      .order('starts_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const computed = data.map(withComputed);
    const admin = await requireAdmin(req);

    if (!admin) {
      // Public: never show classes whose end date has passed.
      return res.status(200).json(computed.filter((c) => !c.is_expired));
    }

    // Admin: show all current/upcoming classes, plus up to the 10 most
    // recently-ended classes underneath (oldest beyond that are just
    // omitted from this list, not deleted - keeps the panel manageable).
    const current = computed.filter((c) => !c.is_expired);
    const old = computed
      .filter((c) => c.is_expired)
      .sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at))
      .slice(0, MAX_OLD_CLASSES_SHOWN);

    return res.status(200).json([...current, ...old]);
  }

  if (req.method === 'POST') {
    const admin = await requireAdmin(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });

    const { title, description, starts_at, ends_at, weekday, location, max_participants, price_dkk } = req.body || {};
    if (!title || !starts_at || !max_participants || price_dkk == null) {
      return res.status(400).json({ error: 'title, starts_at, max_participants and price_dkk are required' });
    }

    const { data, error } = await supabase
      .from('classes')
      .insert({ title, description, starts_at, ends_at: ends_at || null, weekday, location, max_participants, price_dkk })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(withComputed({ ...data, confirmed_count: 0, held_count: 0 }));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
