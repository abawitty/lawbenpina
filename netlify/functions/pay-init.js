'use strict';

// Starts a Paystack payment for a shop cart.
// The total is worked out HERE from products.json, never taken from the browser,
// so a customer cannot change the price. Needs the PAYSTACK_SECRET_KEY environment variable.

const PAYSTACK = 'https://api.paystack.co';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REF_RE = /^LS-\d{6}-[A-Z2-9]{4}$/;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const money = (p) => 'GHS ' + (p / 100).toFixed(2);
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

exports.handler = async (event) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  // Lets the checkout page know whether online payment is switched on.
  if (event.httpMethod === 'GET') return json(200, { enabled: Boolean(secret) });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!secret) return json(503, { error: 'Online payment is not set up yet.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Invalid request.' }); }

  const c = body.customer || {};
  const email = clip(c.email, 120);
  const name = clip(c.name, 100);
  const orderRef = clip(body.orderRef, 30);
  if (!REF_RE.test(orderRef)) return json(400, { error: 'Invalid order reference.' });
  if (!name || !EMAIL_RE.test(email)) return json(400, { error: 'Please check your name and email address.' });

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > 30) return json(400, { error: 'Your cart is empty or too large.' });

  // Load the current product list from the same site the request came from.
  const host = (event.headers && (event.headers['x-forwarded-host'] || event.headers.host)) || '';
  const origin = host ? `https://${host}` : (process.env.URL || '');
  if (!origin) return json(500, { error: 'Could not determine the site address.' });

  let products;
  try {
    const r = await fetch(`${origin}/products.json`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) throw new Error('products.json ' + r.status);
    products = ((await r.json()).products || []).filter((p) => p && p.name && Number(p.price) > 0);
  } catch (e) {
    console.error('Could not load products', e);
    return json(502, { error: 'We could not load the shop prices. Please try again.' });
  }
  const byId = new Map(products.map((p) => [slug(p.name), p]));

  let amount = 0;
  const lines = [];
  for (const it of items) {
    const p = byId.get(String(it && it.id));
    const qty = Math.floor(Number(it && it.qty));
    if (!p || p.status === 'sold_out') return json(400, { error: `"${clip(it && it.id, 60)}" is no longer available. Please refresh your cart.` });
    if (!(qty >= 1 && qty <= 99)) return json(400, { error: 'Invalid quantity.' });
    const unit = Math.round(Number(p.price) * 100);
    amount += unit * qty;
    lines.push(`${qty} x ${p.name} @ ${money(unit)}`);
  }
  if (!(amount > 0)) return json(400, { error: 'Invalid total.' });

  // A fresh reference per attempt (Paystack rejects re-used references).
  const reference = `${orderRef}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const address = [clip(c.address, 200), clip(c.city, 80), clip(c.region, 60)].filter(Boolean).join(', ');

  const payload = {
    email,
    amount,
    currency: 'GHS',
    reference,
    callback_url: `${origin}/payment-success.html`,
    channels: ['mobile_money', 'card'],
    metadata: {
      order_ref: orderRef,
      custom_fields: [
        { display_name: 'Order reference', variable_name: 'order_ref', value: orderRef },
        { display_name: 'Customer', variable_name: 'customer', value: name },
        { display_name: 'Phone', variable_name: 'phone', value: clip(c.phone, 30) },
        { display_name: 'Items', variable_name: 'items', value: lines.join('; ').slice(0, 900) },
        { display_name: 'Delivery address', variable_name: 'address', value: address },
        { display_name: 'Delivery cost', variable_name: 'delivery', value: 'Paid by the customer on delivery' },
      ],
    },
  };

  let res, data;
  try {
    res = await fetch(`${PAYSTACK}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await res.json();
  } catch (e) {
    console.error('Paystack request failed', e);
    return json(502, { error: 'We could not reach the payment service. Please try again.', detail: 'network error' });
  }
  if (!res.ok || !data || !data.status || !data.data || !data.data.authorization_url) {
    console.error('Paystack rejected the payment', res.status, data && data.message);
    // `detail` is Paystack's own reason (never the key); the checkout page only shows `error`.
    return json(502, { error: 'The payment service could not start your payment. Please try again.', detail: `Paystack ${res.status}: ${clip(data && data.message, 200)}` });
  }
  return json(200, { authorization_url: data.data.authorization_url, reference: data.data.reference || reference, amount });
};
