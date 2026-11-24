const CART = 'zahra-cart-v1';
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f } catch { return f } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const money = n => new Intl.NumberFormat('en-US').format(n) + ' د.ع';

let products = [], cart = read(CART, []);
let filter = 'all', query = '';
const grid = document.getElementById('product-grid');
const count = document.getElementById('cart-count');

function toast(t) {
  const el = document.getElementById('toast');
  el.textContent = t; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2300);
}

async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').order('created_at');
  if (error) { toast('نەتوانرا بەرهەمەکان بهێنرێن'); console.error(error); return; }
  products = data;
  renderProducts(); renderCart();
}

function renderProducts() {
  const list = products.filter(p =>
    (filter === 'all' || p.category === filter) &&
    p.name.toLowerCase().includes(query.toLowerCase()));
  grid.innerHTML = list.length
    ? list.map(p => `<article class="product-card"><div class="product-art">${p.icon || '📦'}</div><span class="product-category">${p.category}</span><h3>${p.name}</h3><div class="product-bottom"><span class="product-price">${money(Number(p.price) || 0)}</span><button class="add-btn" data-add="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'تەواو بووە' : '+ زیادکردن'}</button></div></article>`).join('')
    : '<div class="empty-state">هیچ بەرهەمێک نەدۆزرایەوە.</div>';
}

function cartTotal() {
  return cart.reduce((s, x) => s + (Number(products.find(p => p.id === x.id)?.price) || 0) * x.qty, 0);
}

function renderCart() {
  // drop lines whose product no longer exists (e.g. old localStorage ids)
  if (products.length) cart = cart.filter(x => products.some(p => p.id === x.id));
  write(CART, cart);
  count.textContent = cart.reduce((s, x) => s + x.qty, 0);
  const items = document.getElementById('cart-items');
  items.innerHTML = cart.length ? cart.map(x => {
    const p = products.find(y => y.id === x.id);
    return p ? `<div class="cart-line"><div class="mini-art">${p.icon || '📦'}</div><div class="cart-line-info"><b>${p.name}</b><small>${money(p.price)}</small></div><div class="qty-controls"><button data-qty="${p.id}" data-delta="-1">−</button><b>${x.qty}</b><button data-qty="${p.id}" data-delta="1">+</button></div></div>` : '';
  }).join('') : '<div class="empty-state">سەبەتەکەت بەتاڵە.</div>';
  document.getElementById('cart-total').textContent = money(cartTotal());
}

document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) {
    const id = add.dataset.add, found = cart.find(x => x.id === id);
    found ? found.qty++ : cart.push({ id, qty: 1 });
    renderCart(); toast('بەرهەمەکە خرایە سەبەتە.');
  }
  const q = e.target.closest('[data-qty]');
  if (q) {
    const x = cart.find(x => x.id === q.dataset.qty);
    if (x) {
      x.qty += Number(q.dataset.delta);
      if (x.qty <= 0) cart = cart.filter(y => y.id !== x.id);
      renderCart();
    }
  }
  const cat = e.target.closest('[data-category]');
  if (cat) {
    filter = cat.dataset.category;
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    document.getElementById('products').scrollIntoView();
    renderProducts();
  }
  const chip = e.target.closest('[data-filter]');
  if (chip) {
    filter = chip.dataset.filter;
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.toggle('active', b === chip));
    renderProducts();
  }
});

document.getElementById('search').addEventListener('input', e => { query = e.target.value; renderProducts(); });
document.getElementById('cart-open').onclick = () => { document.body.classList.add('cart-open'); renderCart(); };
document.getElementById('cart-close').onclick = closeCart;
document.getElementById('drawer-backdrop').onclick = closeCart;
function closeCart() { document.body.classList.remove('cart-open'); }

document.getElementById('checkout-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!cart.length) { toast('سەبەتەکەت بەتاڵە.'); return; }
  const form = e.target, f = new FormData(form), btn = form.querySelector('button[type=submit]');
  if (btn) btn.disabled = true;
  // Only ids + quantities are sent; the server reads real prices and stock itself.
  const { data: code, error } = await sb.rpc('place_order', {
    p_customer: f.get('customer'),
    p_phone: f.get('phone'),
    p_address: f.get('address'),
    p_items: cart.map(x => ({ id: x.id, qty: x.qty }))
  });
  if (btn) btn.disabled = false;
  if (error) { toast(error.message || 'داواکارییەکە تۆمار نەکرا.'); console.error(error); return; }
  cart = []; renderCart(); form.reset(); closeCart();
  toast('داواکارییەکەت تۆمارکرا ✓ کۆد: ' + code);
  loadProducts(); // refresh stock
});

renderCart();
loadProducts();
