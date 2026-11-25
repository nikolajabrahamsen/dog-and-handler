// Admin card "Tekster": edit the Danish and English texts of the site.
// Runs after admin.js and reuses its login (accessToken / authHeaders()).
(function () {
  const L = (da, en) => ({ da, en });
  const UI = {
    heading: L('Tekster', 'Texts'),
    intro: L('Ret teksterne på hjemmesiden – både dansk og engelsk. Ændringer vises med det samme efter du har trykket Gem. Tryk "Gendan standard" for at gå tilbage til den oprindelige tekst.', 'Edit the texts on the website, in Danish and English. Changes show up straight after you press Save. Press "Restore default" to go back to the original text.'),
    save: L('Gem tekster', 'Save texts'),
    saving: L('Gemmer…', 'Saving…'),
    saved: L('Gemt. Teksterne er opdateret på hjemmesiden.', 'Saved. The texts are updated on the website.'),
    nothing: L('Ingen ændringer at gemme.', 'No changes to save.'),
    failed: L('Det lykkedes ikke at gemme', 'Could not save'),
    restore: L('Gendan standard', 'Restore default'),
    da: L('Dansk', 'Danish'),
    en: L('Engelsk', 'English'),
    loading: L('Indlæser tekster…', 'Loading texts…'),
    loadFailed: L('Kunne ikke indlæse teksterne.', 'Could not load the texts.'),
    termsWarn: L('Handelsbetingelserne er juridiske. Når du gemmer en ændring her, opdateres datoen "Sidst opdateret" på siden automatisk. Skriv et tomt felt for at gendanne standardteksten. Tomme linjer laver nyt afsnit.', 'The terms are legal text. When you save a change here, the "Last updated" date on the page is updated automatically. Clear a field to restore the default text. Blank lines make a new paragraph.'),
    emailNote: L('Mailene sendes kun på dansk. Teksten sættes ind nederst i bekræftelsesmailen, lige over kvitteringsoplysningerne.', 'Emails are only sent in Danish. The text is placed at the bottom of the confirmation email, just above the receipt details.'),
    sellerNote: L('Punkt 1 (Sælger) kan ikke rettes her, fordi det kommer fra firmaoplysningerne.', 'Section 1 (Seller) cannot be edited here because it comes from the company details.'),
  };
  const lang = () => (typeof getLang === 'function' && getLang() === 'en') ? 'en' : 'da';
  const u = (k) => UI[k][lang()];

  const GROUPS = [
    { id: 'front', title: L('Forside', 'Front page'), fields: [
      { key: 'tagline', label: L('Lille overskrift over teksten', 'Small heading above the text') },
      { key: 'hero_intro', label: L('Tekst øverst på forsiden', 'Intro text at the top'), multi: true },
      { key: 'classes_heading', label: L('Overskrift over holdene', 'Heading above the classes') },
    ] },
    { id: 'newsletter', title: L('Nyhedsbrevsboksen på forsiden', 'Newsletter box on the front page'), fields: [
      { key: 'nl_signup_heading', label: L('Overskrift', 'Heading') },
      { key: 'nl_signup_text', label: L('Tekst', 'Text'), multi: true },
      { key: 'nl_signup_note', label: L('Lille tekst under knappen', 'Small text under the button') },
    ] },
    { id: 'facebook', title: L('Besked til Facebook-brugere', 'Notice for Facebook visitors'), fields: [
      { key: 'inapp_title', label: L('Overskrift', 'Heading') },
      { key: 'inapp_text', label: L('Forklaring', 'Explanation'), multi: true },
      { key: 'inapp_ios', label: L('Vejledning til iPhone', 'Instructions for iPhone'), multi: true },
      { key: 'inapp_android', label: L('Vejledning til Android', 'Instructions for Android'), multi: true },
    ] },
    { id: 'terms', title: L('Handelsbetingelser', 'Terms and conditions'), warn: 'termsWarn', note: 'sellerNote', fields: [] },
    { id: 'email', title: L('Bekræftelsesmail', 'Confirmation email'), note: 'emailNote', daOnly: true, fields: [
      { key: 'email_extra', label: L('Ekstra besked (valgfri), fx "Husk godbidder og drikkevand"', 'Extra message (optional), e.g. "Remember treats and water"'), multi: true, def: { da: '' } },
      { key: 'email_closing', label: L('Afslutning', 'Closing line'), multi: true, def: { da: 'Vi glæder os til at se jer!' } },
    ] },
  ];

  let overrides = { da: {}, en: {} };
  let defaults = { da: {}, en: {} };   // key -> default text
  let initial = { da: {}, en: {} };    // key -> text shown when loaded (effective)
  let termsTitles = { da: {}, en: {} };

  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
  }

  // The default terms text is read from the terms page itself, so it never gets out of step.
  async function loadTermsDefaults() {
    if (!window.COMPANY) await loadScript('/company-config.js');
    const html = await (await fetch('/vilkaar.html', { cache: 'no-store' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const c = window.COMPANY || {};
    doc.querySelectorAll('[data-company]').forEach((el) => { el.textContent = c[el.getAttribute('data-company')] || ''; });
    ['da', 'en'].forEach((lg) => {
      const block = doc.querySelector(`.terms-lang[data-lang="${lg}"]`);
      if (!block) return;
      block.querySelectorAll('h2').forEach((h2) => {
        const n = parseInt(h2.textContent, 10);
        if (!(n >= 2 && n <= 9)) return;
        const paras = [];
        let el = h2.nextElementSibling;
        while (el && el.tagName !== 'H2') { if (el.tagName === 'P') paras.push(el.textContent.replace(/\s+/g, ' ').trim()); el = el.nextElementSibling; }
        defaults[lg]['terms_' + n] = paras.join('\n\n');
        termsTitles[lg][n] = h2.textContent.trim();
      });
    });
  }

  function loadUiDefaults() {
    GROUPS.forEach((g) => g.fields.forEach((f) => {
      ['da', 'en'].forEach((lg) => {
        if (f.def) { defaults[lg][f.key] = f.def[lg] || ''; return; }
        const base = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[lg]) ? TRANSLATIONS[lg][f.key] : '';
        defaults[lg][f.key] = base || '';
      });
    }));
  }

  function termsFields() {
    const out = [];
    for (let n = 2; n <= 9; n++) {
      out.push({ key: 'terms_' + n, multi: true, tall: true, label: { da: (termsTitles.da[n] || n + '.'), en: (termsTitles.en[n] || n + '.') } });
    }
    return out;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
  const effective = (lg, key) => (overrides[lg][key] != null && overrides[lg][key].trim() ? overrides[lg][key] : (defaults[lg][key] || ''));

  function render() {
    const host = document.getElementById('textsBody');
    if (!host) return;
    const open = new Set([...host.querySelectorAll('details[open]')].map((d) => d.dataset.group));
    document.getElementById('textsHeading').textContent = u('heading');
    document.getElementById('textsIntro').textContent = u('intro');
    const saveBtn = document.getElementById('textsSaveBtn');
    if (saveBtn && !saveBtn.disabled) saveBtn.textContent = u('save');
    // keep what the user typed if we re-render (language switch)
    const typed = {};
    host.querySelectorAll('textarea[data-key]').forEach((ta) => { typed[ta.dataset.lang + '|' + ta.dataset.key] = ta.value; });

    host.innerHTML = GROUPS.map((g) => {
      const fields = g.id === 'terms' ? termsFields() : g.fields;
      const langs = g.daOnly ? ['da'] : ['da', 'en'];
      return `<details class="txt-group" data-group="${g.id}"${open.has(g.id) ? ' open' : ''}>
        <summary>${esc(g.title[lang()])}</summary>
        ${g.warn ? `<p class="txt-warn">${esc(u(g.warn))}</p>` : ''}
        ${g.note ? `<p class="txt-note">${esc(u(g.note))}</p>` : ''}
        ${fields.map((f) => `
          <div class="txt-field">
            <div class="txt-label">${esc(f.label[lang()])}</div>
            <div class="txt-cols${langs.length === 1 ? ' one' : ''}">
              ${langs.map((lg) => {
                const id = typed[lg + '|' + f.key];
                const val = id != null ? id : effective(lg, f.key);
                const rows = f.tall ? Math.min(14, Math.max(4, Math.ceil(val.length / 55) + 1)) : (f.multi ? 3 : 1);
                return `<div class="txt-col">
                  <label class="txt-lang">${esc(UI[lg][lang()])}</label>
                  <textarea data-key="${f.key}" data-lang="${lg}" rows="${rows}">${esc(val)}</textarea>
                  <button type="button" class="txt-restore" data-key="${f.key}" data-lang="${lg}">${esc(u('restore'))}</button>
                </div>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </details>`;
    }).join('');

    host.querySelectorAll('.txt-restore').forEach((b) => b.addEventListener('click', () => {
      const ta = host.querySelector(`textarea[data-key="${b.dataset.key}"][data-lang="${b.dataset.lang}"]`);
      ta.value = defaults[b.dataset.lang][b.dataset.key] || '';
    }));
  }

  function snapshotInitial() {
    initial = { da: {}, en: {} };
    document.querySelectorAll('#textsBody textarea[data-key]').forEach((ta) => { initial[ta.dataset.lang][ta.dataset.key] = ta.value; });
  }

  async function waitForLogin() {
    for (let i = 0; i < 100; i++) { if (typeof accessToken !== 'undefined' && accessToken) return true; await new Promise((r) => setTimeout(r, 100)); }
    return false;
  }

  async function loadOverrides() {
    const res = await fetch('/api/texts', { headers: authHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    overrides = { da: data.texts.da || {}, en: data.texts.en || {} };
  }

  async function save() {
    const msg = document.getElementById('textsMsg');
    const btn = document.getElementById('textsSaveBtn');
    const items = [];
    document.querySelectorAll('#textsBody textarea[data-key]').forEach((ta) => {
      const lg = ta.dataset.lang, key = ta.dataset.key, val = ta.value;
      if (val === initial[lg][key]) return; // unchanged
      const isDefault = val.trim() === '' || val.trim() === (defaults[lg][key] || '').trim();
      items.push({ key, lang: lg, value: isDefault ? '' : val });
    });
    if (!items.length) { msg.textContent = u('nothing'); msg.hidden = false; return; }
    btn.disabled = true; btn.textContent = u('saving'); msg.hidden = true;
    try {
      const res = await fetch('/api/texts', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ items }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.status);
      await loadOverrides();
      render();
      snapshotInitial();
      msg.textContent = u('saved');
    } catch (e) {
      msg.textContent = `${u('failed')}: ${e.message}`;
    }
    msg.hidden = false;
    btn.disabled = false; btn.textContent = u('save');
  }

  async function init() {
    const host = document.getElementById('textsBody');
    if (!host) return;
    host.textContent = u('loading');
    try {
      if (!(await waitForLogin())) return;
      loadUiDefaults();
      await Promise.all([loadTermsDefaults(), loadOverrides()]);
      render();
      snapshotInitial();
    } catch (e) {
      console.error(e);
      host.textContent = u('loadFailed');
      return;
    }
    document.getElementById('textsSaveBtn').addEventListener('click', save);
    window.addEventListener('langchange', () => { render(); /* typed values are kept */ });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
