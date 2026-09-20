(() => {
'use strict';

const DEFAULTS = { businessName: 'Lawbenpina Ventures', whatsapp: '233577788857', arrivalDays: 55 };
const DRAFT_KEY = 'lv_order_draft_v2';
const S = { cfg: { ...DEFAULTS }, items: [], editing: null, order: null };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function isAlibaba(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const h = url.hostname.toLowerCase();
    return h === 'alibaba.com' || h.endsWith('.alibaba.com');
  } catch (e) { return false; }
}

// A readable label taken from the product URL, e.g. ".../Wireless-Earbuds_160012.html" -> "Wireless Earbuds"
function label(link) {
  try {
    let seg = decodeURIComponent(new URL(link).pathname.split('/').filter(Boolean).pop() || '');
    seg = seg.replace(/\.html?$/i, '').replace(/_\d+$/, '').replace(/[-_]+/g, ' ').trim();
    if (seg.length > 2 && !/^\d+$/.test(seg)) return seg.length > 90 ? seg.slice(0, 90) + '…' : seg;
  } catch (e) {}
  return 'Alibaba item';
}

// ---------- draft persistence ----------
const CUST_IDS = ['c_name', 'c_phone', 'c_whatsapp', 'c_email', 'c_address', 'c_city', 'c_region', 'c_digital', 'c_landmark', 'c_notes'];
function readCust() { const o = {}; CUST_IDS.forEach((id) => (o[id] = $(id).value.trim())); return o; }
function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ items: S.items, cust: readCust() })); } catch (e) {} }
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d) return;
    if (Array.isArray(d.items)) S.items = d.items.filter((it) => it && it.qty > 0 && isAlibaba(it.link)).map((it) => ({ link: it.link, qty: it.qty }));
    Object.entries(d.cust || {}).forEach(([k, v]) => { const el = $(k); if (el && typeof v === 'string') el.value = v; });
  } catch (e) {}
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

// ---------- steps ----------
function show(n) {
  ['p1', 'p2', 'p3', 'p4'].forEach((id, i) => ($(id).hidden = i + 1 !== n));
  const lis = $('stepper').children;
  for (let i = 0; i < lis.length; i++) lis[i].className = n === 4 || i + 1 < n ? 'done' : i + 1 === n ? 'on' : '';
  $('order').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- items ----------
function itemCard(it, i, withActions) {
  return `<article class="item">
    <div>
      <h3>${esc(label(it.link))}</h3>
      <div class="meta">Quantity: ${it.qty}</div>
      <div class="meta"><a href="${esc(it.link)}" target="_blank" rel="noopener" class="link">View on Alibaba</a></div>
    </div>
    <div class="price muted">Quote to follow</div>
    ${withActions ? `<div class="acts"><button class="btn btn-sm" type="button" data-act="edit" data-i="${i}">Edit</button><button class="btn btn-sm" type="button" data-act="remove" data-i="${i}">Remove</button></div>` : ''}
  </article>`;
}

function renderItems() {
  $('itemList').innerHTML = S.items.length
    ? S.items.map((it, i) => itemCard(it, i, true)).join('')
    : '<p class="empty">No items yet. Add your first item below.</p>';
}

function resetItemForm() {
  $('itemForm').reset();
  $('i_qty').value = 1;
  S.editing = null;
  $('formTitle').textContent = 'Add an item';
  $('itemBtn').textContent = 'Add item';
  $('itemCancel').hidden = true;
  ['i_link', 'i_qty'].forEach((id) => $(id).setCustomValidity(''));
}

$('itemList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const i = +b.dataset.i;
  if (b.dataset.act === 'remove') {
    S.items.splice(i, 1);
    if (S.editing !== null) resetItemForm();
    renderItems(); saveDraft();
  } else {
    const it = S.items[i];
    $('i_link').value = it.link; $('i_qty').value = it.qty;
    S.editing = i;
    $('formTitle').textContent = 'Edit item';
    $('itemBtn').textContent = 'Save changes';
    $('itemCancel').hidden = false;
    $('itemForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
$('itemCancel').addEventListener('click', resetItemForm);

$('itemForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const link = $('i_link'), qty = $('i_qty');
  [link, qty].forEach((el) => el.setCustomValidity(''));
  if (!isAlibaba(link.value.trim())) link.setCustomValidity('Please paste a link from alibaba.com');
  if (!(Number.isInteger(+qty.value) && +qty.value >= 1 && +qty.value <= 100000)) qty.setCustomValidity('Quantity must be a whole number of 1 or more');
  if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
  const item = { link: link.value.trim(), qty: +qty.value };
  if (S.editing !== null) S.items[S.editing] = item; else S.items.push(item);
  resetItemForm(); renderItems(); saveDraft();
});

// ---------- navigation ----------
$('to2').addEventListener('click', () => {
  if (!S.items.length) { alert('Please add at least one item first.'); return; }
  show(2);
});
$('back1').addEventListener('click', () => show(1));
$('back2').addEventListener('click', () => show(2));

$('to3').addEventListener('click', () => {
  const f = $('custForm');
  const phone = $('c_phone'), wa = $('c_whatsapp'), dig = $('c_digital');
  [phone, wa, dig].forEach((el) => el.setCustomValidity(''));
  const okPhone = (v) => /^(\+?233|0)\d{9}$/.test(v.replace(/[\s\-()]/g, ''));
  if (!okPhone(phone.value)) phone.setCustomValidity('Enter a valid Ghana phone number, e.g. 024 000 0000');
  if (wa.value.trim() && !okPhone(wa.value)) wa.setCustomValidity('Enter a valid Ghana phone number');
  if (dig.value.trim() && !/^[A-Za-z]{2}-?\d{3,4}-?\d{4}$/.test(dig.value.trim())) dig.setCustomValidity('Format looks like GA-123-4567');
  if (!f.checkValidity()) { f.reportValidity(); return; }
  saveDraft();
  renderReview();
  ['k1', 'k2', 'k3'].forEach((id) => ($(id).checked = false));
  $('placeBtn').disabled = true;
  $('placeError').hidden = true;
  show(3);
});

CUST_IDS.forEach((id) => $(id).addEventListener('input', saveDraft));
['k1', 'k2', 'k3'].forEach((id) => $(id).addEventListener('change', () => {
  $('placeBtn').disabled = !['k1', 'k2', 'k3'].every((k) => $(k).checked);
}));

// ---------- review / submit ----------
function custBlock(c) {
  const rows = [
    ['Name', c.c_name], ['Phone', c.c_phone], ['WhatsApp', c.c_whatsapp], ['Email', c.c_email],
    ['Address', [c.c_address, c.c_city, c.c_region].filter(Boolean).join(', ')],
    ['Digital address', c.c_digital], ['Landmark', c.c_landmark], ['Notes', c.c_notes],
  ].filter((r) => r[1]);
  return `<dl>${rows.map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl>`;
}
function estBlock(est) {
  return `<div class="totals">
    <div class="ship"><span>Price</span><span>We will send you a quote in Ghana cedis</span></div>
    <div class="ship"><span>Shipping</span><span>To be calculated and sent to you</span></div>
    <div class="ship"><span>Estimated arrival</span><span>About ${S.cfg.arrivalDays} days after your order is confirmed (around ${esc(fmtDate(est))} if confirmed today)</span></div></div>`;
}
const estFromNow = () => new Date(Date.now() + S.cfg.arrivalDays * 86400000);

function renderReview() {
  $('reviewBox').innerHTML = `<h2>Review your request</h2><h3>Items</h3>${S.items.map((it) => itemCard(it, 0, false)).join('')}${estBlock(estFromNow())}<h3>Your details</h3>${custBlock(readCust())}`;
}

function makeRef(d) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  crypto.getRandomValues(new Uint8Array(4)).forEach((b) => (r += chars[b % chars.length]));
  const p = (n) => String(n).padStart(2, '0');
  return `LV-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${r}`;
}

const waLink = (text) => `https://wa.me/${S.cfg.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`;

function orderText(o) {
  const lines = o.items.map((it, i) => `${i + 1}. ${label(it.link)}\n   Quantity: ${it.qty}\n   ${it.link}`);
  const c = o.cust;
  return `Hello ${S.cfg.businessName}, I would like a quote for this import order.\nRef: ${o.ref}\n\nITEMS\n${lines.join('\n')}\n\nShipping: to be calculated and sent to me\n\nName: ${c.c_name}\nPhone: ${c.c_phone}${c.c_whatsapp ? '\nWhatsApp: ' + c.c_whatsapp : ''}\nEmail: ${c.c_email}\nAddress: ${[c.c_address, c.c_city, c.c_region].filter(Boolean).join(', ')}${c.c_digital ? '\nDigital address: ' + c.c_digital : ''}${c.c_landmark ? '\nLandmark: ' + c.c_landmark : ''}${c.c_notes ? '\nNotes: ' + c.c_notes : ''}`;
}

async function placeOrder() {
  const btn = $('placeBtn');
  btn.disabled = true; btn.textContent = 'Sending…';
  $('placeError').hidden = true;
  const now = new Date();
  const o = { ref: makeRef(now), items: S.items.map((it) => ({ ...it })), cust: readCust(), est: estFromNow() };
  S.order = o;
  const c = o.cust;
  const data = {
    'form-name': 'order', 'bot-field': '',
    order_ref: o.ref, name: c.c_name, phone: c.c_phone, whatsapp: c.c_whatsapp, email: c.c_email,
    address: c.c_address, city: c.c_city, region: c.c_region, digital_address: c.c_digital, landmark: c.c_landmark, notes: c.c_notes,
    items_summary: orderText(o), items_json: JSON.stringify(o.items),
    est_arrival: o.est.toISOString().slice(0, 10), consent_time: now.toISOString(),
    consent_given: 'items+quantities; quote and shipping sent separately, nothing bought until quote accepted; terms & privacy',
  };
  try {
    const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    finish(true);
  } catch (err) {
    finish(false);
  }
}

function finish(sent) {
  const o = S.order, c = o.cust;
  $('placeBtn').textContent = 'Send my order request';
  if (!sent) {
    const el = $('placeError');
    el.hidden = false;
    el.innerHTML = `We couldn't send your request online. Please send it to us on WhatsApp instead: <a href="${esc(waLink(orderText(o)))}" target="_blank" rel="noopener" class="link">Send request on WhatsApp</a>, or press the button again to retry.`;
    $('placeBtn').disabled = false;
    return;
  }
  clearDraft();
  $('doneName').textContent = c.c_name.split(' ')[0];
  $('doneRef').textContent = o.ref;
  $('doneMsg').textContent = 'Your request has been sent to us. We will check the price on Alibaba and send you a quote in Ghana cedis. Nothing is bought until you accept it. Keep your reference number handy.';
  $('doneSummary').innerHTML = `<h3>Items</h3>${o.items.map((it) => itemCard(it, 0, false)).join('')}${estBlock(o.est)}<h3>Delivery details</h3>${custBlock(c)}`;
  $('doneWa').href = waLink(orderText(o));
  show(4);
}
$('placeBtn').addEventListener('click', placeOrder);
$('printBtn').addEventListener('click', () => window.print());

// ---------- startup ----------
async function init() {
  $('yr').textContent = new Date().getFullYear();
  try { const r = await fetch('settings.json', { cache: 'no-cache' }); if (r.ok) S.cfg = { ...DEFAULTS, ...(await r.json()) }; } catch (e) {}
  $('waTop').href = waLink('Hello, I would like to import something from Alibaba.');
  $('factDays').textContent = `About ${S.cfg.arrivalDays} days to arrive`;
  loadDraft();
  renderItems();
}
init();
})();
