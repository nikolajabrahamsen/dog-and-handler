const { supabase } = require('../../../lib/supabase');
const { requireAdmin } = require('../../../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('class_id', id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
};
