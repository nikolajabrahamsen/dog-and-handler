const API = '/api';
const client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);

let accessToken = null;
let lastClasses = [];

async function requireSession() {
  const { data } = await client.auth.getSession();
  if (!data.session) {
    window.location.href = '/login.html';
    return null;
  }
  accessToken = data.session.access_token;
  document.getElementById('userEmail').textContent = data.session.user.email;
  return data.session;
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` };
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await client.auth.signOut();
  window.location.href = '/login.html';
});

document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('createMsg');
  msg.hidden = true;

  const body = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    starts_at: new Date(document.getElementById('starts_at').value).toISOString(),
    weekday: document.getElementById('weekday').value,
    location: document.getElementById('location').value,
    max_participants: Number(document.getElementById('max_participants').value),
    price_dkk: Number(document.getElementById('price_dkk').value),
  };

  try {
    const res = await fetch(`${API}/classes`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('err_generic'));

    msg.textContent = t('class_created_msg');
    msg.style.color = 'var(--brass-bright)';
    msg.hidden = false;
    e.target.reset();
    loadClasses();
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = 'var(--clay)';
    msg.hidden = false;
  }
});

async function loadClasses() {
  const el = document.getElementById('classesList');
  try {
    const res = await fetch(`${API}/classes`);
    const classes = await res.json();
    lastClasses = classes;
    renderClasses();

    classes.forEach((cls) => {
      const closeBtn = document.getElementById(`close-${cls.id}`);
      const openBtn = document.getElementById(`open-${cls.id}`);
      const rosterBtn = document.getElementById(`roster-${cls.id}`);
      if (closeBtn) closeBtn.addEventListener('click', () => toggleOpen(cls.id, false));
      if (openBtn) openBtn.addEventListener('click', () => toggleOpen(cls.id, true));
      if (rosterBtn) rosterBtn.addEventListener('click', () => loadRoster(cls.id));
    });
  } catch (err) {
    el.innerHTML = `<p style="color:var(--clay)">${t('load_error')}</p>`;
  }
}

function renderClasses() {
  const el = document.getElementById('classesList');
  if (!lastClasses.length) {
    el.innerHTML = `<p style="color:var(--bone-dim)">${t('no_classes_yet')}</p>`;
    return;
  }
  el.innerHTML = lastClasses.map(classBlock).join('');
  lastClasses.forEach((cls) => {
    const closeBtn = document.getElementById(`close-${cls.id}`);
    const openBtn = document.getElementById(`open-${cls.id}`);
    const rosterBtn = document.getElementById(`roster-${cls.id}`);
    if (closeBtn) closeBtn.addEventListener('click', () => toggleOpen(cls.id, false));
    if (openBtn) openBtn.addEventListener('click', () => toggleOpen(cls.id, true));
    if (rosterBtn) rosterBtn.addEventListener('click', () => loadRoster(cls.id));
  });
}

function classBlock(cls) {
  return `
    <div style="border-top:1px solid var(--line); padding: 14px 0;">
      <strong>${cls.title}</strong>
      <div style="color:var(--bone-dim); font-size:13px">
        ${cls.confirmed_count}/${cls.max_participants} ${t('confirmed_label')} ·
        ${cls.registration_open ? t('open_label') : t('closed_label')} ·
        ${new Date(cls.starts_at).toLocaleString(getLang() === 'en' ? 'en-GB' : 'da-DK')}
      </div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        ${cls.is_open
          ? `<button class="btn btn-secondary" id="close-${cls.id}">${t('close_manually_btn')}</button>`
          : `<button class="btn btn-secondary" id="open-${cls.id}">${t('reopen_btn')}</button>`}
        <button class="btn btn-secondary" id="roster-${cls.id}">${t('view_roster_btn')}</button>
      </div>
      <div id="rosterBox-${cls.id}"></div>
    </div>
  `;
}

async function toggleOpen(id, isOpen) {
  await fetch(`${API}/classes/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ is_open: isOpen ? 1 : 0 }),
  });
  loadClasses();
}

async function loadRoster(id) {
  const box = document.getElementById(`rosterBox-${id}`);
  box.innerHTML = t('loading_roster');
  try {
    const res = await fetch(`${API}/classes/${id}/registrations`, { headers: authHeaders() });
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || t('err_generic'));

    if (!rows.length) {
      box.innerHTML = `<p style="color:var(--bone-dim); font-size:13px">${t('no_registrations_yet')}</p>`;
      return;
    }

    box.innerHTML = `
      <table>
        <thead><tr><th>${t('col_owner')}</th><th>${t('col_dog')}</th><th>${t('col_email')}</th><th>${t('col_phone')}</th><th>${t('col_payment')}</th><th>${t('col_status')}</th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${r.owner_name}</td>
              <td>${r.dog_name || '—'}</td>
              <td>${r.email}</td>
              <td>${r.phone}</td>
              <td>${r.payment_method === 'pay_at_class' ? t('payment_at_class') : t('payment_mobilepay')}</td>
              <td><span class="tag tag-${r.status}">${r.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    box.innerHTML = `<p style="color:var(--clay); font-size:13px">${err.message}</p>`;
  }
}

async function loadSubscriberCount() {
  const el = document.getElementById('subscriberCount');
  try {
    const res = await fetch(`${API}/admin/newsletter`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('err_generic'));
    el.removeAttribute('data-i18n');
    el.textContent = t('subscriber_count_msg', { n: data.count });
  } catch (err) {
    el.removeAttribute('data-i18n');
    el.textContent = t('load_error');
  }
}

document.getElementById('newsletterForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('nlMsg');
  const btn = document.getElementById('nlSendBtn');
  msg.hidden = true;
  btn.disabled = true;
  btn.textContent = t('sending_btn');

  const body = {
    subject: document.getElementById('nlSubject').value,
    message: document.getElementById('nlMessage').value,
  };

  try {
    const res = await fetch(`${API}/admin/newsletter`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('err_generic'));

    msg.textContent = data.sent != null ? `${data.sent} / ${data.sent + data.failed}` : data.message;
    msg.style.color = data.failed ? 'var(--clay)' : 'var(--brass-bright)';
    msg.hidden = false;
    e.target.reset();
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = 'var(--clay)';
    msg.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = t('send_newsletter_btn');
  }
});

window.addEventListener('langchange', () => {
  renderClasses();
  loadSubscriberCount();
});

(async function init() {
  const session = await requireSession();
  if (!session) return;
  loadClasses();
  loadSubscriberCount();
})();
