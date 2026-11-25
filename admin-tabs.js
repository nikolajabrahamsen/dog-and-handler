// Tabs in the admin: Hold / Nyhedsbrev / Tekster.
(function () {
  const NAMES = {
    classes: { da: 'Hold', en: 'Classes' },
    newsletter: { da: 'Nyhedsbrev', en: 'Newsletter' },
    texts: { da: 'Tekster', en: 'Texts' },
  };
  const lang = () => (typeof getLang === 'function' && getLang() === 'en') ? 'en' : 'da';

  function show(name) {
    if (!NAMES[name]) name = 'classes';
    document.querySelectorAll('[data-tab-panel]').forEach((p) => { p.hidden = p.getAttribute('data-tab-panel') !== name; });
    document.querySelectorAll('.admin-tab').forEach((b) => {
      const on = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    try { localStorage.setItem('adminTab', name); } catch (e) { /* storage unavailable */ }
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  function labels() {
    document.querySelectorAll('.admin-tab').forEach((b) => { b.textContent = NAMES[b.getAttribute('data-tab')][lang()]; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.admin-tab').forEach((b) => b.addEventListener('click', () => show(b.getAttribute('data-tab'))));
    let start = location.hash.replace('#', '');
    if (!NAMES[start]) { try { start = localStorage.getItem('adminTab'); } catch (e) { start = null; } }
    labels();
    show(start);
    window.addEventListener('langchange', labels);
  });
})();
