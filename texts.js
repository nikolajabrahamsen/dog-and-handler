// Applies the texts the admin has edited (stored in the database) on top of
// the built-in texts in i18n.js. Loaded after i18n.js on the public pages.
// Falls back silently to the built-in texts if anything goes wrong.
(function () {
  var CACHE_KEY = 'siteTexts.v1';
  var current = null;

  function applyUiTexts(data) {
    if (!data || !data.texts || typeof TRANSLATIONS === 'undefined') return;
    ['da', 'en'].forEach(function (lang) {
      var set = data.texts[lang] || {};
      Object.keys(set).forEach(function (key) {
        if (key.indexOf('terms_') === 0 || key.indexOf('email_') === 0) return;
        if (TRANSLATIONS[lang] && typeof set[key] === 'string' && set[key].trim()) TRANSLATIONS[lang][key] = set[key];
      });
    });
  }

  // Turns e-mail addresses and web addresses in plain text into safe links.
  var LINK_RE = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+|https?:\/\/[^\s)]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:dk|com|org|eu|net)\b(?:\/[^\s)]*)?)/gi;
  function paragraphNode(text) {
    var p = document.createElement('p');
    var last = 0, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text)) !== null) {
      var raw = m[0].replace(/[.,;:]+$/, '');
      if (m.index > last) p.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement('a');
      a.textContent = raw;
      a.href = raw.indexOf('@') > -1 ? 'mailto:' + raw : (/^https?:/i.test(raw) ? raw : 'https://' + raw);
      if (raw.indexOf('@') === -1) { a.target = '_blank'; a.rel = 'noopener'; }
      p.appendChild(a);
      last = m.index + raw.length;
      LINK_RE.lastIndex = last;
    }
    if (last < text.length) p.appendChild(document.createTextNode(text.slice(last)));
    return p;
  }

  function monthYear(iso, lang) {
    try {
      return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'da-DK', { month: 'long', year: 'numeric', timeZone: 'Europe/Copenhagen' });
    } catch (e) { return ''; }
  }

  // Terms page: replace the text of sections 2-9 and the "last updated" date.
  function applyTerms(data) {
    var blocks = document.querySelectorAll('.terms-lang');
    if (!blocks.length || !data || !data.texts) return;
    blocks.forEach(function (block) {
      var lang = block.getAttribute('data-lang');
      var set = data.texts[lang] || {};
      block.querySelectorAll('h2').forEach(function (h2) {
        var n = parseInt(h2.textContent, 10);
        var text = set['terms_' + n];
        if (!(n >= 2 && n <= 9) || typeof text !== 'string' || !text.trim()) return;
        // remove the old paragraphs of this section
        var el = h2.nextElementSibling;
        while (el && el.tagName !== 'H2') { var next = el.nextElementSibling; el.remove(); el = next; }
        // insert the new ones
        var anchor = h2;
        text.split(/\n\s*\n/).forEach(function (para) {
          if (!para.trim()) return;
          var node = paragraphNode(para.trim());
          anchor.after(node);
          anchor = node;
        });
      });
      if (data.termsUpdated) {
        var date = monthYear(data.termsUpdated, lang);
        var re = lang === 'en' ? /(Last updated: )[^.]*\./ : /(Sidst opdateret: )[^.]*\./;
        var intro = block.querySelector('h1 + p');
        if (intro && date) {
          intro.childNodes.forEach(function (n) {
            if (n.nodeType === 3 && re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, '$1' + date + '.');
          });
        }
      }
    });
  }

  function applyAll(data) {
    current = data;
    applyUiTexts(data);
    applyTerms(data);
    if (typeof applyStaticTranslations === 'function' && document.readyState !== 'loading') applyStaticTranslations();
  }

  // 1) Instantly use the texts from the last visit (no flash of old text).
  var cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { /* ignore */ }
  if (cached) applyUiTexts(cached);
  document.addEventListener('DOMContentLoaded', function () { if (cached) applyTerms(cached); });

  // 2) Fetch the current texts and apply them.
  fetch('/api/texts', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
      var go = function () { applyAll(data); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    })
    .catch(function () { /* keep the built-in texts */ });
})();
