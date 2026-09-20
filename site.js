(() => {
'use strict';
const cfg = { whatsapp: '233577788857', arrivalDays: 55 };

// mobile menu
const btn = document.getElementById('menuBtn'), nav = document.getElementById('mainNav');
if (btn && nav) {
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

document.querySelectorAll('.js-year').forEach((el) => (el.textContent = new Date().getFullYear()));

function waHref(text) { return `https://wa.me/${cfg.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`; }

async function init() {
  try { const r = await fetch('settings.json', { cache: 'no-cache' }); if (r.ok) Object.assign(cfg, await r.json()); } catch (e) {}
  document.querySelectorAll('[data-wa]').forEach((a) => (a.href = waHref(a.dataset.wa)));
  document.querySelectorAll('.js-days').forEach((el) => (el.textContent = cfg.arrivalDays));
  document.querySelectorAll('.js-phone').forEach((a) => { a.href = 'tel:+' + cfg.whatsapp; });
}
init();

// contact form (Netlify Forms)
const cf = document.getElementById('contactForm');
if (cf) {
  cf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('m_phone');
    phone.setCustomValidity('');
    if (!/^(\+?233|0)\d{9}$/.test(phone.value.replace(/[\s\-()]/g, ''))) phone.setCustomValidity('Enter a valid Ghana phone number, e.g. 024 000 0000');
    if (!cf.checkValidity()) { cf.reportValidity(); return; }
    const b = document.getElementById('contactBtn');
    const err = document.getElementById('contactErr');
    err.hidden = true; b.disabled = true; b.textContent = 'Sending…';
    const data = { 'form-name': 'contact', 'bot-field': '', name: cf.m_name.value.trim(), phone: phone.value.trim(), message: cf.m_message.value.trim() };
    try {
      const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      cf.hidden = true;
      document.getElementById('contactOk').hidden = false;
    } catch (x) {
      err.hidden = false;
      err.innerHTML = `We couldn't send your message. Please <a class="link" href="${waHref('Hello, ' + data.message)}" target="_blank" rel="noopener">message us on WhatsApp</a> instead, or try again.`;
      b.disabled = false; b.textContent = 'Send message';
    }
  });
}
})();
