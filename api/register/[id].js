const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { data, error } = await supabase.from('registrations').select('*').eq('id', id).single();

  if (error || !data) return res.status(404).json({ error: 'Registration not found' });
  return res.status(200).json(data);
};
