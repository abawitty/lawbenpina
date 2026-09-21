(async () => {
'use strict';
await LV.ready;
const { esc, money, cart } = LV;
const $ = (id) => document.getElementById(id);

const products = await LV.loadProducts();
const CUST_IDS = ['c_name', 'c_phone', 'c_whatsapp', 'c_email', 'c_address', 'c_city', 'c_region', 'c_digital', 'c_landmark', 'c_notes'];
const CUST_KEY = 'lv_store_cust_v1';
const readCust = () => { const o = {}; CUST_IDS.forEach((id) => (o[id] = $(id).value.trim())); return o; };
const saveCust = () => { try { localStorage.setItem(CUST_KEY, JSON.stringify(readCust())); } catch (e) {} };
try { Object.entries(JSON.parse(localStorage.getItem(CUST_KEY) || '{}')).forEach(([k, v]) => { const el = $(k); if (el && typeof v === 'string') el.value = v; }); } catch (e) {}

let order = null;
let curTotal = 0;

// Online payment is only offered when the server says it is switched on (PAYSTACK_SECRET_KEY set).
let payEnabled = false;
try {
  const r = await fetch('/.netlify/functions/pay-init');
  if (r.ok && (r.headers.get('content-type') || '').includes('json')) payEnabled = Boolean((await r.json()).enabled);
} catch (e) {}
if (payEnabled) {
  $('k2text').textContent = 'I understand that I am paying for the items only, that I pay the delivery fee on delivery, and that Lawbenpina Ventures will contact me to confirm availability and delivery.';
  $('payNote').hidden = false;
}

// Cart lines always use the current products.json price; anything removed or sold out is dropped.
function currentLines() {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out = []; let dropped = false;
  cart.get().forEach((l) => { const p = byId.get(l.id); if (p && p.inStock) out.push({ p, qty: l.qty }); else dropped = true; });
  if (dropped) cart.set(out.map((l) => ({ id: l.p.id, qty: l.qty })));
  return { out, dropped };
}
const subtotal = (lines) => lines.reduce((t, l) => t + l.p.price * l.qty, 0);

function render() {
  const { out, dropped } = currentLines();
  $('dropped').hidden = !dropped;
  $('cartEmpty').hidden = out.length > 0;
  $('checkout').hidden = out.length === 0;
  if (!out.length) return;
  $('cartLines').innerHTML = out.map((l) => `
    <article class="item cartline">
      <div class="cl-main">
        <img class="cl-img" src="${esc(l.p.image)}" alt="${esc(l.p.name)}">
        <div><h3>${esc(l.p.name)}</h3><div class="meta">${money(l.p.price)} each</div>
          <label class="qtylabel">Qty <input class="qty" type="number" min="1" max="99" step="1" value="${l.qty}" data-id="${esc(l.p.id)}" inputmode="numeric"></label></div>
      </div>
      <div class="price">${money(l.p.price * l.qty)}</div>
      <div class="acts"><button class="btn btn-sm" type="button" data-remove="${esc(l.p.id)}">Remove</button></div>
    </article>`).join('');
  curTotal = subtotal(out);
  btnReset();
  $('cartTotals').innerHTML = `<div class="big"><span>Items total</span><span>${money(subtotal(out))}</span></div>
    <div class="ship"><span>Delivery fee</span><span>Paid by you on delivery</span></div>`;
}

$('cartLines').addEventListener('change', (e) => {
  const q = e.target.closest('input.qty');
  if (!q) return;
  const n = Math.floor(+q.value);
  if (n >= 1 && n <= 99) cart.setQty(q.dataset.id, n);
  render();
});
$('cartLines').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-remove]');
  if (b) { cart.remove(b.dataset.remove); render(); }
});

CUST_IDS.forEach((id) => $(id).addEventListener('input', saveCust));
['k1', 'k2', 'k3'].forEach((id) => $(id).addEventListener('change', () => {
  $('placeBtn').disabled = !['k1', 'k2', 'k3'].every((k) => $(k).checked);
}));

function custBlock(c) {
  const rows = [
    ['Name', c.c_name], ['Phone', c.c_phone], ['WhatsApp', c.c_whatsapp], ['Email', c.c_email],
    ['Address', [c.c_address, c.c_city, c.c_region].filter(Boolean).join(', ')],
    ['Digital address', c.c_digital], ['Landmark', c.c_landmark], ['Notes', c.c_notes],
  ].filter((r) => r[1]);
  return `<dl>${rows.map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl>`;
}

function makeRef(d) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  crypto.getRandomValues(new Uint8Array(4)).forEach((b) => (r += chars[b % chars.length]));
  const p = (n) => String(n).padStart(2, '0');
  return `LS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${r}`;
}

function orderText(o) {
  const lines = o.lines.map((l, i) => `${i + 1}. ${l.name}\n   ${l.qty} x ${money(l.unitP)} = ${money(l.lineP)}`);
  const c = o.cust;
  return `Hello ${LV.cfg.businessName}, I would like to order from your shop.\nRef: ${o.ref}\n\nITEMS\n${lines.join('\n')}\n\nItems total: ${money(o.subP)}\nDelivery fee: paid by me on delivery\n\nName: ${c.c_name}\nPhone: ${c.c_phone}${c.c_whatsapp ? '\nWhatsApp: ' + c.c_whatsapp : ''}\nEmail: ${c.c_email}\nAddress: ${[c.c_address, c.c_city, c.c_region].filter(Boolean).join(', ')}${c.c_digital ? '\nDigital address: ' + c.c_digital : ''}${c.c_landmark ? '\nLandmark: ' + c.c_landmark : ''}${c.c_notes ? '\nNotes: ' + c.c_notes : ''}`;
}

async function place() {
  const phone = $('c_phone'), wa = $('c_whatsapp'), dig = $('c_digital');
  [phone, wa, dig].forEach((el) => el.setCustomValidity(''));
  const okPhone = (v) => /^(\+?233|0)\d{9}$/.test(v.replace(/[\s\-()]/g, ''));
  if (!okPhone(phone.value)) phone.setCustomValidity('Enter a valid Ghana phone number, e.g. 024 000 0000');
  if (wa.value.trim() && !okPhone(wa.value)) wa.setCustomValidity('Enter a valid Ghana phone number');
  if (dig.value.trim() && !/^[A-Za-z]{2}-?\d{3,4}-?\d{4}$/.test(dig.value.trim())) dig.setCustomValidity('Format looks like GA-123-4567');
  if (!$('custForm').checkValidity()) { $('custForm').reportValidity(); return; }

  const { out } = currentLines();
  if (!out.length) { render(); return; }
  const btn = $('placeBtn');
  btn.disabled = true; btn.textContent = 'Sending…';
  $('placeError').hidden = true;
  const now = new Date();
  order = {
    ref: makeRef(now), cust: readCust(), subP: subtotal(out),
    lines: out.map((l) => ({ id: l.p.id, name: l.p.name, qty: l.qty, unitP: l.p.price, lineP: l.p.price * l.qty, image: l.p.image })),
  };
  const c = order.cust;
  const data = {
    'form-name': 'store-order', 'bot-field': '',
    order_ref: order.ref, name: c.c_name, phone: c.c_phone, whatsapp: c.c_whatsapp, email: c.c_email,
    address: c.c_address, city: c.c_city, region: c.c_region, digital_address: c.c_digital, landmark: c.c_landmark, notes: c.c_notes,
    items_summary: orderText(order), items_json: JSON.stringify(order.lines.map(({ id, name, qty, unitP, lineP }) => ({ id, name, qty, unitP, lineP }))),
    items_total_ghs: (order.subP / 100).toFixed(2), payment_status: 'To be arranged with the customer', consent_time: now.toISOString(),
    consent_given: payEnabled
      ? 'items+quantities+prices; paying items online via Paystack, delivery fee paid by customer on delivery, availability confirmed by seller; terms & privacy'
      : 'items+quantities+prices; availability and payment confirmed by seller, nothing charged, delivery fee paid on delivery; terms & privacy',
  };

  if (payEnabled) {
    let res = null, j = null;
    try {
      res = await fetch('/.netlify/functions/pay-init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderRef: order.ref, items: out.map((l) => ({ id: l.p.id, qty: l.qty })),
          customer: { name: c.c_name, phone: c.c_phone, email: c.c_email, address: c.c_address, city: c.c_city, region: c.c_region },
        }),
      });
      j = await res.json();
    } catch (e) { res = null; }
    if (res && res.ok && j && j.authorization_url) {
      data.payment_status = `Awaiting online payment (Paystack reference ${j.reference})`;
      try { localStorage.setItem('lv_pending_order', JSON.stringify({ ref: order.ref, payRef: j.reference, name: c.c_name.split(' ')[0], subP: order.subP, lines: order.lines })); } catch (e) {}
      await sendForm(data); // records the order by email; the details are also stored with the Paystack payment
      location.href = j.authorization_url;
      return;
    }
    if (res && res.status >= 400 && res.status < 500 && j && j.error) {
      btnReset(); render();
      $('placeError').hidden = false; $('placeError').textContent = j.error;
      $('placeBtn').disabled = false;
      return;
    }
    // Payment service unavailable: fall through and send the order the old way.
  }
  finish(await sendForm(data));
}

async function sendForm(data) {
  try {
    const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
    return r.ok;
  } catch (e) { return false; }
}

function finish(sent) {
  btnReset();
  if (!sent) {
    const el = $('placeError');
    el.hidden = false;
    el.innerHTML = `We couldn't send your order online. Please send it to us on WhatsApp instead: <a class="link" href="${esc(LV.waHref(orderText(order)))}" target="_blank" rel="noopener">Send order on WhatsApp</a>, or press the button again to retry.`;
    $('placeBtn').disabled = false;
    return;
  }
  cart.clear();
  $('checkout').hidden = true; $('dropped').hidden = true;
  $('doneName').textContent = order.cust.c_name.split(' ')[0];
  $('doneRef').textContent = order.ref;
  $('doneSummary').innerHTML = `<h3>Items</h3>${order.lines.map((l) => `<article class="item cartline"><div class="cl-main"><img class="cl-img" src="${esc(l.image)}" alt=""><div><h3>${esc(l.name)}</h3><div class="meta">${l.qty} × ${money(l.unitP)}</div></div></div><div class="price">${money(l.lineP)}</div></article>`).join('')}
    <div class="totals"><div class="big"><span>Items total</span><span>${money(order.subP)}</span></div><div class="ship"><span>Delivery fee</span><span>Paid by you on delivery</span></div></div>
    <h3>Delivery details</h3>${custBlock(order.cust)}`;
  $('doneWa').href = LV.waHref(orderText(order));
  $('done').hidden = false;
  $('done').scrollIntoView({ behavior: 'smooth' });
}
function btnReset() { $('placeBtn').textContent = payEnabled ? `Pay ${money(curTotal)} now` : 'Send my order'; }
$('placeBtn').addEventListener('click', place);
$('printBtn').addEventListener('click', () => window.print());

render();
})();
