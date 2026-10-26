const { supabase } = require('../supabase');
const { sendEmail } = require('../email');
const { confirmUrl } = require('../unsubscribe');
const { requestBaseUrl } = require('../http');
const company = require('../company');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Front-page newsletter signup (no class registration needed). Double opt-in:
// we only send a confirmation mail here; the person becomes a subscriber when
// they confirm. The answer is always the same so the form can't be used to
// find out whether an address is already subscribed.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  if (body.website) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden fields

  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim().slice(0, 100) || null;
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const { data: existing } = await supabase.from('newsletter_signups').select('*').eq('email', email).maybeSingle();

  if (existing?.confirmed_at) return res.status(200).json({ ok: true }); // already subscribed
  if (existing?.last_sent_at && Date.now() - new Date(existing.last_sent_at).getTime() < RESEND_COOLDOWN_MS) {
    return res.status(200).json({ ok: true }); // confirmation already sent recently
  }

  const { error: upsertError } = await supabase
    .from('newsletter_signups')
    .upsert({ email, name: name ?? existing?.name ?? null, last_sent_at: new Date().toISOString() }, { onConflict: 'email' });
  if (upsertError) {
    console.error('newsletter signup upsert failed:', upsertError);
    return res.status(500).json({ error: 'Could not sign up' });
  }

  try {
    const link = confirmUrl(requestBaseUrl(req), email);
    await sendEmail({
      to: email,
      subject: 'Bekræft din tilmelding til nyhedsbrevet',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #22201B;">
          <h2 style="font-family: Georgia, serif;">Bekræft din tilmelding 🐾</h2>
          <p>Tak for din interesse! Tryk på knappen for at få besked, når nye hold åbner for tilmelding hos ${esc(company.brand)}.</p>
          <p><a href="${esc(link)}" style="display:inline-block; background:#C89B3C; color:#141C16; padding:12px 22px; border-radius:999px; text-decoration:none; font-weight:600;">Bekræft tilmelding</a></p>
          <p style="color:#6b6650; font-size:13px;">Har du ikke bedt om dette, kan du bare ignorere denne mail. Så sker der ingenting.</p>
          <p style="color:#8a8570; font-size:12px; margin-top:32px;">${esc(company.legalName)} · CVR ${esc(company.cvr)}</p>
        </div>`,
      text: `Bekræft din tilmelding til nyhedsbrevet fra ${company.brand}:\n${link}\n\nHar du ikke bedt om dette, kan du ignorere denne mail.`,
    });
  } catch (err) {
    console.error('newsletter confirmation email failed:', err);
    return res.status(502).json({ error: 'Could not send confirmation email' });
  }
  return res.status(200).json({ ok: true });
};
