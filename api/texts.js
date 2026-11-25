const { supabase } = require('../lib/supabase');
const { requireAdmin } = require('../lib/http');
const { EMAIL_KEYS, MAX_LENGTH, isAllowed } = require('../lib/siteTextKeys');
const { clearEmailTextCache } = require('../lib/siteTexts');

// GET  /api/texts  -> the edited texts (public; the email texts only for admins)
// PUT  /api/texts  -> admin saves changes: { items: [{ key, lang, value }] }
//                     (an empty value removes the edit and restores the default)
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const admin = req.headers['authorization'] ? await requireAdmin(req) : null;
    const { data, error } = await supabase.from('site_texts').select('key,lang,value,updated_at');
    res.setHeader('Cache-Control', admin ? 'no-store' : 'public, s-maxage=10, stale-while-revalidate=30');
    if (error) {
      // Table not created yet: the site simply uses its built-in texts.
      console.error('site_texts read failed:', error.message);
      return res.status(200).json({ texts: { da: {}, en: {} }, termsUpdated: null });
    }
    const texts = { da: {}, en: {} };
    let termsUpdated = null;
    for (const row of data || []) {
      if (!admin && EMAIL_KEYS.includes(row.key)) continue;
      if (!texts[row.lang]) continue;
      texts[row.lang][row.key] = row.value;
      if (row.key.startsWith('terms_') && (!termsUpdated || row.updated_at > termsUpdated)) {
        termsUpdated = row.updated_at;
      }
    }
    return res.status(200).json({ texts, termsUpdated });
  }

  if (req.method === 'PUT') {
    const user = await requireAdmin(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items || items.length > 100) return res.status(400).json({ error: 'Invalid items' });

    const upserts = [];
    const deletes = [];
    for (const it of items) {
      const key = String(it?.key || '');
      const lang = String(it?.lang || '');
      const value = typeof it?.value === 'string' ? it.value.replace(/\r\n/g, '\n') : '';
      if (!isAllowed(key, lang)) return res.status(400).json({ error: `Not editable: ${key}/${lang}` });
      if (value.length > MAX_LENGTH) return res.status(400).json({ error: 'Text is too long' });
      if (value.trim() === '') deletes.push({ key, lang });
      else upserts.push({ key, lang, value, updated_at: new Date().toISOString() });
    }

    if (upserts.length) {
      const { error } = await supabase.from('site_texts').upsert(upserts, { onConflict: 'key,lang' });
      if (error) return res.status(500).json({ error: error.message });
    }
    for (const d of deletes) {
      const { error } = await supabase.from('site_texts').delete().eq('key', d.key).eq('lang', d.lang);
      if (error) return res.status(500).json({ error: error.message });
    }
    clearEmailTextCache();
    return res.status(200).json({ ok: true, saved: upserts.length, restored: deletes.length });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
};
