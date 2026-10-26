const { sendEmail } = require('./email');
const { buildEmailMapUrl } = require('./mapLink');
const company = require('./company');

const DATE_FORMAT = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Copenhagen' };

function formatDkk(amount) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(amount);
}

/**
 * Sends a confirmation email to a registrant once their seat is confirmed
 * (via MobilePay payment, pay-at-class, an admin adding them directly, or
 * being moved to a different class). Never throws - a failed email should
 * never break the registration flow; callers just log and move on.
 */
async function sendRegistrationConfirmationEmail(reg, cls) {
  if (!reg.email) return; // admin-added participants can have no email on file yet
  try {
    const dateStr = new Date(cls.starts_at).toLocaleString('da-DK', DATE_FORMAT);
    const orderRef = String(reg.group_id || reg.id).slice(0, 8).toUpperCase();
    const paymentNote = reg.payment_method === 'pay_at_class'
      ? 'Du betaler ved fremmøde til første gang.'
      : reg.payment_method === 'manual'
        ? ''
        : 'Vi har modtaget din betaling via MobilePay. Denne mail er din kvittering.';

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #22201B;">
        <h2 style="font-family: Georgia, serif;">Du er tilmeldt! 🐾</h2>
        <p>Hej ${escapeHtml(reg.owner_name)},</p>
        <p>Din plads på holdet er bekræftet:</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:4px 0; color:#6b6650;">Hold</td><td style="padding:4px 0;"><strong>${escapeHtml(cls.title)}</strong></td></tr>
          <tr><td style="padding:4px 0; color:#6b6650;">Start</td><td style="padding:4px 0;">${dateStr}</td></tr>
          ${cls.location ? `<tr><td style="padding:4px 0; color:#6b6650;">Sted</td><td style="padding:4px 0;">${buildEmailMapUrl(cls) ? `<a href="${escapeHtml(buildEmailMapUrl(cls))}" style="color:#C89B3C;">${escapeHtml(cls.location)}</a>` : escapeHtml(cls.location)}</td></tr>` : ''}
          <tr><td style="padding:4px 0; color:#6b6650;">Pris</td><td style="padding:4px 0;">${formatDkk(cls.price_dkk)}</td></tr>
          ${reg.dog_name ? `<tr><td style="padding:4px 0; color:#6b6650;">Hund</td><td style="padding:4px 0;">${escapeHtml(reg.dog_name)}</td></tr>` : ''}
        </table>
        ${paymentNote ? `<p>${paymentNote}</p>` : ''}
        <p>Vi glæder os til at se jer!</p>
        ${receiptFooterHtml(orderRef)}
      </div>
    `;

    const text = `Du er tilmeldt!\n\nHold: ${cls.title}\nStart: ${dateStr}${cls.location ? `\nSted: ${cls.location}` : ''}\nPris: ${formatDkk(cls.price_dkk)}${paymentNote ? `\n\n${paymentNote}` : ''}${receiptFooterText(orderRef)}`;

    await sendEmail({
      to: reg.email,
      subject: reg.payment_method === 'mobilepay' ? `Bekræftelse og kvittering: ${cls.title}` : `Bekræftet: ${cls.title}`,
      html,
      text,
    });
  } catch (err) {
    console.error('Confirmation email failed to send:', err);
  }
}

// Footer with the seller details a receipt should carry.
function receiptFooterHtml(orderRef) {
  return `<p style="color:#8a8570; font-size:12px; margin-top:32px; line-height:1.6;">
    ${escapeHtml(company.brand)}<br/>
    ${escapeHtml(company.legalName)} · CVR ${escapeHtml(company.cvr)}<br/>
    ${escapeHtml(company.address)}<br/>
    ${escapeHtml(company.email)} · ${escapeHtml(company.phone)}<br/>
    Ordrenr.: ${escapeHtml(orderRef)}
  </p>`;
}
function receiptFooterText(orderRef) {
  return `\n\n--\n${company.brand}\n${company.legalName} · CVR ${company.cvr}\n${company.address}\n${company.email} · ${company.phone}\nOrdrenr.: ${orderRef}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * One email for everything a person just booked. A single class uses the
 * normal confirmation email; several classes get one combined email.
 * classes: { [classId]: classRow }
 */
async function sendGroupConfirmationEmail(regs, classes) {
  if (!regs.length) return;
  if (regs.length === 1) {
    const cls = classes[regs[0].class_id];
    if (cls) await sendRegistrationConfirmationEmail(regs[0], cls);
    return;
  }
  const first = regs[0];
  if (!first.email) return;
  try {
    const items = regs
      .map((r) => ({ r, c: classes[r.class_id] }))
      .filter((x) => x.c)
      .sort((a, b) => new Date(a.c.starts_at) - new Date(b.c.starts_at));
    const total = items.reduce((sum, x) => sum + Number(x.c.price_dkk || 0), 0);
    const orderRef = String(first.group_id || first.id).slice(0, 8).toUpperCase();
    const paymentNote = first.payment_method === 'pay_at_class'
      ? 'Du betaler ved fremmøde til første gang.'
      : 'Vi har modtaget din betaling via MobilePay. Denne mail er din kvittering.';

    const rowsHtml = items.map(({ r, c }) => {
      const dateStr = new Date(c.starts_at).toLocaleString('da-DK', DATE_FORMAT);
      return `<tr>
        <td style="padding:8px 0; border-top:1px solid #e5dfcb;"><strong>${escapeHtml(c.title)}</strong><br/><span style="color:#6b6650;">${dateStr}${c.location ? ' · ' + escapeHtml(c.location) : ''}${r.dog_name ? '<br/>Hund: ' + escapeHtml(r.dog_name) : ''}</span></td>
        <td style="padding:8px 0; border-top:1px solid #e5dfcb; text-align:right; white-space:nowrap;">${formatDkk(c.price_dkk)}</td>
      </tr>`;
    }).join('');

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #22201B;">
        <h2 style="font-family: Georgia, serif;">Du er tilmeldt! 🐾</h2>
        <p>Hej ${escapeHtml(first.owner_name)},</p>
        <p>Dine pladser på ${items.length} hold er bekræftet:</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">${rowsHtml}
          <tr><td style="padding:8px 0; border-top:2px solid #22201B;"><strong>I alt</strong></td><td style="padding:8px 0; border-top:2px solid #22201B; text-align:right;"><strong>${formatDkk(total)}</strong></td></tr>
        </table>
        <p>${paymentNote}</p>
        <p>Vi glæder os til at se jer!</p>
        ${receiptFooterHtml(orderRef)}
      </div>`;
    const text = `Du er tilmeldt!\n\n${items.map(({ r, c }) => `${c.title} - ${new Date(c.starts_at).toLocaleString('da-DK', DATE_FORMAT)}${r.dog_name ? ` - Hund: ${r.dog_name}` : ''} - ${formatDkk(c.price_dkk)}`).join('\n')}\n\nI alt: ${formatDkk(total)}\n${paymentNote}${receiptFooterText(orderRef)}`;

    await sendEmail({ to: first.email, subject: first.payment_method === 'mobilepay' ? `Bekræftelse og kvittering: ${items.length} hold` : `Bekræftet: ${items.length} hold`, html, text });
  } catch (err) {
    console.error('Group confirmation email failed to send:', err);
  }
}

module.exports = { sendRegistrationConfirmationEmail, sendGroupConfirmationEmail };
