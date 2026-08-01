const API = '/api';
const client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);

let accessToken = null;
let lastClasses = [];
let editingClassId = null;

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

function exitEditMode() {
  editingClassId = null;
  document.getElementById('createFormHeading').textContent = t('create_class_heading');
  document.getElementById('createSubmitBtn').textContent = t('create_class_btn');
  document.getElementById('cancelEditBtn').hidden = true;
  document.getElementById('createForm').reset();
}

document.getElementById('cancelEditBtn').addEventListener('click', exitEditMode);

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

function openChangePasswordModal() {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="cpBackdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cpTitle">
        <h3 id="cpTitle">${t('change_password_heading')}</h3>

        <form id="changePasswordForm">
          <div class="field">
            <label for="newPassword">${t('new_password_label')}</label>
            <input id="newPassword" type="password" required minlength="8" autocomplete="new-password" />
          </div>
          <div class="field">
            <label for="newPassword2">${t('confirm_new_password_label')}</label>
            <input id="newPassword2" type="password" required minlength="8" autocomplete="new-password" />
          </div>

          <div id="changePasswordMsg" class="form-error" hidden></div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="cpCancelBtn">${t('cancel_btn')}</button>
            <button type="submit" class="btn btn-primary" id="changePasswordBtn">${t('change_password_btn')}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('cpCancelBtn').addEventListener('click', closeModal);
  document.getElementById('cpBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'cpBackdrop') closeModal();
  });

  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('changePasswordMsg');
    const btn = document.getElementById('changePasswordBtn');
    msg.hidden = true;
    msg.style.color = 'var(--clay)';

    const p1 = document.getElementById('newPassword').value;
    const p2 = document.getElementById('newPassword2').value;

    if (p1 !== p2) {
      msg.textContent = t('passwords_dont_match');
      msg.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = t('saving_btn');

    const { error } = await client.auth.updateUser({ password: p1 });

    if (error) {
      msg.textContent = error.message;
      msg.hidden = false;
      btn.disabled = false;
      btn.textContent = t('change_password_btn');
      return;
    }

    msg.style.color = 'var(--brass-bright)';
    msg.textContent = t('password_changed_msg');
    msg.hidden = false;
    btn.disabled = true;
    setTimeout(closeModal, 1100);
  });
}

document.getElementById('changePasswordOpenBtn').addEventListener('click', openChangePasswordModal);

function openAddParticipantModal(cls) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="apBackdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="apTitle">
        <h3 id="apTitle">${t('add_participant_heading')}</h3>
        <p class="sub">${escapeHtmlAdmin(cls.title)}</p>

        <form id="addParticipantForm">
          <div class="field">
            <label for="apOwnerName">${t('field_owner_name')}</label>
            <input id="apOwnerName" required />
          </div>
          <div class="field">
            <label for="apDogName">${t('field_dog_name')}</label>
            <input id="apDogName" />
          </div>
          <div class="field">
            <label for="apEmail">${t('field_email')}</label>
            <input id="apEmail" type="email" required />
          </div>
          <div class="field">
            <label for="apPhone">${t('field_phone')}</label>
            <input id="apPhone" type="tel" required />
          </div>

          <div id="apMsg" class="form-error" hidden></div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="apCancelBtn">${t('cancel_btn')}</button>
            <button type="submit" class="btn btn-primary" id="apSubmitBtn">${t('add_participant_btn')}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('apCancelBtn').addEventListener('click', closeModal);
  document.getElementById('apBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'apBackdrop') closeModal();
  });

  document.getElementById('addParticipantForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('apMsg');
    const btn = document.getElementById('apSubmitBtn');
    msg.hidden = true;
    btn.disabled = true;
    btn.textContent = t('saving_btn');

    const body = {
      owner_name: document.getElementById('apOwnerName').value,
      dog_name: document.getElementById('apDogName').value,
      email: document.getElementById('apEmail').value,
      phone: document.getElementById('apPhone').value,
    };

    try {
      const res = await fetch(`${API}/admin/classes/${cls.id}/participants`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('err_generic'));

      closeModal();
      await loadClasses();
      await loadRoster(cls.id);
    } catch (err) {
      msg.textContent = err.message;
      msg.hidden = false;
      btn.disabled = false;
      btn.textContent = t('add_participant_btn');
    }
  });
}

function openMoveModal(reg, currentClassId) {
  const otherClasses = lastClasses.filter((c) => c.id !== currentClassId && !c.is_expired);
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="mvBackdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mvTitle">
        <h3 id="mvTitle">${t('move_registration_heading')}</h3>
        <p class="sub">${escapeHtmlAdmin(reg.owner_name)}</p>

        <form id="moveForm">
          <div class="field">
            <label for="mvClassSelect">${t('select_class_label')}</label>
            <select id="mvClassSelect" required>
              ${otherClasses.length
                ? otherClasses.map((c) => `<option value="${c.id}">${escapeHtmlAdmin(c.title)} — ${new Date(c.starts_at).toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'da-DK')} (${tPlural('spots_left', c.spots_left)})</option>`).join('')
                : `<option value="" disabled>${t('no_classes_yet')}</option>`}
            </select>
          </div>

          <div id="mvMsg" class="form-error" hidden></div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" id="mvCancelBtn">${t('cancel_btn')}</button>
            <button type="submit" class="btn btn-primary" id="mvSubmitBtn" ${otherClasses.length ? '' : 'disabled'}>${t('move_btn')}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('mvCancelBtn').addEventListener('click', closeModal);
  document.getElementById('mvBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'mvBackdrop') closeModal();
  });

  document.getElementById('moveForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('mvMsg');
    const btn = document.getElementById('mvSubmitBtn');
    msg.hidden = true;
    btn.disabled = true;
    btn.textContent = t('saving_btn');

    const newClassId = document.getElementById('mvClassSelect').value;

    try {
      const res = await fetch(`${API}/admin/registrations/${reg.id}/move`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ new_class_id: newClassId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('err_generic'));

      closeModal();
      await loadClasses();
      await loadRoster(currentClassId);
    } catch (err) {
      msg.textContent = err.message;
      msg.hidden = false;
      btn.disabled = false;
      btn.textContent = t('move_btn');
    }
  });
}

function escapeHtmlAdmin(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('createMsg');
  msg.hidden = true;

  const endsAtVal = document.getElementById('ends_at').value;
  const releaseAtVal = document.getElementById('release_at').value;
  const body = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    starts_at: new Date(document.getElementById('starts_at').value).toISOString(),
    ends_at: endsAtVal ? new Date(endsAtVal).toISOString() : null,
    release_at: releaseAtVal ? new Date(releaseAtVal).toISOString() : null,
    announce_before_release: document.getElementById('announce_before_release').checked,
    location: document.getElementById('location').value,
    location_url: document.getElementById('location_url').value || null,
    max_participants: Number(document.getElementById('max_participants').value),
    price_dkk: Number(document.getElementById('price_dkk').value),
  };

  const isEditing = !!editingClassId;
  const url = isEditing ? `${API}/classes/${editingClassId}` : `${API}/classes`;
  const method = isEditing ? 'PATCH' : 'POST';

  try {
    const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('err_generic'));

    msg.textContent = isEditing ? t('class_updated_msg') : t('class_created_msg');
    msg.style.color = 'var(--brass-bright)';
    msg.hidden = false;
    if (isEditing) exitEditMode();
    else e.target.reset();
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
    const res = await fetch(`${API}/classes`, { headers: authHeaders() });
    const classes = await res.json();
    lastClasses = classes;
    renderClasses();
  } catch (err) {
    el.innerHTML = `<p style="color:var(--clay)">${t('load_error')}</p>`;
  }
}

function wireClassButtons(cls) {
  const closeBtn = document.getElementById(`close-${cls.id}`);
  const openBtn = document.getElementById(`open-${cls.id}`);
  const rosterBtn = document.getElementById(`roster-${cls.id}`);
  const copyBtn = document.getElementById(`copy-${cls.id}`);
  const editBtn = document.getElementById(`edit-${cls.id}`);
  const deleteBtn = document.getElementById(`delete-${cls.id}`);
  const addPartBtn = document.getElementById(`addpart-${cls.id}`);
  if (closeBtn) closeBtn.addEventListener('click', () => toggleOpen(cls.id, false));
  if (openBtn) openBtn.addEventListener('click', () => toggleOpen(cls.id, true));
  if (rosterBtn) rosterBtn.addEventListener('click', () => loadRoster(cls.id));
  if (copyBtn) copyBtn.addEventListener('click', () => copyClass(cls));
  if (editBtn) editBtn.addEventListener('click', () => editClass(cls));
  if (deleteBtn) deleteBtn.addEventListener('click', () => deleteClass(cls));
  if (addPartBtn) addPartBtn.addEventListener('click', () => openAddParticipantModal(cls));
}

function renderClasses() {
  const currentEl = document.getElementById('classesList');
  const oldEl = document.getElementById('oldClassesList');
  const oldHeading = document.getElementById('oldClassesHeading');

  const current = lastClasses.filter((c) => !c.is_expired);
  const old = lastClasses.filter((c) => c.is_expired);

  currentEl.innerHTML = current.length
    ? current.map(classBlock).join('')
    : `<p style="color:var(--bone-dim)">${t('no_classes_yet')}</p>`;
  current.forEach(wireClassButtons);

  oldHeading.hidden = old.length === 0;
  oldEl.innerHTML = old.map(classBlock).join('');
  old.forEach(wireClassButtons);
}

function classBlock(cls) {
  return `
    <div style="border-top:1px solid var(--line); padding: 14px 0;">
      <strong>${cls.title}</strong>
      ${cls.not_yet_released ? `<span class="tag" style="background:rgba(200,155,60,0.2); color:var(--brass-bright); margin-left:8px;">${t('not_released_yet_label', { date: new Date(cls.release_at).toLocaleString(getLang() === 'en' ? 'en-GB' : 'da-DK') })}</span>` : ''}
      <div style="color:var(--bone-dim); font-size:13px; line-height:1.6;">
        ${t('paid_count_label', { n: cls.paid_count })} ·
        ${t('pay_at_class_count_label', { n: cls.pay_at_class_confirmed_count })} ·
        ${t('reserved_count_label', { n: cls.reserved_count })} ·
        ${t('empty_count_label', { n: cls.spots_left })}
        (${cls.max_participants} ${t('total_label')})<br/>
        ${cls.registration_open ? t('open_label') : t('closed_label')} ·
        ${new Date(cls.starts_at).toLocaleString(getLang() === 'en' ? 'en-GB' : 'da-DK')}
      </div>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        ${!cls.is_expired
          ? (cls.is_open
              ? `<button class="btn btn-secondary" id="close-${cls.id}">${t('close_manually_btn')}</button>`
              : `<button class="btn btn-secondary" id="open-${cls.id}">${t('reopen_btn')}</button>`)
          : ''}
        <button class="btn btn-secondary" id="roster-${cls.id}">${t('view_roster_btn')}</button>
        <button class="btn btn-secondary" id="addpart-${cls.id}">${t('add_participant_btn')}</button>
        <button class="btn btn-secondary" id="copy-${cls.id}">${t('copy_class_btn')}</button>
        <button class="btn btn-secondary" id="edit-${cls.id}">${t('edit_class_btn')}</button>
        <button class="btn btn-secondary btn-danger" id="delete-${cls.id}">${t('delete_class_btn')}</button>
      </div>
      <div id="rosterBox-${cls.id}"></div>
    </div>
  `;
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Pre-fills the form with everything, including the dates, and switches
// the form into "save changes" mode instead of "create new".
function editClass(cls) {
  editingClassId = cls.id;
  document.getElementById('title').value = cls.title || '';
  document.getElementById('description').value = cls.description || '';
  document.getElementById('location').value = cls.location || '';
  document.getElementById('location_url').value = cls.location_url || '';
  document.getElementById('max_participants').value = cls.max_participants ?? '';
  document.getElementById('price_dkk').value = cls.price_dkk ?? '';
  document.getElementById('starts_at').value = toDatetimeLocalValue(cls.starts_at);
  document.getElementById('ends_at').value = toDatetimeLocalValue(cls.ends_at);
  document.getElementById('release_at').value = toDatetimeLocalValue(cls.release_at);
  document.getElementById('announce_before_release').checked = !!cls.announce_before_release;

  document.getElementById('createFormHeading').textContent = t('edit_class_heading');
  document.getElementById('createSubmitBtn').textContent = t('save_changes_btn');
  document.getElementById('cancelEditBtn').hidden = false;

  document.getElementById('createClassCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteClass(cls) {
  if (!window.confirm(t('confirm_delete_class', { title: cls.title }))) return;

  try {
    const res = await fetch(`${API}/classes/${cls.id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('err_generic'));
    if (editingClassId === cls.id) exitEditMode();
    loadClasses();
  } catch (err) {
    window.alert(err.message);
  }
}

// Pre-fills the "Create a class" form with everything except the dates,
// so the admin just picks new start/end dates and submits.
function copyClass(cls) {
  document.getElementById('title').value = cls.title || '';
  document.getElementById('description').value = cls.description || '';
  document.getElementById('location').value = cls.location || '';
  document.getElementById('location_url').value = cls.location_url || '';
  document.getElementById('max_participants').value = cls.max_participants ?? '';
  document.getElementById('price_dkk').value = cls.price_dkk ?? '';
  document.getElementById('starts_at').value = '';
  document.getElementById('ends_at').value = '';
  document.getElementById('release_at').value = '';
  document.getElementById('announce_before_release').checked = false;

  document.getElementById('createClassCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('starts_at').focus();
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
        <thead><tr><th>${t('col_owner')}</th><th>${t('col_dog')}</th><th>${t('col_email')}</th><th>${t('col_phone')}</th><th>${t('col_payment')}</th><th>${t('col_status')}</th><th></th><th></th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${r.owner_name}</td>
              <td>${r.dog_name || '—'}</td>
              <td>${r.email}</td>
              <td>${r.phone}</td>
              <td>${r.payment_method === 'pay_at_class' ? t('payment_at_class') : r.payment_method === 'manual' ? t('payment_manual') : t('payment_mobilepay')}</td>
              <td><span class="tag tag-${r.status}">${r.status}</span></td>
              <td><button class="btn-delete" data-move-reg="${r.id}" title="${t('move_btn')}">⇄</button></td>
              <td><button class="btn-delete" data-delete-reg="${r.id}" title="${t('delete_registration_btn')}">✕</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    box.querySelectorAll('[data-delete-reg]').forEach((btn) => {
      btn.addEventListener('click', () => deleteRegistration(btn.dataset.deleteReg, id));
    });
    box.querySelectorAll('[data-move-reg]').forEach((btn) => {
      const reg = rows.find((r) => r.id === btn.dataset.moveReg);
      btn.addEventListener('click', () => openMoveModal(reg, id));
    });
  } catch (err) {
    box.innerHTML = `<p style="color:var(--clay); font-size:13px">${err.message}</p>`;
  }
}

async function deleteRegistration(regId, classId) {
  if (!window.confirm(t('confirm_delete_registration'))) return;

  try {
    const res = await fetch(`${API}/admin/registrations/${regId}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('err_generic'));

    await loadClasses(); // refresh confirmed counts shown on the class row
    await loadRoster(classId); // loadClasses rebuilt the list, so re-open the roster view
  } catch (err) {
    window.alert(err.message);
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
