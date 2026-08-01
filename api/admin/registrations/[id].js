const { supabase } = require('../../../lib/supabase');
const { requireAdmin } = require('../../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;

  const { error } = await supabase.from('registrations').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  // Note: this doesn't automatically reopen a class that auto-closed when
  // it filled up - the admin can hit "Reopen" if they want the freed seat
  // to be bookable again. Deliberate: a class could also have been closed
  // manually for reasons unrelated to capacity.
  return res.status(200).json({ deleted: true });
};
