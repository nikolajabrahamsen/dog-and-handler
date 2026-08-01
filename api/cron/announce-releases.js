const { supabase } = require('../../lib/supabase');
const { sendEmail } = require('../../lib/email');
const { unsubscribeUrl } = require('../../lib/unsubscribe');
const { requestBaseUrl } = require('../../lib/http');

const DATE_FORMAT = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };

function formatDkk(amount) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(amount);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Called by an external scheduler (see .github/workflows/announce-releases.yml)
// every few minutes. Not Supabase-Auth-gated like the admin UI - protected
// instead by a shared secret, since there's no browser session calling it.
//
// Finds classes that:
//   - have announce_before_release = true
//   - haven't been announced yet (release_announced_at is null)
//   - are due: release_at is within the next 10 minutes
//   - aren't stale: release_at isn't more than 2 hours in the past (a
//     safety net in case the scheduler was down for a while - avoids
//     emailing about a release that happened long ago)
// Classes sharing the exact same release_at are bundled into one email.
module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const tenMinFromNow = new Date(now.getTime() + 10 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const { data: due, error } = await supabase
    .from('classes')
    .select('*')
    .eq('announce_before_release', true)
    .is('release_announced_at', null)
    .not('release_at', 'is', null)
    .lte('release_at', tenMinFromNow.toISOString())
    .gte('release_at', twoHoursAgo.toISOString());

  if (error) return res.status(500).json({ error: error.message });

  if (!due.length) {
    return res.status(200).json({ groups_sent: 0, classes_announced: 0, subscribers_emailed: 0 });
  }

  // Group by exact release_at value.
  const groups = new Map();
  for (const cls of due) {
    const key = new Date(cls.release_at).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cls);
  }

  const { data: subscribers, error: subError } = await supabase.from('newsletter_subscribers').select('email');
  if (subError) return res.status(500).json({ error: subError.message });

  const base = requestBaseUrl(req);
  let groupsSent = 0;
  let subscribersEmailed = 0;

  for (const [releaseAt, classes] of groups) {
    if (subscribers.length > 0) {
      const releaseDateStr = new Date(releaseAt).toLocaleString('da-DK', DATE_FORMAT);
      const classListHtml = classes.map((cls) => `
        <div style="margin: 16px 0; padding: 12px 0; border-top: 1px solid #e0dccb;">
          <strong>${escapeHtml(cls.title)}</strong><br/>
          <span style="color:#6b6650; font-size:14px;">
            Start: ${new Date(cls.starts_at).toLocaleString('da-DK', DATE_FORMAT)}
            ${cls.location ? ` · ${escapeHtml(cls.location)}` : ''}
             · ${formatDkk(cls.price_dkk)}
          </span>
        </div>
      `).join('');

      const subject = classes.length === 1
        ? `Nyt hold åbner snart: ${classes[0].title}`
        : `${classes.length} nye hold åbner for tilmelding om lidt`;

      const intro = `<p>Om cirka 10 minutter (${releaseDateStr}) åbner tilmeldingen til:</p>`;

      const results = await Promise.allSettled(
        subscribers.map((sub) => {
          const unsubUrl = unsubscribeUrl(base, sub.email);
          const html = `
            <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #22201B;">
              <h2 style="font-family: Georgia, serif;">Nyt hold åbner snart 🐾</h2>
              ${intro}
              ${classListHtml}
              <p><a href="${base}" style="color:#C89B3C;">Se alle hold</a></p>
              <hr style="border: none; border-top: 1px solid #e0dccb; margin: 32px 0 16px;" />
              <p style="font-size: 12px; color: #8a8570;">
                Du modtager denne mail, fordi du har tilmeldt dig nyheder fra Hund &amp; Handler.
                <a href="${unsubUrl}" style="color:#8a8570;">Afmeld</a>
              </p>
            </div>
          `;
          return sendEmail({ to: sub.email, subject, html, text: `${classes.map((c) => c.title).join(', ')} - ${base}` });
        })
      );

      subscribersEmailed += results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) console.error('Release announcement send failures:', failed.map((r) => r.reason?.message));
    }

    // Mark all classes in this group as announced, whether or not there
    // were any subscribers to send to - avoids re-processing next run.
    await supabase
      .from('classes')
      .update({ release_announced_at: new Date().toISOString() })
      .in('id', classes.map((c) => c.id));

    groupsSent += 1;
  }

  return res.status(200).json({ groups_sent: groupsSent, classes_announced: due.length, subscribers_emailed: subscribersEmailed });
};
