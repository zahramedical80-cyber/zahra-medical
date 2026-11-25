// Storefront catalog: DB categories, product photos, product popup, steppers, nice cart, one-tap checkout with location
(function () {
  const style = document.createElement('style');
  style.textContent = `
.product-art,.mini-art{position:relative;overflow:hidden}
.product-art{cursor:zoom-in}.product-card h3{cursor:pointer}
.product-art img,.mini-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ph{font-style:normal;color:#aebfb3;font-size:30px}
.category-grid .category-card{align-items:center;justify-content:center;text-align:center;min-height:64px}
.step{display:flex;align-items:center;justify-content:space-between;gap:4px;background:var(--sage);border-radius:10px;padding:3px}
.step button{width:34px;height:34px;border:0;border-radius:8px;background:var(--ink);color:#fff;font-size:18px;font-weight:700;cursor:pointer}
.step b{min-width:24px;text-align:center}
@media(max-width:819px){.product-grid.cols-4 .step{padding:2px}.product-grid.cols-4 .step button{width:22px;height:26px;font-size:15px}.product-grid.cols-4 .step b{min-width:14px;font-size:12px}}
.zm-modal{position:fixed;inset:0;z-index:80;display:none;align-items:flex-end;justify-content:center;background:rgba(10,30,28,.6)}
.zm-modal.open{display:flex}
.zm-sheet{position:relative;background:#fff;width:min(560px,100%);max-height:92dvh;overflow:auto;border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom)}
@media(min-width:640px){.zm-modal{align-items:center}.zm-sheet{border-radius:22px}}
.zm-sheet img{display:block;width:100%;max-height:55dvh;object-fit:contain;background:#f1f5f2}
.zm-x{position:absolute;top:10px;left:10px;z-index:1;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2)}
.zm-body{display:grid;gap:8px;padding:16px 18px 20px}
.zm-body h3{margin:0;font-size:20px}.zm-body p{margin:0;white-space:pre-line;color:var(--muted)}
.zm-buy .add-btn{width:100%;min-height:50px;font-size:16px}
.zm-buy .step{padding:5px}.zm-buy .step button{width:50px;height:44px;font-size:22px}.zm-buy .step b{font-size:20px}
.cart-drawer{display:flex;flex-direction:column;overflow:hidden}
@media(min-width:768px){.cart-drawer{height:100%}}
.cart-items{flex:1 1 auto;overflow-y:auto;min-height:100px;padding:4px 16px}
.cart-line{display:grid;grid-template-columns:60px 1fr auto;gap:12px;align-items:center;padding:12px 0}
.mini-art{width:60px;height:60px;border-radius:12px}
.cart-line-info{display:grid;gap:2px}.cart-line-info b{font-size:14px;line-height:1.4}.cart-line-info strong{color:var(--ink)}
.cart-drawer .qty-controls button{width:34px;height:34px;border:0;background:var(--sage)}
.cart-total{flex:none;border-top:1px solid var(--line);font-size:18px;padding:14px 18px 6px}
.checkout-form{flex:none;padding:0 18px 16px}.checkout-form h3{display:none}
.cart-drawer.empty .cart-total,.cart-drawer.empty .checkout-form{display:none}
.who{margin:0;padding:10px 12px;border-radius:12px;background:var(--sage);font-size:14px;line-height:1.7}`;
  document.head.appendChild(style);
})();

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const art = p => p && p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : '<i class="ph">✚</i>';
let categories = [], openId = null;

// add button, or a − N + stepper once the product is in the cart
const buy = p => {
  const q = (cart.find(x => x.id === p.id) || {}).qty || 0;
  return q
    ? `<div class="step"><button data-qty="${p.id}" data-delta="-1" aria-label="کەمکردن">−</button><b>${q}</b><button data-qty="${p.id}" data-delta="1" aria-label="زیادکردن">+</button></div>`
    : `<button class="add-btn" data-add="${p.id}">+ زیادکردن</button>`;
};

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
    ? list.map(p => `<article class="product-card" data-pid="${p.id}"><div class="product-art">${art(p)}</div><span class="product-category">${esc(p.category)}</span><h3>${esc(p.name)}</h3><div class="product-bottom"><span class="product-price">${money(Number(p.price) || 0)}</span><div class="buy">${buy(p)}</div></div></article>`).join('')
    : '<div class="empty-state">هیچ بەرهەمێک نەدۆزرایەوە.</div>';
};

/* ---------- Product popup: big photo + description, stays open while adding ---------- */
const modal = document.createElement('div');
modal.className = 'zm-modal';
modal.innerHTML = '<div class="zm-sheet" role="dialog" aria-modal="true"></div>';
document.body.appendChild(modal);
const sheet = modal.firstChild;
const closeModal = () => { modal.classList.remove('open'); openId = null; };

function openProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  openId = id;
  sheet.innerHTML = `<button class="icon-btn zm-x" data-zm-close aria-label="داخستن">✕</button>${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">` : ''}
    <div class="zm-body"><small style="color:var(--muted)">${esc(p.category)}</small><h3>${esc(p.name)}</h3><b>${money(Number(p.price) || 0)}</b>${p.description ? `<p>${esc(p.description)}</p>` : ''}
    <div class="zm-buy">${buy(p)}</div></div>`;
  modal.classList.add('open');
}

document.addEventListener('click', e => {
  if (e.target === modal || e.target.closest('[data-zm-close]')) { closeModal(); return; }
  const hit = e.target.closest('.product-art, .product-card h3');
  if (hit) openProduct(hit.closest('.product-card').dataset.pid);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- Location: asked early (first add / cart open), cached, so sending is instant ---------- */
let lastPos = null, asked = false;
function askLocation() {
  const grab = opts => new Promise((ok, no) => navigator.geolocation.getCurrentPosition(p => {
    lastPos = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
    ok(lastPos);
  }, no, opts));
  if (!navigator.geolocation) return Promise.reject(new Error('unsupported'));
  // fast first (cached / network location), precise GPS only if that fails
  return grab({ enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 })
    .catch(err => { if (err && err.code === 1) throw err; return grab({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }); });
}
document.addEventListener('click', e => {
  if (!asked && e.target.closest('[data-add],#cart-open')) { asked = true; askLocation().catch(() => {}); }
});

/* ---------- Cart: thumbnails + one-tap checkout (name/address from the account, location attached) ---------- */
let checkout = document.getElementById('checkout-form');
const fresh = checkout.cloneNode(false); // drops the old form listeners
checkout.replaceWith(fresh);
checkout = fresh;
const SEND = 'ناردنی داواکاری', NOTE = 'ناو و ناونیشانەکەت لە هەژمارەکەتەوە دەنێردرێت، و شوێنەکەت (Location) لەگەڵی دەنێردرێت.';
checkout.innerHTML = `<h3>${SEND}</h3>
  <input type="hidden" name="customer"><input type="hidden" name="address">
  <p class="who"></p>
  <input name="phone" required inputmode="tel" autocomplete="tel" placeholder="ژمارەی مۆبایل (تەنها یەکجار دەنووسیت)">
  <button class="btn btn-primary full" type="submit">${SEND}</button>
  <button class="btn btn-light full" type="button" id="send-noloc" hidden>ناردن بەبێ شوێن</button>
  <small id="loc-note">${NOTE}</small>`;
try { checkout.phone.value = localStorage.getItem('zm-phone') || ''; } catch (e) {}

const _renderCart = renderCart;
renderCart = function () {
  _renderCart();
  const drawer = document.getElementById('cart-drawer');
  let n = 0;
  document.querySelectorAll('#cart-items .cart-line').forEach(l => {
    const id = l.querySelector('[data-qty]')?.dataset.qty;
    const p = products.find(x => x.id === id), q = (cart.find(x => x.id === id) || {}).qty || 0;
    if (!p) return;
    n += q;
    l.querySelector('.mini-art').innerHTML = art(p);
    l.querySelector('.cart-line-info').innerHTML = `<b>${esc(p.name)}</b><small>${money(p.price)} × ${q}</small><strong>${money(Number(p.price) * q)}</strong>`;
  });
  drawer.classList.toggle('empty', !cart.length);
  const h = drawer.querySelector('.drawer-head h2');
  if (h) h.textContent = cart.length ? `سەبەتەکەم (${n})` : 'سەبەتەکەم';
  const who = checkout.querySelector('.who');
  if (who) who.textContent = checkout.customer.value ? `${checkout.customer.value}${checkout.address.value ? ' · ' + checkout.address.value : ''}` : '';
  document.querySelectorAll('.product-card').forEach(c => {
    const p = products.find(x => x.id === c.dataset.pid), b = c.querySelector('.buy');
    if (p && b) b.innerHTML = buy(p);
  });
  if (openId) { const p = products.find(x => x.id === openId), b = modal.querySelector('.zm-buy'); if (p && b) b.innerHTML = buy(p); }
};

async function submitOrder(pos) {
  const btn = checkout.querySelector('button[type=submit]'), note = document.getElementById('loc-note'), alt = document.getElementById('send-noloc');
  btn.disabled = true; alt.hidden = true; btn.textContent = '...';
  const { data: code, error } = await sb.rpc('place_order', {
    p_customer: checkout.customer.value,
    p_phone: checkout.phone.value.trim(),
    p_address: checkout.address.value,
    p_items: cart.map(x => ({ id: x.id, qty: x.qty })),
    p_lat: pos ? pos.lat : null,
    p_lng: pos ? pos.lng : null
  });
  btn.disabled = false; btn.textContent = SEND;
  if (error) { toast(error.message || 'داواکارییەکە تۆمار نەکرا.'); console.error(error); return; }
  try { localStorage.setItem('zm-phone', checkout.phone.value.trim()); } catch (err) {}
  note.style.color = ''; note.textContent = NOTE;
  cart = []; renderCart(); closeCart();
  toast('داواکارییەکەت ناردرا ✓ کۆد: ' + code);
}

checkout.addEventListener('submit', async e => {
  e.preventDefault();
  if (!cart.length) { toast('سەبەتەکەت بەتاڵە.'); return; }
  const btn = checkout.querySelector('button[type=submit]'), note = document.getElementById('loc-note'), alt = document.getElementById('send-noloc');
  alt.hidden = true; note.style.color = '';
  let pos = lastPos && Date.now() - lastPos.t < 300000 ? lastPos : null; // already known => send instantly
  if (!pos) {
    btn.disabled = true; btn.textContent = '...'; note.textContent = 'شوێنەکەت دەدۆزرێتەوە...';
    try { pos = await askLocation(); }
    catch (err) {
      note.style.color = '#c0392b';
      note.textContent = err && err.code === 1
        ? 'ڕێگەپێدانی Location داخراوە. لە ڕێکخستنی ماڵپەړ (ئایکۆنی قوفڵ لە تەنیشت ناونیشانی وێبگەڕەکەت، یان Settings ← Chrome/Safari ← Location) ڕێگەی پێبدە، پاشان دووبارە هەوڵ بدەرەوە. ئەگەر لە ناو Instagram، Facebook یان WhatsApp کردووتەوە، لە Chrome/Safari بیکەرەوە.'
        : 'نەتوانرا شوێنەکەت بدۆزرێتەوە. GPS بکەرەوە و دووبارە هەوڵ بدەرەوە.';
      btn.disabled = false; btn.textContent = 'دووبارە هەوڵبدەرەوە'; alt.hidden = false;
      return;
    }
  }
  submitOrder(pos);
});
document.getElementById('send-noloc').addEventListener('click', () => submitOrder(null));
