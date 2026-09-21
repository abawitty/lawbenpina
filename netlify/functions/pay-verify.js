'use strict';

// Asks Paystack whether a payment really went through. Called by payment-success.html.
// Only returns the minimum needed to show a confirmation. Needs PAYSTACK_SECRET_KEY.

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });
  if (!secret) return json(503, { error: 'Online payment is not set up yet.' });

  const ref = String((event.queryStringParameters && event.queryStringParameters.reference) || '');
  if (!/^[A-Za-z0-9._-]{6,80}$/.test(ref)) return json(400, { error: 'Invalid reference.' });

  let res, data;
  try {
    res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    data = await res.json();
  } catch (e) {
    console.error('Paystack verify failed', e);
    return json(502, { error: 'We could not reach the payment service.' });
  }

  if (res.status === 404 || (data && data.status === false && /not found/i.test(String(data.message)))) {
    return json(200, { status: 'not_found' });
  }
  if (!res.ok || !data || !data.status || !data.data) {
    console.error('Paystack verify rejected', res.status, data && data.message);
    return json(502, { error: 'We could not check that payment.' });
  }
  const t = data.data;
  return json(200, {
    status: t.status, // success | failed | abandoned | ongoing | pending | reversed
    amount: t.amount,
    currency: t.currency,
    reference: t.reference,
    order_ref: (t.metadata && t.metadata.order_ref) || null,
    channel: t.channel || null,
    paid_at: t.paid_at || null,
  });
};
