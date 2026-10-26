const { supabase } = require('./supabase');
const { getPayment, capturePayment, cancelPayment } = require('./mobilepay');
const { sendGroupConfirmationEmail } = require('./registrationEmail');

// The MobilePay payment reference is the registration GROUP id (one payment
// can cover several classes). Older single registrations used their own id as
// the reference, so fall back to that.
async function loadGroup(reference) {
  let { data: regs } = await supabase.from('registrations').select('*').eq('group_id', reference);
  if (!regs || !regs.length) {
    ({ data: regs } = await supabase.from('registrations').select('*').eq('id', reference));
  }
  return regs || [];
}

async function loadClassMap(regs) {
  const ids = [...new Set(regs.map((r) => r.class_id))];
  const { data } = await supabase.from('classes').select('*').in('id', ids);
  return Object.fromEntries((data || []).map((c) => [c.id, c]));
}

// Looks at the authoritative MobilePay state and brings our database in line:
// confirm the seats + capture the money when AUTHORIZED, release the
// reservation if no seat could be confirmed, mark failures otherwise.
// Safe to call repeatedly (webhook and the return page both call it).
async function finalizeMobilePayRegistration(reference) {
  const regs = await loadGroup(reference);
  if (!regs.length || regs[0].payment_method !== 'mobilepay') return regs;

  const payment = await getPayment(reference);
  const state = payment.state; // CREATED | AUTHORIZED | ABORTED | EXPIRED | TERMINATED

  if (state === 'AUTHORIZED') {
    const newlyConfirmed = [];
    const final = [];

    for (const reg of regs) {
      if (reg.status === 'confirmed') { final.push(reg); continue; }
      const { data: confirmed, error } = await supabase.rpc('confirm_registration', { p_reg_id: reg.id }).single();
      if (error) {
        console.error('confirm_registration error:', error);
        final.push(reg);
        continue;
      }
      final.push(confirmed);
      if (confirmed?.status === 'confirmed') newlyConfirmed.push(confirmed);
    }

    const classes = await loadClassMap(regs);
    const confirmedRegs = final.filter((r) => r.status === 'confirmed');
    const failedRegs = final.filter((r) => r.status === 'failed');

    if (newlyConfirmed.length) {
      await sendGroupConfirmationEmail(newlyConfirmed, classes);
    }

    if (!confirmedRegs.length) {
      // No seat could be confirmed: release the reservation, charge nothing.
      if (failedRegs.length) {
        try { await cancelPayment(reference); } catch (e) { console.error('cancelPayment failed (needs manual cancel):', reference, e); }
      }
      return final;
    }

    // At least one seat confirmed: take the money for the confirmed classes.
    const captured = payment.aggregate?.capturedAmount?.value || 0;
    if (captured === 0) {
      const total = confirmedRegs.reduce((sum, r) => sum + Number(classes[r.class_id]?.price_dkk || 0), 0);
      try {
        await capturePayment(reference, total);
      } catch (e) {
        console.error('Capture failed (seats confirmed, money still reserved):', reference, e);
      }
      if (failedRegs.length) {
        console.error('PARTIAL GROUP: some classes could not be confirmed; release the remainder manually if it was not released:', reference);
        try { await cancelPayment(reference); } catch (e) { /* remainder expires on its own */ }
      }
    }
    return final;
  }

  if (state === 'ABORTED' || state === 'TERMINATED' || state === 'EXPIRED') {
    const newStatus = state === 'EXPIRED' ? 'expired' : 'cancelled';
    for (const reg of regs) {
      if (reg.status === 'pending') {
        await supabase.from('registrations').update({ status: newStatus }).eq('id', reg.id);
      }
    }
  }
  return regs;
}

module.exports = { finalizeMobilePayRegistration, loadGroup, loadClassMap };
