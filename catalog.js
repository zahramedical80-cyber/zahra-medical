// Storefront catalog: categories from the database + product photos (replaces emoji icons)
(function () {
  const style = document.createElement('style');
  style.textContent = `
.product-art,.mini-art{position:relative;overflow:hidden}
.product-art img,.mini-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ph{font-style:normal;color:#aebfb3;font-size:30px}
.category-grid .category-card{align-items:center;justify-content:center;text-align:center;min-height:64px}`;
  document.head.appendChild(style);
})();

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const art = p => p && p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : '<i class="ph">✚</i>';
let categories = [];

loadProducts = async function () {
  const [p, c] = await Promise.all([
    sb.from('products').select('*').order('created_at'),
    sb.from('categories').select('*').order('sort').order('name')
  ]);
  if (p.error || c.error) { toast('نەتوانرا بەرهەمەکان بهێنرێن'); console.error(p.error || c.error); return; }
  products = p.data; categories = c.data;
  renderCategories(); renderProducts(); renderCart();
};

function renderCategories() {
  document.querySelector('.category-grid').innerHTML = categories.map(c =>
    `<button class="category-card" data-category="${esc(c.name)}"><b>${esc(c.name)}</b></button>`).join('');
  document.querySelector('.filter-row').innerHTML =
    `<button class="filter-chip${filter === 'all' ? ' active' : ''}" data-filter="all">هەمووی</button>` +
    categories.map(c => `<button class="filter-chip${filter === c.name ? ' active' : ''}" data-filter="${esc(c.name)}">${esc(c.name)}</button>`).join('');
}

renderProducts = function () {
  const list = products.filter(p =>
    (filter === 'all' || p.category === filter) &&
    p.name.toLowerCase().includes(query.toLowerCase()));
  grid.innerHTML = list.length
    ? list.map(p => `<article class="product-card"><div class="product-art">${art(p)}</div><span class="product-category">${esc(p.category)}</span><h3>${esc(p.name)}</h3><div class="product-bottom"><span class="product-price">${money(Number(p.price) || 0)}</span><button class="add-btn" data-add="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'تەواو بووە' : '+ زیادکردن'}</button></div></article>`).join('')
    : '<div class="empty-state">هیچ بەرهەمێک نەدۆزرایەوە.</div>';
};

const _renderCart = renderCart;
renderCart = function () {
  _renderCart();
  document.querySelectorAll('#cart-items .cart-line').forEach(l => {
    const p = products.find(x => x.id === l.querySelector('[data-qty]')?.dataset.qty);
    const m = l.querySelector('.mini-art');
    if (m) m.innerHTML = art(p);
  });
};
