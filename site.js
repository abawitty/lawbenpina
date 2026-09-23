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
    const r = await fetch('/products.json', { cache: 'no-cache' });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.products || [])
      .filter((p) => p && p.name && Number(p.price) > 0 && p.image)
      .map((p) => ({
        id: slug(p.name), name: String(p.name), price: Math.round(Number(p.price) * 100),
        category: p.category ? String(p.category) : '', description: p.description ? String(p.description) : '',
        image: String(p.image), inStock: p.status !== 'sold_out',
        // The main Photo (edited in the dashboard) always leads the gallery, even if the extra photos list is now stale.
        gallery: [String(p.image), ...(Array.isArray(p.gallery) ? p.gallery.filter((g) => typeof g === 'string' && g !== p.image) : [])],
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
  try { const r = await fetch('/settings.json', { cache: 'no-cache' }); if (r.ok) Object.assign(cfg, await r.json()); } catch (e) {}
  document.querySelectorAll('[data-wa]').forEach((a) => (a.href = waHref(a.dataset.wa)));
  document.querySelectorAll('.js-days').forEach((el) => (el.textContent = cfg.arrivalDays));
  document.querySelectorAll('.js-phone').forEach((a) => { a.href = 'tel:+' + cfg.whatsapp; });
  const digits = String(cfg.whatsapp).replace(/\D/g, '');
  const pretty = /^233\d{9}$/.test(digits) ? `+233 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}` : '+' + digits;
  document.querySelectorAll('.js-phone-text').forEach((el) => (el.textContent = pretty));
}
const ready = init();

// ---------- images: on the live site, big uploads are resized by Netlify's Image CDN; falls back to the original ----------
const onLive = location.protocol === 'https:' && !/^(localhost|127\.|\[::1\])/.test(location.hostname);
const imgUrl = (src, w) => (onLive && String(src).startsWith('/') ? `/.netlify/images?url=${encodeURIComponent(src)}&w=${w}` : src);
const imgAttrs = (src, w) => `src="${esc(imgUrl(src, w))}" onerror="this.onerror=null;this.src='${esc(src)}'"`;
const setImg = (el, src, w) => { el.onerror = () => { el.onerror = null; el.src = src; }; el.src = imgUrl(src, w); };

// ---------- editable page text: content/<page>.json (edited in the /admin dashboard) ----------
const fmt = (s) => esc(s == null ? '' : s)
  .replace(/\{days\}/g, esc(cfg.arrivalDays))
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|[a-z0-9-]+\.html(?:#[\w-]*)?)\)/g, '<a class="link" href="$2">$1</a>')
  .replace(/\n/g, '<br>');
const TPL = {
  feature: (i) => `<div class="feat"><h3>${fmt(i.title)}</h3><p>${fmt(i.text)}</p></div>`,
  step: (i) => `<li><h3>${fmt(i.title)}</h3><p>${fmt(i.text)}</p></li>`,
  faq: (i) => `<details><summary>${fmt(i.q)}</summary><p>${fmt(i.a)}</p></details>`,
  para: (i) => `<p>${fmt(typeof i === 'string' ? i : i && i.text)}</p>`,
  guidecard: (i) => `<a class="feat guide-card" href="guides/${esc(i.slug)}.html"><span class="eyebrow">${esc(dateLabel(i.date))}</span><h3>${fmt(i.title)}</h3><p>${fmt(i.excerpt)}</p></a>`,
};
function dateLabel(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function applyCms(d) {
  document.querySelectorAll('[data-cms]').forEach((el) => { const v = d[el.dataset.cms]; if (typeof v === 'string' && v.trim()) el.innerHTML = fmt(v); });
  document.querySelectorAll('[data-cms-href]').forEach((el) => { const v = d[el.dataset.cmsHref]; if (typeof v === 'string' && /^https?:\/\//.test(v.trim())) el.href = v.trim(); });
  document.querySelectorAll('[data-cms-list]').forEach((el) => {
    const list = d[el.dataset.cmsList]; const tpl = TPL[el.dataset.tpl];
    if (Array.isArray(list) && list.length && tpl) el.innerHTML = list.filter(Boolean).map(tpl).join('');
  });
}
const pageName = document.body.dataset.page;
if (pageName) {
  ready.then(async () => {
    try { const r = await fetch(`/content/${pageName}.json`, { cache: 'no-cache' }); if (r.ok) applyCms(await r.json()); } catch (e) {}
  });
}

window.LV = { cfg, ready, esc, money, waHref, slug, cart, loadProducts, updateCartCount, imgAttrs, setImg };

// ---------- featured products on the home page ----------
const featured = document.getElementById('featured');
if (featured) {
  loadProducts().then((list) => {
    const items = list.filter((p) => p.inStock).slice(0, 4);
    if (!items.length) return;
    document.getElementById('featuredGrid').innerHTML = items.map((p) => `
      <a class="pcard" href="shop.html#${esc(p.id)}">
        <img ${imgAttrs(p.image, 600)} alt="${esc(p.name)}" loading="lazy">
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
