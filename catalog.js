// Storefront catalog: DB categories, product photos, product detail popup, one-tap checkout with location
(function () {
  const style = document.createElement('style');
  style.textContent = `
.product-art,.mini-art{position:relative;overflow:hidden}
.product-art{cursor:zoom-in}.product-card h3{cursor:pointer}
.product-art img,.mini-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ph{font-style:normal;color:#aebfb3;font-size:30px}
.category-grid .category-card{align-items:center;justify-content:center;text-align:center;min-height:64px}
.zm-modal{position:fixed;inset:0;z-index:80;display:none;align-items:flex-end;justify-content:center;background:rgba(10,30,28,.6)}
.zm-modal.open{display:flex}
.zm-sheet{position:relative;background:#fff;width:min(560px,100%);max-height:92dvh;overflow:auto;border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom)}
@media(min-width:640px){.zm-modal{align-items:center}.zm-sheet{border-radius:22px}}
.zm-sheet img{display:block;width:100%;max-height:60dvh;object-fit:contain;background:#f1f5f2}
.zm-x{position:absolute;top:10px;left:10px;z-index:1;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.zm-body{display:grid;gap:8px;padding:16px 18px 20px}
.zm-body h3{margin:0;font-size:20px}.zm-body p{margin:0;white-space:pre-line;color:var(--muted)}
.who{margin:0;padding:10px 12px;border-radius:12px;background:var(--sage);font-size:14px;line-height:1.7}`;
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

/* ---------- Product popup: big photo + description ---------- */
const modal = document.createElement('div');
modal.className = 'zm-modal';
modal.innerHTML = '<div class="zm-sheet" role="dialog" aria-modal="true"></div>';
document.body.appendChild(modal);
const sheet = modal.firstChild;
const closeModal = () => modal.classList.remove('open');

function openProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  sheet.innerHTML = `<button class="icon-btn zm-x" data-zm-close aria-label="داخستن">✕</button>${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">` : ''}
    <div class="zm-body"><small style="color:var(--muted)">${esc(p.category)}</small><h3>${esc(p.name)}</h3><b>${money(Number(p.price) || 0)}</b>${p.description ? `<p>${esc(p.description)}</p>` : ''}
    <button class="btn btn-primary full" data-add="${p.id}" data-zm-close ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'تەواو بووە' : '+ زیادکردن بۆ سەبەتە'}</button></div>`;
  modal.classList.add('open');
}

document.addEventListener('click', e => {
  if (e.target === modal || e.target.closest('[data-zm-close]')) { closeModal(); return; }
  const hit = e.target.closest('.product-art, .product-card h3');
  if (hit) openProduct(hit.closest('.product-card').querySelector('[data-add]')?.dataset.add);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- Cart: thumbnails + one-tap checkout (name/address from the account, location attached) ---------- */
let checkout = document.getElementById('checkout-form');
const fresh = checkout.cloneNode(false); // drops the old form listeners
checkout.replaceWith(fresh);
checkout = fresh;
checkout.innerHTML = `<h3>ناردنی داواکاری</h3>
  <input type="hidden" name="customer"><input type="hidden" name="address">
  <p class="who"></p>
  <input name="phone" required inputmode="tel" autocomplete="tel" placeholder="ژمارەی مۆبایل (تەنها یەکجار دەنووسیت)">
  <button class="btn btn-primary full" type="submit">ناردنی داواکاری</button>
  <small id="loc-note">ناو و ناونیشانەکەت لە هەژمارەکەتەوە دەنێردرێت، و شوێنەکەت (Location) لەگەڵی دەنێردرێت. دەبێت Location چالاک بێت.</small>`;
try { checkout.phone.value = localStorage.getItem('zm-phone') || ''; } catch (e) {}

const _renderCart = renderCart;
renderCart = function () {
  _renderCart();
  document.querySelectorAll('#cart-items .cart-line').forEach(l => {
    const p = products.find(x => x.id === l.querySelector('[data-qty]')?.dataset.qty);
    const m = l.querySelector('.mini-art');
    if (m) m.innerHTML = art(p);
  });
  const who = checkout.querySelector('.who');
  if (who) who.textContent = checkout.customer.value ? `${checkout.customer.value}${checkout.address.value ? ' · ' + checkout.address.value : ''}` : '';
};

checkout.addEventListener('submit', async e => {
  e.preventDefault();
  if (!cart.length) { toast('سەبەتەکەت بەتاڵە.'); return; }
  const btn = checkout.querySelector('button[type=submit]'), note = document.getElementById('loc-note');
  btn.disabled = true; note.style.color = '';
  let pos;
  try {
    pos = await new Promise((ok, no) => navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
      : no(new Error('unsupported')));
  } catch (err) {
    note.style.color = '#c0392b';
    note.textContent = 'بۆ ناردنی داواکاری دەبێت شوێنەکەت (Location) چالاک بێت. لە ڕێکخستنی مۆبایل یان وێبگەڕەکەت ڕێگەت پێبدە، پاشان دووبارە هەوڵ بدەرەوە.';
    btn.disabled = false;
    return;
  }
  const { data: code, error } = await sb.rpc('place_order', {
    p_customer: checkout.customer.value,
    p_phone: checkout.phone.value.trim(),
    p_address: checkout.address.value,
    p_items: cart.map(x => ({ id: x.id, qty: x.qty })),
    p_lat: pos.coords.latitude,
    p_lng: pos.coords.longitude
  });
  btn.disabled = false;
  if (error) { toast(error.message || 'داواکارییەکە تۆمار نەکرا.'); console.error(error); return; }
  try { localStorage.setItem('zm-phone', checkout.phone.value.trim()); } catch (err) {}
  cart = []; renderCart(); closeCart();
  toast('داواکارییەکەت ناردرا ✓ کۆد: ' + code);
  loadProducts();
});
