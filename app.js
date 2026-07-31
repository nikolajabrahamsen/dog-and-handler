const API = '/api';

const dkkFormatter = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  maximumFractionDigits: 0,
});

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

async function loadClasses() {
  const listEl = document.getElementById('classList');
  try {
    const res = await fetch(`${API}/classes`);
    const classes = await res.json();

    if (!classes.length) {
      listEl.innerHTML = `<div class="empty-state">No classes are open yet — check back soon.</div>`;
      return;
    }

    listEl.innerHTML = classes.map(renderCard).join('');

    listEl.querySelectorAll('[data-register]').forEach((btn) => {
      btn.addEventListener('click', () => openRegisterModal(btn.dataset.register, classes));
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">Couldn't load classes right now. Pull to refresh or try again shortly.</div>`;
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
          <p class="class-meta">${cls.weekday ? escapeHtml(cls.weekday) + ' · ' : ''}Starts ${formatDate(cls.starts_at)}${cls.location ? ' · ' + escapeHtml(cls.location) : ''}</p>
        </div>
      </div>
      ${cls.description ? `<p class="class-desc">${escapeHtml(cls.description)}</p>` : ''}
      <div class="class-bottom">
        <span class="price">${dkkFormatter.format(cls.price_dkk)}</span>
        <span class="spots ${lowSpots ? 'low' : ''}">
          ${closed ? 'Class is full' : `${cls.spots_left} spot${cls.spots_left === 1 ? '' : 's'} left`}
        </span>
        ${
          closed
            ? `<button class="btn btn-disabled" disabled>Registration closed</button>`
            : `<button class="btn btn-primary" data-register="${cls.id}">Register</button>`
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

function openRegisterModal(classId, classes) {
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return;

  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <h3 id="modalTitle">${escapeHtml(cls.title)}</h3>
        <p class="sub">${dkkFormatter.format(cls.price_dkk)} · ${cls.spots_left} spot${cls.spots_left === 1 ? '' : 's'} left</p>

        <form id="regForm">
          <div class="field">
            <label for="owner_name">Your name</label>
            <input id="owner_name" name="owner_name" required autocomplete="name" />
          </div>
          <div class="field">
            <label for="dog_name">Dog's name</label>
            <input id="dog_name" name="dog_name" autocomplete="off" />
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label for="phone">Phone (for MobilePay)</label>
            <input id="phone" name="phone" type="tel" required autocomplete="tel" placeholder="+45 12 34 56 78" />
          </div>

          <div id="formError" class="form-error" hidden></div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="payBtn">Pay with MobilePay</button>
          </div>

          <p class="pay-note">You'll be taken to MobilePay to approve the payment. Your spot is only confirmed once the payment goes through.</p>
        </form>
      </div>
    </div>
  `;

  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'backdrop') closeModal();
  });

  document.getElementById('regForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('formError');
    const payBtn = document.getElementById('payBtn');
    errorEl.hidden = true;
    payBtn.disabled = true;
    payBtn.textContent = 'Starting payment…';

    const formData = new FormData(e.target);
    const payload = {
      class_id: cls.id,
      owner_name: formData.get('owner_name'),
      dog_name: formData.get('dog_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
    };

    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Send them into MobilePay to approve the payment.
      window.location.href = data.redirect_url;
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      payBtn.disabled = false;
      payBtn.textContent = 'Pay with MobilePay';
    }
  });
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

loadClasses();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}
