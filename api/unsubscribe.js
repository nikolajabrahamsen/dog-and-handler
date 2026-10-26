const { supabase } = require('../lib/supabase');
const { verifyUnsubscribeToken } = require('../lib/unsubscribe');

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

// Opening the link only SHOWS a confirmation page. The actual unsubscribe
// happens on POST (button press), so mail scanners and link previews that
// automatically open links in emails can't unsubscribe people by accident.
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  const email = String((req.method === 'POST' ? (req.body?.email ?? req.query.email) : req.query.email) || '');
  const token = String((req.method === 'POST' ? (req.body?.token ?? req.query.token) : req.query.token) || '');

  if (!verifyUnsubscribeToken(email, token)) {
    return res.status(400).send(page('Linket virker ikke', 'Afmeldingslinket er ugyldigt eller udløbet. Svar på en af vores mails, hvis du stadig ønsker at stoppe nyhedsbreve.'));
  }

  if (req.method === 'GET') {
    return res.status(200).send(page(
      'Afmeld nyhedsbrev',
      `Vil du ikke længere modtage nyheder fra Hund &amp; Handler på <strong>${esc(email)}</strong>?`,
      `<form method="POST" action="/api/unsubscribe" style="margin-top:20px;">
         <input type="hidden" name="email" value="${esc(email)}" />
         <input type="hidden" name="token" value="${esc(token)}" />
         <button type="submit" class="btn btn-primary">Afmeld</button>
       </form>`
    ));
  }

  const { error } = await supabase
    .from('registrations')
    .update({ newsletter_opt_in: false })
    .ilike('email', email);

  if (error) {
    console.error('Unsubscribe update failed:', error);
    return res.status(500).send(page('Noget gik galt', 'Vi kunne ikke gennemføre afmeldingen lige nu. Prøv igen om lidt.'));
  }

  return res.status(200).send(page('Du er afmeldt', 'Du modtager ikke flere nyhedsbreve fra os. Du får stadig mails om de hold, du tilmelder dig.'));
};
