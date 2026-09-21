(() => {
'use strict';

// Invite / password-reset links from Netlify Identity land on the site root with a token in the hash.
// Send them to the admin dashboard, which knows how to handle them.
if (/(invite|recovery|confirmation)_token=/.test(location.hash)) { location.replace('/admin/' + location.hash); return; }

const cfg = { whatsapp: '233577788857', arrivalDays: 55, businessName: 'Lawbenpina Ventures' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (p) => 'GH₵ ' + (p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const waHref = (text) => `https://wa.me/${cfg.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---------- cart (ids and quantities only; prices always come from products.json) ----------
const CART_KEY = 'lv_cart_v1';
const cart = {
  get() {
    try {
      const a = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(a) ? a.filter((l) => l && typeof l.id === 'string' && l.qty > 0).map((l) => ({ id: l.id, qty: Math.min(99, Math.floor(l.qty)) })) : [];
    } catch (e) { return []; }
  },
  set(a) { try { localStorage.setItem(CART_KEY, JSON.stringify(a)); } catch (e) {} updateCartCount(); },
  add(id, qty) {
    const a = cart.get(); const l = a.find((x) => x.id === id);
    if (l) l.qty = Math.min(99, l.qty + qty); else a.push({ id, qty: Math.min(99, qty) });
    cart.set(a);
  },
  setQty(id, qty) { cart.set(cart.get().map((l) => (l.id === id ? { id, qty } : l))); },
  remove(id) { cart.set(cart.get().filter((l) => l.id !== id)); },
  clear() { cart.set([]); },
  count() { return cart.get().reduce((t, l) => t + l.qty, 0); },
};
function updateCartCount() { document.querySelectorAll('.js-cart-count').forEach((el) => (el.textContent = cart.count())); }

// ---------- products ----------
async function loadProducts() {
  try {
    const r = await fetch('products.json', { cache: 'no-cache' });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.products || [])
      .filter((p) => p && p.name && Number(p.price) > 0 && p.image)
      .map((p) => ({
        id: slug(p.name), name: String(p.name), price: Math.round(Number(p.price) * 100),
        category: p.category ? String(p.category) : '', description: p.description ? String(p.description) : '',
        image: String(p.image), inStock: p.status !== 'sold_out',
      }));
  } catch (e) { return []; }
}

// ---------- page basics ----------
const btn = document.getElementById('menuBtn'), nav = document.getElementById('mainNav');
if (btn && nav) {
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}
document.querySelectorAll('.js-year').forEach((el) => (el.textContent = new Date().getFullYear()));
updateCartCount();

async function init() {
  try { const r = await fetch('settings.json', { cache: 'no-cache' }); if (r.ok) Object.assign(cfg, await r.json()); } catch (e) {}
  document.querySelectorAll('[data-wa]').forEach((a) => (a.href = waHref(a.dataset.wa)));
  document.querySelectorAll('.js-days').forEach((el) => (el.textContent = cfg.arrivalDays));
  document.querySelectorAll('.js-phone').forEach((a) => { a.href = 'tel:+' + cfg.whatsapp; });
}
const ready = init();
window.LV = { cfg, ready, esc, money, waHref, slug, cart, loadProducts, updateCartCount };

// ---------- featured products on the home page ----------
const featured = document.getElementById('featured');
if (featured) {
  loadProducts().then((list) => {
    const items = list.filter((p) => p.inStock).slice(0, 4);
    if (!items.length) return;
    document.getElementById('featuredGrid').innerHTML = items.map((p) => `
      <a class="pcard" href="shop.html#${esc(p.id)}">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
        <div class="pinfo"><h3>${esc(p.name)}</h3><div class="pprice">${money(p.price)}</div></div>
      </a>`).join('');
    featured.hidden = false;
  });
}

// ---------- contact form (Netlify Forms) ----------
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
