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

async function loadClasses(silent = false) {
  const listEl = document.getElementById('classList');
  if (!silent) {
    listEl.innerHTML = `<p style="color: var(--bone-dim)">${t('loading_classes')}</p>`;
  }
  try {
    const res = await fetch(`${API}/classes`);
    const classes = await res.json();
    lastClasses = classes;

    if (!classes.length) {
      listEl.innerHTML = `<div class="empty-state">${t('no_classes')}</div>`;
      return;
    }

    listEl.innerHTML = classes.map(renderCard).join('');

    listEl.querySelectorAll('[data-register]').forEach((btn) => {
      btn.addEventListener('click', () => openRegisterModal(btn.dataset.register, classes));
    });
  } catch (err) {
    if (!silent) listEl.innerHTML = `<div class="empty-state">${t('load_error')}</div>`;
    console.error(err);
  }
}

function renderCard(cls) {
  const closed = !cls.registration_open;
  const lowSpots = cls.spots_left > 0 && cls.spots_left <= 3;

  return `
    <article class="class-card ${closed ? 'is-closed' : ''}">
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
          ${closed ? t('class_full_label') : tPlural('spots_left', cls.spots_left)}
        </span>
        ${
          closed
            ? `<button class="btn btn-disabled" disabled>${t('registration_closed_btn')}</button>`
            : `<button class="btn btn-primary" data-register="${cls.id}">${t('register_btn')}</button>`
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

function openRegisterModal(classId, classes) {
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return;

  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <h3 id="modalTitle">${escapeHtml(cls.title)}</h3>
        <p class="sub">${tPlural('modal_price_spots', cls.spots_left, { price: dkkFormat(cls.price_dkk) })}</p>

        <form id="regForm">
          <div class="field">
            <label for="owner_name">${t('field_owner_name')}</label>
            <input id="owner_name" name="owner_name" required autocomplete="name" />
          </div>
          <div class="field">
            <label for="dog_name">${t('field_dog_name')}</label>
            <input id="dog_name" name="dog_name" autocomplete="off" />
          </div>
          <div class="field">
            <label for="email">${t('field_email')}</label>
            <input id="email" name="email" type="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label for="phone">${t('field_phone')}</label>
            <input id="phone" name="phone" type="tel" required autocomplete="tel" placeholder="+45 12 34 56 78" />
            <p class="field-note" id="phoneNote">${t('phone_note_mobilepay')}</p>
          </div>

          <label class="checkbox-row">
            <input type="checkbox" id="newsletter_opt_in" name="newsletter_opt_in" />
            <span>${t('newsletter_label')}</span>
          </label>

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
          </fieldset>

          <div id="formError" class="form-error" hidden></div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cancelBtn">${t('cancel_btn')}</button>
            <button type="submit" class="btn btn-primary" id="payBtn">${t('register_submit_btn')}</button>
          </div>

          <p class="pay-note" id="payNote">${t('pay_note_mobilepay')}</p>
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

    const formData = new FormData(e.target);
    const paymentMethod = formData.get('payment_method') || 'mobilepay';
    const originalLabel = paymentMethod === 'pay_at_class' ? t('confirm_submit_btn') : t('register_submit_btn');

    payBtn.disabled = true;
    payBtn.textContent = paymentMethod === 'pay_at_class' ? t('confirming_btn') : t('starting_payment_btn');

    const payload = {
      class_id: cls.id,
      owner_name: formData.get('owner_name'),
      dog_name: formData.get('dog_name'),
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
        throw new Error(translateApiError(data.error));
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
  if (lastClasses.length) {
    const listEl = document.getElementById('classList');
    listEl.innerHTML = lastClasses.map(renderCard).join('');
    listEl.querySelectorAll('[data-register]').forEach((btn) => {
      btn.addEventListener('click', () => openRegisterModal(btn.dataset.register, lastClasses));
    });
  }
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
