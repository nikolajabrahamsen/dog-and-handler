const { supabase } = require('../../lib/supabase');
const { requireAdmin, requestBaseUrl } = require('../../lib/http');
const { sendEmail } = require('../../lib/email');
const { unsubscribeUrl } = require('../../lib/unsubscribe');

function buildHtml(messageHtml, unsubUrl) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #22201B;">
      ${messageHtml}
      <hr style="border: none; border-top: 1px solid #e0dccb; margin: 32px 0 16px;" />
      <p style="font-size: 12px; color: #8a8570;">
        You're receiving this because you opted in to news from Hund &amp; Handler.
        <a href="${unsubUrl}" style="color:#8a8570;">Unsubscribe</a>
      </p>
    </div>
  `;
}

module.exports = async function handler(req, res) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('newsletter_subscribers').select('email');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ count: data.length });
  }

  if (req.method === 'POST') {
    const { subject, message } = req.body || {};
    if (!subject || !message) {
      return res.status(400).json({ error: 'subject and message are required' });
    }

    const { data: subscribers, error } = await supabase.from('newsletter_subscribers').select('email');
    if (error) return res.status(500).json({ error: error.message });

    if (!subscribers.length) {
      return res.status(200).json({ sent: 0, failed: 0, message: 'No subscribers yet.' });
    }

    const base = requestBaseUrl(req);
    // Plain text message -> simple paragraph HTML (keeps this endpoint
    // simple; swap in a richer editor later if you want formatted emails).
    const messageHtml = String(message)
      .split(/\n{2,}/)
      .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const results = await Promise.allSettled(
      subscribers.map((sub) =>
        sendEmail({
          to: sub.email,
          subject,
          html: buildHtml(messageHtml, unsubscribeUrl(base, sub.email)),
          text: `${message}\n\nUnsubscribe: ${unsubscribeUrl(base, sub.email)}`,
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;
    if (failed > 0) {
      console.error(
        'Newsletter send failures:',
        results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message)
      );
    }

    return res.status(200).json({ sent, failed });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
