(async () => {
'use strict';
await LV.ready;
const { esc, money, cart } = LV;
const $ = (id) => document.getElementById(id);

const products = await LV.loadProducts();
let filter = 'All';
let current = null;

function renderChips() {
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  if (cats.length < 1) { $('chips').hidden = true; return; }
  $('chips').hidden = false;
  $('chips').innerHTML = ['All', ...cats].map((c) => `<button type="button" class="chip${c === filter ? ' on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
}

function renderGrid() {
  const list = products.filter((p) => filter === 'All' || p.category === filter);
  $('productGrid').innerHTML = list.map((p) => `
    <button type="button" class="pcard" data-id="${esc(p.id)}">
      <span class="pimg"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">${p.inStock ? '' : '<span class="badge">Sold out</span>'}</span>
      <span class="pinfo"><h3>${esc(p.name)}</h3>${p.category ? `<span class="pcat">${esc(p.category)}</span>` : ''}<span class="pprice">${money(p.price)}</span></span>
    </button>`).join('');
}

function openProduct(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  current = p;
  $('pdImg').src = p.image; $('pdImg').alt = p.name;
  $('pdCat').textContent = p.category;
  $('pdName').textContent = p.name;
  $('pdPrice').textContent = money(p.price);
  $('pdDesc').textContent = p.description;
  $('pdQty').value = 1;
  $('pdAdded').hidden = true;
  $('pdBuy').hidden = !p.inStock;
  $('pdSold').hidden = p.inStock;
  const text = `Hello, I'm interested in "${p.name}" (${money(p.price)}) from your shop.`;
  $('pdWa').href = LV.waHref(text); $('pdWa2').href = LV.waHref(text);
  if (!$('pdlg').open) $('pdlg').showModal();
  history.replaceState(null, '', '#' + p.id);
}

$('productGrid').addEventListener('click', (e) => { const c = e.target.closest('.pcard'); if (c) openProduct(c.dataset.id); });
$('chips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; filter = c.dataset.c; renderChips(); renderGrid(); });
$('pdClose').addEventListener('click', () => $('pdlg').close());
$('pdlg').addEventListener('click', (e) => { if (e.target === $('pdlg')) $('pdlg').close(); });
$('pdlg').addEventListener('close', () => history.replaceState(null, '', location.pathname));
$('pdAdd').addEventListener('click', () => {
  const q = Math.floor(+$('pdQty').value);
  if (!current || !(q >= 1 && q <= 99)) { $('pdQty').focus(); return; }
  cart.add(current.id, q);
  $('pdAdded').hidden = false;
});

if (!products.length) {
  $('shopEmpty').hidden = false;
} else {
  renderChips(); renderGrid();
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) openProduct(hash);
}
})();
