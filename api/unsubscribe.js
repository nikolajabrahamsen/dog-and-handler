const { supabase } = require('../lib/supabase');
const { verifyUnsubscribeToken } = require('../lib/unsubscribe');

function page(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Dog &amp; Handler</title>
<link rel="stylesheet" href="/styles.css" /></head>
<body><div class="status-page"><div class="status-card">
<div class="status-icon">🐾</div><h1>${title}</h1><p>${body}</p>
</div></div></body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const email = String(req.query.email || '');
  const token = String(req.query.token || '');

  if (!verifyUnsubscribeToken(email, token)) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(page('Link not valid', "This unsubscribe link is invalid or has expired. If you'd still like to stop receiving emails, just reply to any newsletter and let us know."));
  }

  const { error } = await supabase
    .from('registrations')
    .update({ newsletter_opt_in: false })
    .ilike('email', email);

  if (error) {
    console.error('Unsubscribe update failed:', error);
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(page('Something went wrong', "We couldn't process this right now. Please try again shortly."));
  }

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(page("You're unsubscribed", "You won't receive any more news emails from us. You'll still get emails about classes you register for."));
};
