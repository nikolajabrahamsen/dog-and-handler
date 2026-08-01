const { supabase } = require('../../lib/supabase');
const { requireAdmin } = require('../../lib/http');

const MAX_OLD_CLASSES_SHOWN = 10;

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
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('class_availability')
      .select('*')
      .order('starts_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const computed = data.map(withComputed);
    const admin = await requireAdmin(req);

    if (!admin) {
      // Public: never show classes whose end date has passed, or whose
      // release date hasn't arrived yet.
      return res.status(200).json(computed.filter((c) => !c.is_expired && !c.not_yet_released));
    }

    // Admin: show all current/upcoming classes (including not-yet-released
    // ones), plus up to the 10 most recently-ended classes underneath.
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

    const {
      title, description, starts_at, ends_at, weekday, location,
      max_participants, price_dkk, release_at, announce_before_release,
    } = req.body || {};
    if (!title || !starts_at || !max_participants || price_dkk == null) {
      return res.status(400).json({ error: 'title, starts_at, max_participants and price_dkk are required' });
    }

    const { data, error } = await supabase
      .from('classes')
      .insert({
        title, description, starts_at, ends_at: ends_at || null, weekday, location,
        max_participants, price_dkk,
        release_at: release_at || null,
        announce_before_release: !!announce_before_release && !!release_at,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(withComputed({ ...data, confirmed_count: 0, held_count: 0 }));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
