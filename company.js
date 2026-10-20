// Renders the company block into #siteFooter and fills [data-company] spans.
(function () {
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function render() {
    const c = window.COMPANY || {};
    document.querySelectorAll('[data-company]').forEach((el) => {
      el.textContent = c[el.getAttribute('data-company')] || '';
    });
    const host = document.getElementById('siteFooter');
    if (!host) return;
    const tel = String(c.phone || '').replace(/[^+\d]/g, '');
    host.innerHTML = `
      <div class="footer-inner">
        <strong>${esc(c.brand)}</strong>
        <div>${esc(c.legalName)} · ${t('footer_cvr')} ${esc(c.cvr)}</div>
        <div>${esc(c.address)}</div>
        <div>${t('footer_email')}: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> · ${t('footer_phone')}: <a href="tel:${esc(tel)}">${esc(c.phone)}</a></div>
        <div class="footer-links"><a href="/vilkaar.html">${t('footer_terms')}</a></div>
      </div>`;
  }
  document.addEventListener('DOMContentLoaded', render);
  window.addEventListener('langchange', render);
})();
