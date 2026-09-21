(async () => {
'use strict';
await LV.ready;
const { esc, money, cart } = LV;
const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
const ref = params.get('reference') || params.get('trxref') || '';

let pending = null;
try { pending = JSON.parse(localStorage.getItem('lv_pending_order') || 'null'); } catch (e) {}
if (pending && pending.payRef !== ref) pending = null;

function show({ eyebrow, title, msg, ref: shownRef, summary, actions }) {
  $('ttl').textContent = title; $('sub').textContent = '';
  $('resEyebrow').textContent = eyebrow; $('resTitle').textContent = title;
  $('resRef').textContent = shownRef || ''; $('resMsg').textContent = msg;
  $('resSummary').innerHTML = summary || '';
  $('resActions').innerHTML = actions || '';
  $('resultCard').hidden = false;
}
const waBtn = (text) => `<a class="btn btn-wa" href="${esc(LV.waHref(text))}" target="_blank" rel="noopener">Message us on WhatsApp</a>`;

function summaryHtml(p, paid) {
  if (!p) return paid ? `<div class="totals"><div class="big"><span>Amount paid</span><span>${money(paid)}</span></div></div>` : '';
  return `<h3>Items</h3>${p.lines.map((l) => `<article class="item cartline"><div class="cl-main"><img class="cl-img" ${LV.imgAttrs(l.image, 200)} alt=""><div><h3>${esc(l.name)}</h3><div class="meta">${l.qty} × ${money(l.unitP)}</div></div></div><div class="price">${money(l.lineP)}</div></article>`).join('')}
    <div class="totals"><div class="big"><span>Amount paid</span><span>${money(paid || p.subP)}</span></div>
    <div class="ship"><span>Delivery</span><span>Not included. You pay the delivery fee on delivery.</span></div></div>`;
}

async function check() {
  if (!ref) {
    show({ eyebrow: 'Payment', title: 'Nothing to check', msg: 'This page confirms a payment after you pay. If you just paid, please use the link Paystack gave you.', actions: '<a class="btn btn-primary" href="shop.html">Go to the shop</a>' });
    return;
  }
  let v = null, httpStatus = 0;
  try {
    const r = await fetch('/.netlify/functions/pay-verify?reference=' + encodeURIComponent(ref));
    httpStatus = r.status; v = await r.json();
  } catch (e) {}

  if (!v || httpStatus >= 500 || v.error) {
    show({
      eyebrow: 'Payment', title: "We couldn't confirm your payment yet",
      msg: 'If money left your account, please do not pay again. Send us your payment reference and we will check it for you.', ref,
      actions: `<button class="btn btn-primary" id="again" type="button">Check again</button>${waBtn('Hello, I paid on your website. My payment reference is ' + ref + '.')}`,
    });
    $('again').addEventListener('click', () => location.reload());
    return;
  }

  if (v.status === 'success') {
    cart.clear();
    try { localStorage.removeItem('lv_pending_order'); } catch (e) {}
    const orderRef = v.order_ref || (pending && pending.ref) || '';
    show({
      eyebrow: 'Payment received', title: `Thank you${pending && pending.name ? ', ' + pending.name : ''}`,
      msg: 'Your payment for the items was successful. We will contact you to confirm availability and arrange delivery. The delivery fee is paid by you on delivery. Please keep your reference number.',
      ref: orderRef || ref, summary: summaryHtml(pending, v.amount),
      actions: `${waBtn('Hello, I have paid for order ' + (orderRef || ref) + '.')}<button class="btn" id="print" type="button">Print / save receipt</button>`,
    });
    $('print').addEventListener('click', () => window.print());
    // Email ourselves a confirmation once per payment (Paystack also records it in the dashboard).
    const flag = 'lv_paid_' + ref;
    let done = false; try { done = localStorage.getItem(flag) === '1'; } catch (e) {}
    if (!done) {
      const data = { 'form-name': 'payment-confirmation', 'bot-field': '', order_ref: orderRef, paystack_reference: v.reference, amount_ghs: (v.amount / 100).toFixed(2), channel: v.channel || '', customer: (pending && pending.name) || '', paid_at: v.paid_at || '' };
      try {
        const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
        if (r.ok) localStorage.setItem(flag, '1');
      } catch (e) {}
    }
    return;
  }

  if (v.status === 'pending' || v.status === 'ongoing') {
    show({
      eyebrow: 'Payment', title: 'Your payment is still processing',
      msg: 'Mobile money payments can take a minute. Approve the prompt on your phone if you have not yet, then check again.', ref,
      actions: '<button class="btn btn-primary" id="again" type="button">Check again</button>',
    });
    $('again').addEventListener('click', () => location.reload());
    return;
  }

  // failed, abandoned, reversed, not_found
  show({
    eyebrow: 'Payment', title: 'Payment not completed',
    msg: 'No money was taken for this attempt. Your cart is still saved, so you can try again whenever you are ready.', ref,
    actions: `<a class="btn btn-primary" href="checkout.html">Back to my cart</a>${waBtn('Hello, I had trouble paying on your website. My reference is ' + ref + '.')}`,
  });
}
check();
})();
