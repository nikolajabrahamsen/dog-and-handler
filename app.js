const API = '/api';

function currentLocale() {
  return getLang() === 'en' ? 'en-GB' : 'da-DK';
}

function dkkFormat(amount) {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'currency',
    currency: 'DKK',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(currentLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Maps the (English) error strings the API returns to a translated message.
// The API stays language-agnostic; only the frontend translates.
function translateApiError(message) {
  const map = {
    'Class not found': 'err_class_not_found',
    'Registration for this class is closed': 'err_class_closed',
    'This class just filled up': 'err_class_full',
    'Could not start MobilePay payment. Please try again.': 'err_mobilepay_failed',
  };
  const key = map[message];
  return key ? t(key) : (message || t('err_generic'));
}

let lastClasses = [];
const selectedIds = new Set(); // classes the visitor has ticked for one combined registration

async function loadClasses(silent = false) {
  const listEl = document.getElementById('classList');
  if (!silent) {
    listEl.innerHTML = `<p style="color: var(--bone-dim)">${t('loading_classes')}</p>`;
  }
  try {
    const res = await fetch(`${API}/classes`, { cache: 'no-store' });
    const classes = await res.json();
    lastClasses = classes;

    if (!classes.length) {
      listEl.innerHTML = `<div class="empty-state">${t('no_classes')}</div>`;
      return;
    }

    renderClassList();
  } catch (err) {
    if (!silent) listEl.innerHTML = `<div class="empty-state">${t('load_error')}</div>`;
    console.error(err);
  }
}

// Renders the list from lastClasses and (re)schedules the release timer.
function renderClassList() {
  const listEl = document.getElementById('classList');
  if (!lastClasses.length) {
    listEl.innerHTML = `<div class="empty-state">${t('no_classes')}</div>`;
    selectedIds.clear();
    updateSelectionBar();
    return;
  }
  // Drop selections that are no longer bookable (filled up, closed, ...).
  [...selectedIds].forEach((id) => {
    const c = lastClasses.find((x) => x.id === id);
    if (!c || !isBookable(c)) selectedIds.delete(id);
  });
  listEl.innerHTML = lastClasses.map(renderCard).join('');
  listEl.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
      renderClassList();
    });
  });
  updateSelectionBar();
  scheduleReleaseRefresh();
}

function isBookable(cls) {
  return !!cls.is_open && cls.spots_left > 0 && !isNotYetReleased(cls) &&
    !(cls.ends_at && new Date(cls.ends_at) < new Date());
}

function updateSelectionBar() {
  const bar = document.getElementById('selectionBar');
  if (!bar) return;
  const chosen = lastClasses.filter((c) => selectedIds.has(c.id));
  if (!chosen.length) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }
  const total = chosen.reduce((sum, c) => sum + Number(c.price_dkk || 0), 0);
  bar.hidden = false;
  bar.innerHTML = `
    <span class="selection-summary">${t('selection_summary', { n: chosen.length, total: dkkFormat(total) })}</span>
    <button type="button" class="btn-link" id="clearSelectionBtn">${t('selection_clear_btn')}</button>
    <button type="button" class="btn btn-primary" id="continueBtn">${t('selection_continue_btn')}</button>
  `;
  document.getElementById('clearSelectionBtn').addEventListener('click', () => {
    selectedIds.clear();
    renderClassList();
  });
  document.getElementById('continueBtn').addEventListener('click', () => {
    openRegisterModal(chosen.map((c) => c.id), lastClasses);
  });
}

// Decided on the person's own clock, so a class unlocks at the exact release
// moment even if the app has been open for hours.
function isNotYetReleased(cls) {
  return !!cls.release_at && new Date(cls.release_at).getTime() > Date.now();
}

let releaseTimer = null;
function scheduleReleaseRefresh() {
  clearTimeout(releaseTimer);
  const upcoming = lastClasses
    .filter(isNotYetReleased)
    .map((c) => new Date(c.release_at).getTime());
  if (!upcoming.length) return;
  const wait = Math.min(Math.min(...upcoming) - Date.now() + 500, 30_000);
  releaseTimer = setTimeout(() => {
    if (lastClasses.some((c) => c.release_at && new Date(c.release_at).getTime() <= Date.now() && c._shownLocked)) {
      loadClasses(true); // a release just passed: refetch fresh data and unlock
    } else {
      scheduleReleaseRefresh();
    }
  }, Math.max(wait, 500));
}

function renderCard(cls) {
  const upcoming = isNotYetReleased(cls);
  cls._shownLocked = upcoming;
  // Open = not manually closed, spots left, not ended, and released (checked locally).
  const open = isBookable(cls);
  const picked = selectedIds.has(cls.id);
  const closed = !open;
  const lowSpots = cls.spots_left > 0 && cls.spots_left <= 3;

  return `
    <article class="class-card ${upcoming ? 'is-upcoming' : closed ? 'is-closed' : ''} ${picked ? 'is-picked' : ''}">
      <div class="class-top">
        <div>
          <h3 class="class-title">${escapeHtml(cls.title)}</h3>
          <p class="class-meta">${t('starts_label')} ${formatDate(cls.starts_at)}${cls.location ? ' · ' + locationHtml(cls) : ''}</p>
        </div>
      </div>
      ${cls.description ? `<p class="class-desc">${escapeHtml(cls.description)}</p>` : ''}
      <div class="class-bottom">
        <span class="price">${dkkFormat(cls.price_dkk)}</span>
        <span class="spots ${lowSpots ? 'low' : ''}">
          ${upcoming ? t('opens_at_label', { date: formatDate(cls.release_at) }) : closed ? t('class_full_label') : tPlural('spots_left', cls.spots_left)}
        </span>
        ${
          closed
            ? `<button class="btn btn-disabled" disabled>${upcoming ? t('opens_soon_btn') : t('registration_closed_btn')}</button>`
            : `<button class="btn ${picked ? 'btn-selected' : 'btn-primary'}" data-toggle="${cls.id}" aria-pressed="${picked}">${picked ? t('selected_btn') : t('select_btn')}</button>`
        }
      </div>
    </article>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function detectMapPlatform() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

// If the admin set an explicit "Link til kort" it always wins (useful when
// an address doesn't geocode well). Otherwise, build a link tailored to
// the visitor's device:
//  - Android: a geo: URI, which triggers the OS's native "open with"
//    chooser (Google Maps, Waze, whatever's installed) - iOS has no
//    equivalent OS-level chooser for websites, so this only applies here.
//  - iOS: opens directly in Apple Maps.
//  - Everything else (desktop etc.): Google Maps in the browser.
function locationHref(cls) {
  if (cls.location_url) return cls.location_url;
  const query = encodeURIComponent(cls.location);
  const platform = detectMapPlatform();
  if (platform === 'android') return `geo:0,0?q=${query}`;
  if (platform === 'ios') return `https://maps.apple.com/?q=${query}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function locationHtml(cls) {
  const label = escapeHtml(cls.location);
  const href = locationHref(cls);
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="map-link">${label}</a>`;
}

function openRegisterModal(classIds, classes) {
  const ids = Array.isArray(classIds) ? classIds : [classIds];
  const selected = ids.map((id) => classes.find((c) => c.id === id)).filter(Boolean);
  if (!selected.length) return;
  const cls = selected[0];
  const multi = selected.length > 1;
  const total = selected.reduce((sum, c) => sum + Number(c.price_dkk || 0), 0);

  // Payment methods every selected class accepts.
  const canMobile = selected.every((c) => (c.payment_options || 'both') !== 'pay_at_class');
  const canClass = selected.every((c) => (c.payment_options || 'both') !== 'mobilepay');
  const opts = canMobile && canClass ? 'both' : canMobile ? 'mobilepay' : 'pay_at_class';
  const defaultMethod = opts === 'pay_at_class' ? 'pay_at_class' : 'mobilepay';
  const conflict = !canMobile && !canClass;

  const root = document.getElementById('modalRoot');

  if (conflict) {
    root.innerHTML = `
      <div class="modal-backdrop" id="backdrop">
        <div class="modal" role="dialog" aria-modal="true">
          <h3>${t('multi_modal_title', { n: selected.length })}</h3>
          <p class="sub">${t('err_methods_conflict')}</p>
          <div class="modal-actions"><button type="button" class="btn btn-secondary" id="cancelBtn">${t('cancel_btn')}</button></div>
        </div>
      </div>`;
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    document.getElementById('backdrop').addEventListener('click', (e) => { if (e.target.id === 'backdrop') closeModal(); });
    return;
  }

  const headHtml = multi
    ? `<h3 id="modalTitle">${t('multi_modal_title', { n: selected.length })}</h3>
       <ul class="sel-list">
         ${selected.map((c) => `<li><span>${escapeHtml(c.title)}<small>${formatDate(c.starts_at)}</small></span><span>${dkkFormat(c.price_dkk)}</span></li>`).join('')}
         <li class="sel-total"><span>${t('modal_total_label')}</span><span>${dkkFormat(total)}</span></li>
       </ul>`
    : `<h3 id="modalTitle">${escapeHtml(cls.title)}</h3>
       <p class="sub">${tPlural('modal_price_spots', cls.spots_left, { price: dkkFormat(cls.price_dkk) })}</p>`;

  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        ${headHtml}

        <form id="regForm">
          <div class="field">
            <label for="owner_name">${t('field_owner_name')}</label>
            <input id="owner_name" name="owner_name" required autocomplete="name" />
          </div>
          ${multi
            ? selected.map((c) => `
          <div class="field">
            <label for="dog_${c.id}">${t('field_dog_name')} – ${escapeHtml(c.title)}</label>
            <input id="dog_${c.id}" name="dog_${c.id}" autocomplete="off" />
          </div>`).join('')
            : `
          <div class="field">
            <label for="dog_name">${t('field_dog_name')}</label>
            <input id="dog_name" name="dog_name" autocomplete="off" />
          </div>`}
          <div class="field">
            <label for="email">${t('field_email')}</label>
            <input id="email" name="email" type="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label for="phone">${t('field_phone')}</label>
            <input id="phone" name="phone" type="tel" required autocomplete="tel" placeholder="+45 12 34 56 78" />
            <p class="field-note" id="phoneNote">${t(defaultMethod === 'pay_at_class' ? 'phone_note_pay_at_class' : 'phone_note_mobilepay')}</p>
          </div>

          <label class="checkbox-row">
            <input type="checkbox" id="newsletter_opt_in" name="newsletter_opt_in" />
            <span>${t('newsletter_label')}</span>
          </label>

          <label class="checkbox-row terms-row">
            <input type="checkbox" id="accept_terms" name="accept_terms" required />
            <span>${t('terms_accept_label')}</span>
          </label>

          ${opts === 'both' ? `
          <fieldset class="payment-choice">
            <legend>${t('payment_legend')}</legend>
            <label class="radio-row">
              <input type="radio" name="payment_method" value="mobilepay" checked />
              <span>${t('pay_mobilepay_label')}</span>
            </label>
            <label class="radio-row">
              <input type="radio" name="payment_method" value="pay_at_class" />
              <span>${t('pay_at_class_label')}</span>
            </label>
          </fieldset>` : `<input type="hidden" name="payment_method" value="${defaultMethod}" />`}

          <div id="formError" class="form-error" hidden></div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cancelBtn">${t('cancel_btn')}</button>
            <button type="submit" class="btn btn-primary" id="payBtn">${t(defaultMethod === 'pay_at_class' ? 'confirm_submit_btn' : 'register_submit_btn')}</button>
          </div>

          <p class="pay-note" id="payNote">${t(defaultMethod === 'pay_at_class' ? 'pay_note_pay_at_class' : 'pay_note_mobilepay')}</p>
        </form>
      </div>
    </div>
  `;

  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'backdrop') closeModal();
  });

  const payNote = document.getElementById('payNote');
  const phoneNote = document.getElementById('phoneNote');
  const payBtn = document.getElementById('payBtn');
  document.querySelectorAll('input[name="payment_method"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'pay_at_class') {
        payNote.textContent = t('pay_note_pay_at_class');
        payBtn.textContent = t('confirm_submit_btn');
        phoneNote.textContent = t('phone_note_pay_at_class');
      } else {
        payNote.textContent = t('pay_note_mobilepay');
        payBtn.textContent = t('register_submit_btn');
        phoneNote.textContent = t('phone_note_mobilepay');
      }
    });
  });

  document.getElementById('regForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('formError');
    errorEl.hidden = true;

    if (!document.getElementById('accept_terms').checked) {
      errorEl.textContent = t('terms_required');
      errorEl.hidden = false;
      return;
    }

    const formData = new FormData(e.target);
    const paymentMethod = formData.get('payment_method') || 'mobilepay';
    const originalLabel = paymentMethod === 'pay_at_class' ? t('confirm_submit_btn') : t('register_submit_btn');

    payBtn.disabled = true;
    payBtn.textContent = paymentMethod === 'pay_at_class' ? t('confirming_btn') : t('starting_payment_btn');

    const payload = {
      class_ids: selected.map((c) => c.id),
      owner_name: formData.get('owner_name'),
      dog_name: multi ? null : formData.get('dog_name'),
      // One dog name per class (a different dog can go to each class).
      dog_names: multi
        ? Object.fromEntries(selected.map((c) => [c.id, (formData.get(`dog_${c.id}`) || '').trim()]))
        : undefined,
      email: formData.get('email'),
      phone: formData.get('phone'),
      payment_method: paymentMethod,
      newsletter_opt_in: formData.get('newsletter_opt_in') === 'on',
    };

    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        const base = translateApiError(data.error);
        throw new Error(data.class_title ? `${base}: ${data.class_title}` : base);
      }

      // MobilePay -> their app to approve payment. Pay-at-class -> our own
      // confirmation page, since the seat is already booked.
      window.location.href = data.redirect_url;
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      payBtn.disabled = false;
      payBtn.textContent = originalLabel;
    }
  });
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

// Re-render class cards in the new language; close any open modal since
// its text won't update in place.
window.addEventListener('langchange', () => {
  closeModal();
  renderClassList();
});

loadClasses();

// Keep the class list fresh without the person needing to manually
// reload - important for a PWA someone leaves open on their phone.
// Polling (not real-time push) is deliberate here: simple, no extra
// infrastructure, and doesn't touch an open registration modal since it
// only replaces the #classList contents.
const POLL_INTERVAL_MS = 30_000;
setInterval(() => loadClasses(true), POLL_INTERVAL_MS);

// Also refresh immediately whenever they come back to the app/tab -
// covers switching back from another app on their phone, or returning
// to a backgrounded browser tab, without waiting for the next poll tick.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadClasses(true);
});
window.addEventListener('focus', () => loadClasses(true));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}


// ---- Front-page newsletter signup (double opt-in, no class needed) ----
(function () {
  const form = document.getElementById('nlForm');
  if (!form) return;
  const msg = document.getElementById('nlMsg');
  const btn = document.getElementById('nlBtn');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.hidden = true;
    const email = document.getElementById('nlEmail').value.trim();
    if (!email) return;
    btn.disabled = true;
    btn.textContent = t('nl_signup_sending');
    try {
      const res = await fetch(`${API}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website: document.getElementById('nlWebsite').value }),
      });
      if (!res.ok) throw new Error('failed');
      msg.textContent = t('nl_signup_ok');
      msg.className = 'nl-msg ok';
      form.reset();
    } catch {
      msg.textContent = t('nl_signup_error');
      msg.className = 'nl-msg err';
    }
    msg.hidden = false;
    btn.disabled = false;
    btn.textContent = t('nl_signup_btn');
  });
})();
