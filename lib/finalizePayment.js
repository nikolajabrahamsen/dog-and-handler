const { supabase } = require('./supabase');
const { getPayment, capturePayment, cancelPayment } = require('./mobilepay');
const { sendRegistrationConfirmationEmail } = require('./registrationEmail');

// Looks at the authoritative MobilePay state for a registration and brings
// our database in line: confirm the seat + capture the money when the
// payment is AUTHORIZED, release it if the seat is gone, mark failures.
// Safe to call repeatedly (webhook and the return page both call it).
async function finalizeMobilePayRegistration(reference) {
  const { data: reg } = await supabase.from('registrations').select('*').eq('id', reference).single();
  if (!reg || reg.payment_method !== 'mobilepay') return reg;

  const payment = await getPayment(reference);
  const state = payment.state; // CREATED | AUTHORIZED | ABORTED | EXPIRED | TERMINATED

  if (state === 'AUTHORIZED') {
    let current = reg;

    if (reg.status !== 'confirmed') {
      const { data: confirmed, error } = await supabase.rpc('confirm_registration', { p_reg_id: reference }).single();
      if (error) {
        console.error('confirm_registration error:', error);
        return reg;
      }
      current = confirmed;

      if (confirmed?.status === 'confirmed') {
        const { data: cls } = await supabase.from('classes').select('*').eq('id', confirmed.class_id).single();
        if (cls) await sendRegistrationConfirmationEmail(confirmed, cls);
      } else {
        // No seat left: release the reservation so the customer is not charged.
        try { await cancelPayment(reference); } catch (e) { console.error('cancelPayment failed (needs manual cancel):', reference, e); }
        await supabase.from('registrations').update({ status: 'failed' }).eq('id', reference);
        return { ...reg, status: 'failed' };
      }
    }

    // Seat is confirmed: take the money if that has not happened yet.
    const captured = payment.aggregate?.capturedAmount?.value || 0;
    if (current?.status === 'confirmed' && captured === 0) {
      const { data: cls } = await supabase.from('classes').select('price_dkk').eq('id', current.class_id).single();
      if (cls) {
        try {
          await capturePayment(reference, cls.price_dkk);
        } catch (e) {
          console.error('Capture failed (seat confirmed, money still reserved):', reference, e);
        }
      }
    }
    return current;
  }

  if (state === 'ABORTED' || state === 'TERMINATED' || state === 'EXPIRED') {
    if (reg.status === 'pending') {
      await supabase.from('registrations').update({ status: state === 'EXPIRED' ? 'expired' : 'cancelled' }).eq('id', reference);
    }
  }
  return reg;
}

module.exports = { finalizeMobilePayRegistration };
