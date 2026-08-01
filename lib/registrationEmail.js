const { sendEmail } = require('./email');

const DATE_FORMAT = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };

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
    const paymentNote = reg.payment_method === 'pay_at_class'
      ? 'Du betaler ved fremmøde til første gang.'
      : reg.payment_method === 'manual'
        ? ''
        : 'Vi har modtaget din betaling via MobilePay.';

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #22201B;">
        <h2 style="font-family: Georgia, serif;">Du er tilmeldt! 🐾</h2>
        <p>Hej ${escapeHtml(reg.owner_name)},</p>
        <p>Din plads på holdet er bekræftet:</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:4px 0; color:#6b6650;">Hold</td><td style="padding:4px 0;"><strong>${escapeHtml(cls.title)}</strong></td></tr>
          <tr><td style="padding:4px 0; color:#6b6650;">Start</td><td style="padding:4px 0;">${dateStr}</td></tr>
          ${cls.location ? `<tr><td style="padding:4px 0; color:#6b6650;">Sted</td><td style="padding:4px 0;">${cls.location_url ? `<a href="${escapeHtml(cls.location_url)}" style="color:#C89B3C;">${escapeHtml(cls.location)}</a>` : escapeHtml(cls.location)}</td></tr>` : ''}
          <tr><td style="padding:4px 0; color:#6b6650;">Pris</td><td style="padding:4px 0;">${formatDkk(cls.price_dkk)}</td></tr>
          ${reg.dog_name ? `<tr><td style="padding:4px 0; color:#6b6650;">Hund</td><td style="padding:4px 0;">${escapeHtml(reg.dog_name)}</td></tr>` : ''}
        </table>
        ${paymentNote ? `<p>${paymentNote}</p>` : ''}
        <p>Vi glæder os til at se jer!</p>
        <p style="color:#8a8570; font-size:13px; margin-top:32px;">Hund &amp; Handler Danmark</p>
      </div>
    `;

    const text = `Du er tilmeldt!\n\nHold: ${cls.title}\nStart: ${dateStr}${cls.location ? `\nSted: ${cls.location}` : ''}\nPris: ${formatDkk(cls.price_dkk)}${paymentNote ? `\n\n${paymentNote}` : ''}`;

    await sendEmail({
      to: reg.email,
      subject: `Bekræftet: ${cls.title}`,
      html,
      text,
    });
  } catch (err) {
    console.error('Confirmation email failed to send:', err);
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { sendRegistrationConfirmationEmail };
