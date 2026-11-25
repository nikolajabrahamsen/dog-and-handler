const { supabase } = require('./supabase');

// Text the admin can edit for the confirmation emails. Falls back to the
// built-in wording if nothing is saved or the table does not exist yet.
const DEFAULT_CLOSING = 'Vi glæder os til at se jer!';
let cache = null;
let cacheTime = 0;

async function getEmailTexts() {
  if (cache && Date.now() - cacheTime < 30_000) return cache;
  let closing = DEFAULT_CLOSING;
  let extra = '';
  try {
    const { data, error } = await supabase
      .from('site_texts')
      .select('key,value')
      .eq('lang', 'da')
      .in('key', ['email_closing', 'email_extra']);
    if (!error && data) {
      for (const row of data) {
        if (row.key === 'email_closing' && row.value.trim()) closing = row.value.trim();
        if (row.key === 'email_extra') extra = row.value.trim();
      }
    }
  } catch (e) {
    console.error('Could not load email texts, using defaults:', e);
  }
  cache = { closing, extra };
  cacheTime = Date.now();
  return cache;
}

function clearEmailTextCache() { cache = null; }

module.exports = { getEmailTexts, clearEmailTextCache, DEFAULT_CLOSING };
