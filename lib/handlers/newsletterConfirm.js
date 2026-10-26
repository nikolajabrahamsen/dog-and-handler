const { supabase } = require('../supabase');
const { verifyConfirmToken } = require('../unsubscribe');

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title, body, extra = '') {
  return `<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Hund &amp; Handler</title>
<link rel="stylesheet" href="/styles.css" /></head>
<body><div class="status-page"><div class="status-card">
<div class="status-icon">🐾</div><h1>${title}</h1><p>${body}</p>${extra}
</div></div></body></html>`;
}

// Opening the link only shows a button; the signup is confirmed on POST, so
// mail scanners that open links automatically can't confirm on someone's behalf.
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  const src = req.method === 'POST' ? { ...req.query, ...(req.body || {}) } : req.query;
  const email = String(src.email || '').trim().toLowerCase();
  const t = String(src.t || '');
  const token = String(src.token || '');

  if (!verifyConfirmToken(email, t, token)) {
    return res.status(400).send(page('Linket virker ikke', 'Bekræftelseslinket er ugyldigt eller udløbet. Tilmeld dig igen på forsiden, så sender vi et nyt.'));
  }

  if (req.method === 'GET') {
    return res.status(200).send(page(
      'Bekræft tilmelding',
      `Vil du have nyheder om nye hold fra Hund &amp; Handler på <strong>${esc(email)}</strong>?`,
      `<form method="POST" action="/api/newsletter/confirm" style="margin-top:20px;">
         <input type="hidden" name="email" value="${esc(email)}" />
         <input type="hidden" name="t" value="${esc(t)}" />
         <input type="hidden" name="token" value="${esc(token)}" />
         <button type="submit" class="btn btn-primary">Ja, tilmeld mig</button>
       </form>`
    ));
  }

  const { error } = await supabase
    .from('newsletter_signups')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('email', email);

  if (error) {
    console.error('newsletter confirm failed:', error);
    return res.status(500).send(page('Noget gik galt', 'Vi kunne ikke bekræfte lige nu. Prøv igen om lidt.'));
  }
  return res.status(200).send(page('Tak, du er tilmeldt!', 'Du får en mail, når nye hold åbner. Du kan altid afmelde dig igen via linket i mailen.', '<a href="/" class="btn btn-secondary" style="display:inline-block; margin-top:20px; text-decoration:none;">Tilbage til forsiden</a>'));
};
