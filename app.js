(() => {
'use strict';

const DEFAULTS = { businessName: 'Lawbenpina Ventures', whatsapp: '233577788857', email: '', markupPercent: 25, arrivalDays: 55, fallbackRate: null };
const DRAFT_KEY = 'lv_order_draft_v1';
const S = { cfg: { ...DEFAULTS }, rate: null, rateAt: null, items: [], editing: null, order: null };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (p) => 'GH₵ ' + (p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// ---------- pricing (integer pesewas to avoid float drift) ----------
const unitP = (it) => Math.round(it.usd * S.rate * (1 + S.cfg.markupPercent / 100) * 100);
const lineP = (it) => unitP(it) * it.qty;
const subtotalP = () => S.items.reduce((t, it) => t + lineP(it), 0);

function isAlibaba(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const h = url.hostname.toLowerCase();
    return h === 'alibaba.com' || h.endsWith('.alibaba.com');
  } catch (e) { return false; }
}

// ---------- draft persistence ----------
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ items: S.items, cust: readCust() })); } catch (e) {}
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d) return;
    if (Array.isArray(d.items)) S.items = d.items.filter((it) => it && it.usd > 0 && it.qty > 0 && isAlibaba(it.link));
    Object.entries(d.cust || {}).forEach(([k, v]) => { const el = $(k); if (el && typeof v === 'string') el.value = v; });
  } catch (e) {}
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

const CUST_IDS = ['c_name', 'c_phone', 'c_whatsapp', 'c_email', 'c_address', 'c_city', 'c_region', 'c_digital', 'c_landmark', 'c_notes'];
function readCust() { const o = {}; CUST_IDS.forEach((id) => (o[id] = $(id).value.trim())); return o; }

// ---------- steps ----------
function show(n) {
  ['p1', 'p2', 'p3', 'p4'].forEach((id, i) => ($(id).hidden = i + 1 !== n));
  const lis = $('stepper').children;
  for (let i = 0; i < lis.length; i++) {
    lis[i].className = n === 4 || i + 1 < n ? 'done' : i + 1 === n ? 'on' : '';
  }
  $('order').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- items ----------
function renderItems() {
  const list = $('itemList');
  if (!S.items.length) {
    list.innerHTML = '<p class="empty">No items yet. Add your first item below.</p>';
    $('totals1').hidden = true;
  } else {
    list.innerHTML = S.items.map((it, i) => `
      <article class="item">
        <div>
          <h3>${esc(it.name)}</h3>
          <div class="meta">${it.opts ? esc(it.opts) + ' · ' : ''}Qty ${it.qty} × ${money(unitP(it))}</div>
          <div class="meta"><a href="${esc(it.link)}" target="_blank" rel="noopener" class="link">View on Alibaba</a></div>
        </div>
        <div class="price">${money(lineP(it))}</div>
        <div class="acts">
          <button class="btn btn-sm" type="button" data-act="edit" data-i="${i}">Edit</button>
          <button class="btn btn-sm" type="button" data-act="remove" data-i="${i}">Remove</button>
        </div>
      </article>`).join('');
    const t = $('totals1');
    t.hidden = false;
    t.innerHTML = `<div class="big"><span>Items total</span><span>${money(subtotalP())}</span></div>
      <div class="ship"><span>Shipping</span><span>To be calculated and sent to you</span></div>`;
  }
}

function resetItemForm() {
  $('itemForm').reset();
  $('i_qty').value = 1;
  S.editing = null;
  $('formTitle').textContent = 'Add an item';
  $('itemBtn').textContent = 'Add item';
  $('itemCancel').hidden = true;
  ['i_link', 'i_qty', 'i_usd', 'i_name'].forEach((id) => $(id).setCustomValidity(''));
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
    $('i_link').value = it.link; $('i_name').value = it.name; $('i_opts').value = it.opts;
    $('i_qty').value = it.qty; $('i_usd').value = it.usd;
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
  if (!S.rate) return;
  const link = $('i_link'), name = $('i_name'), qty = $('i_qty'), usd = $('i_usd');
  [link, name, qty, usd].forEach((el) => el.setCustomValidity(''));
  if (!isAlibaba(link.value.trim())) link.setCustomValidity('Please paste a link from alibaba.com');
  if (!name.value.trim()) name.setCustomValidity('Please enter the product name');
  if (!(Number.isInteger(+qty.value) && +qty.value >= 1 && +qty.value <= 100000)) qty.setCustomValidity('Quantity must be a whole number of 1 or more');
  if (!(+usd.value > 0)) usd.setCustomValidity('Enter the unit price in US$');
  if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
  const item = { link: link.value.trim(), name: name.value.trim(), opts: $('i_opts').value.trim(), qty: +qty.value, usd: Math.round(+usd.value * 100) / 100 };
  if (S.editing !== null) S.items[S.editing] = item; else S.items.push(item);
  resetItemForm(); renderItems(); saveDraft();
});

// ---------- navigation ----------
$('to2').addEventListener('click', () => {
  if (!S.rate) return;
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

// ---------- review / order ----------
function custBlock(c, forDone) {
  const rows = [
    ['Name', c.c_name], ['Phone', c.c_phone], ['WhatsApp', c.c_whatsapp], ['Email', c.c_email],
    ['Address', [c.c_address, c.c_city, c.c_region].filter(Boolean).join(', ')],
    ['Digital address', c.c_digital], ['Landmark', c.c_landmark], ['Notes', c.c_notes],
  ].filter((r) => r[1]);
  return `<dl>${rows.map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl>`;
}
function itemsBlock(items) {
  return items.map((it) => `<article class="item"><div><h3>${esc(it.name)}</h3><div class="meta">${it.opts ? esc(it.opts) + ' · ' : ''}Qty ${it.qty} × ${money(it.unitP)}</div></div><div class="price">${money(it.lineP)}</div></article>`).join('');
}
function totalsBlock(subP, estDate) {
  return `<div class="totals"><div class="big"><span>Items total</span><span>${money(subP)}</span></div>
    <div class="ship"><span>Shipping</span><span>To be calculated and sent to you</span></div>
    <div class="ship"><span>Estimated arrival</span><span>Around ${esc(fmtDate(estDate))} (${S.cfg.arrivalDays} days)</span></div></div>`;
}
function snapshotItems() { return S.items.map((it) => ({ ...it, unitP: unitP(it), lineP: lineP(it) })); }

function renderReview() {
  const c = readCust();
  const est = new Date(Date.now() + S.cfg.arrivalDays * 86400000);
  $('reviewBox').innerHTML = `<h2>Review your order</h2><h3>Items</h3>${itemsBlock(snapshotItems())}${totalsBlock(subtotalP(), est)}<h3>Your details</h3>${custBlock(c)}
    <p class="muted" style="margin-top:12px;">Prices are in Ghana cedis at today's rate (US$1 = GH₵ ${S.rate.toFixed(2)}) and include our service charge.</p>`;
}

function makeRef(d) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  const buf = crypto.getRandomValues(new Uint8Array(4));
  buf.forEach((b) => (r += chars[b % chars.length]));
  const p = (n) => String(n).padStart(2, '0');
  return `LV-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${r}`;
}

function waLink(text) { return `https://wa.me/${S.cfg.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`; }

function orderText(o) {
  const lines = o.items.map((it, i) =>
    `${i + 1}. ${it.name}${it.opts ? ' (' + it.opts + ')' : ''}\n   Qty ${it.qty} x ${money(it.unitP)} = ${money(it.lineP)}\n   Alibaba price: US$${it.usd.toFixed(2)} each\n   ${it.link}`);
  const c = o.cust;
  return `Hello ${S.cfg.businessName}, I have placed an import order.\nRef: ${o.ref}\n\nITEMS\n${lines.join('\n')}\n\nItems total: ${money(o.subP)}\nShipping: to be calculated and sent to me\nEstimated arrival: around ${fmtDate(o.est)}\n\nName: ${c.c_name}\nPhone: ${c.c_phone}${c.c_whatsapp ? '\nWhatsApp: ' + c.c_whatsapp : ''}\nEmail: ${c.c_email}\nAddress: ${[c.c_address, c.c_city, c.c_region].filter(Boolean).join(', ')}${c.c_digital ? '\nDigital address: ' + c.c_digital : ''}${c.c_landmark ? '\nLandmark: ' + c.c_landmark : ''}${c.c_notes ? '\nNotes: ' + c.c_notes : ''}`;
}

async function placeOrder() {
  const btn = $('placeBtn');
  btn.disabled = true; btn.textContent = 'Placing order…';
  $('placeError').hidden = true;
  const now = new Date();
  const o = { ref: makeRef(now), items: snapshotItems(), subP: subtotalP(), cust: readCust(), est: new Date(now.getTime() + S.cfg.arrivalDays * 86400000), at: now };
  S.order = o;
  const c = o.cust;
  const data = {
    'form-name': 'order', 'bot-field': '',
    order_ref: o.ref, name: c.c_name, phone: c.c_phone, whatsapp: c.c_whatsapp, email: c.c_email,
    address: c.c_address, city: c.c_city, region: c.c_region, digital_address: c.c_digital, landmark: c.c_landmark, notes: c.c_notes,
    items_summary: orderText(o), items_json: JSON.stringify(o.items),
    items_subtotal_ghs: (o.subP / 100).toFixed(2), rate_usd_ghs: S.rate.toFixed(4), rate_time: S.rateAt ? S.rateAt.toISOString() : 'fallback rate',
    est_arrival: o.est.toISOString().slice(0, 10), consent_time: now.toISOString(), consent_given: 'items+prices; shipping separate; terms & privacy',
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
  btnReset();
  if (!sent) {
    const el = $('placeError');
    el.hidden = false;
    el.innerHTML = `We couldn't submit your order online. Please send it to us on WhatsApp instead: <a href="${esc(waLink(orderText(o)))}" target="_blank" rel="noopener" class="link">Send order on WhatsApp</a>, or press Confirm again to retry.`;
    $('placeBtn').disabled = false;
    return;
  }
  clearDraft();
  $('doneName').textContent = c.c_name.split(' ')[0];
  $('doneRef').textContent = o.ref;
  $('doneMsg').textContent = 'Your order has been sent to us. We will contact you shortly to confirm the price and share payment details. Keep your reference number handy.';
  $('doneSummary').innerHTML = `<h3>Items</h3>${itemsBlock(o.items)}${totalsBlock(o.subP, o.est)}<h3>Delivery details</h3>${custBlock(c)}`;
  $('doneWa').href = waLink(orderText(o));
  show(4);
}
function btnReset() { $('placeBtn').textContent = 'Confirm & place order'; }
$('placeBtn').addEventListener('click', placeOrder);
$('printBtn').addEventListener('click', () => window.print());

// ---------- startup ----------
async function loadSettings() {
  try { const r = await fetch('settings.json', { cache: 'no-cache' }); if (r.ok) S.cfg = { ...DEFAULTS, ...(await r.json()) }; } catch (e) {}
}
async function loadRate() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    if (d.result === 'success' && d.rates && d.rates.GHS > 0) {
      S.rate = d.rates.GHS;
      S.rateAt = new Date((d.time_last_update_unix || Date.now() / 1000) * 1000);
      return;
    }
  } catch (e) {}
  if (S.cfg.fallbackRate > 0) { S.rate = S.cfg.fallbackRate; S.rateAt = null; }
}

async function init() {
  $('yr').textContent = new Date().getFullYear();
  await loadSettings();
  $('waTop').href = waLink('Hello, I would like to import something from Alibaba.');
  $('waRate').href = waLink('Hello, I would like to place an import order.');
  $('factDays').textContent = `About ${S.cfg.arrivalDays} days to arrive`;
  loadDraft();
  await loadRate();
  if (!S.rate) {
    $('rateLine').hidden = true;
    $('rateError').hidden = false;
    $('itemBtn').disabled = true;
    $('to2').disabled = true;
    S.items = [];
  } else {
    $('rateLine').textContent = `Today's rate: US$1 = GH₵ ${S.rate.toFixed(2)}${S.rateAt ? ' · updated ' + fmtDate(S.rateAt) : ''}`;
  }
  renderItems();
}
init();
})();
