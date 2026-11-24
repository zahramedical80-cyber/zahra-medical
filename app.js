const CART = 'zahra-cart-v1';
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f } catch { return f } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const money = n => new Intl.NumberFormat('en-US').format(n) + ' د.ع';

let products = [], cart = read(CART, []), profile = null;
let filter = 'all', query = '';
const grid = document.getElementById('product-grid');
const count = document.getElementById('cart-count');

function toast(t) {
  const el = document.getElementById('toast');
  el.textContent = t; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

/* ================= Access gate: login / signup / waiting for approval ================= */
const cardStyle = 'background:#fff;border:1px solid #e1ebed;border-radius:16px;padding:28px;width:min(420px,94vw);display:grid;gap:12px;box-shadow:0 10px 40px rgba(16,59,80,.12)';
const inStyle = 'padding:11px;border:1px solid #dce8eb;border-radius:9px;font:inherit;width:100%;box-sizing:border-box';

function gate(inner) {
  document.getElementById('gate')?.remove();
  document.body.insertAdjacentHTML('afterbegin',
    `<div id="gate" style="position:fixed;inset:0;z-index:2000;background:#f3f8f9;overflow:auto;display:grid;place-items:center;padding:20px;direction:rtl"><div style="${cardStyle}"><div style="text-align:center;font-weight:800;color:#103b50">✚ ZAHRA MEDICAL</div>${inner}</div></div>`);
}
const hideGate = () => document.getElementById('gate')?.remove();
const setMsg = (t, ok) => { const m = document.getElementById('gate-msg'); if (m) { m.textContent = t; m.style.color = ok ? '#1b7f4b' : '#c0392b'; } };

function showAuth(mode = 'login') {
  const signup = mode === 'signup';
  gate(`
    <h2 style="margin:0;text-align:center">${signup ? 'دروستکردنی هەژمار' : 'چوونەژوورەوە'}</h2>
    <form id="auth-form" style="display:grid;gap:10px">
      ${signup ? `<input style="${inStyle}" name="full_name" required maxlength="120" placeholder="ناوی تەواو">
      <input style="${inStyle}" name="address" required maxlength="500" placeholder="شوێن / ناونیشان">` : ''}
      <input style="${inStyle}" name="email" type="email" required autocomplete="email" placeholder="ئیمەیڵ">
      <input style="${inStyle}" name="password" type="password" required minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="وشەی نهێنی (لانیکەم ٨ پیت)">
      <button class="btn btn-primary full" type="submit">${signup ? 'تۆمارکردن' : 'چوونەژوورەوە'}</button>
    </form>
    <small id="gate-msg"></small>
    <button id="switch-mode" type="button" style="border:0;background:none;color:#087c9c;cursor:pointer;font:inherit">${signup ? 'هەژمارت هەیە؟ بچۆ ژوورەوە' : 'هەژمارت نییە؟ دروستی بکە'}</button>
    ${signup ? '<small style="color:#78909a">دوای تۆمارکردن، بەڕێوەبەر پێویستە ڕێگەت پێبدات پێش ئەوەی بەرهەمەکان ببینیت.</small>' : ''}`);
  document.getElementById('switch-mode').onclick = () => showAuth(signup ? 'login' : 'signup');
  document.getElementById('auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; setMsg('');
    const email = String(f.get('email')).trim(), password = String(f.get('password'));
    if (signup) {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { full_name: String(f.get('full_name')).trim(), address: String(f.get('address')).trim() } }
      });
      btn.disabled = false;
      if (error) { setMsg(error.message); return; }
      if (data.session) { boot(); return; }
      gate(`<h2 style="margin:0;text-align:center">✓ تۆمارکرا</h2><p style="line-height:2;margin:0">لینکێکمان بۆ ئیمەیڵەکەت ناردووە. سەرەتا ئیمەیڵەکەت پشتڕاست بکەرەوە، پاشان بچۆ ژوورەوە. دوای ئەوە بەڕێوەبەر ڕێگەت پێدەدات و دەتوانیت بەرهەمەکان ببینیت.</p><button class="btn btn-primary full" id="to-login">چوونەژوورەوە</button>`);
      document.getElementById('to-login').onclick = () => showAuth('login');
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if (error) {
      setMsg(/confirm/i.test(error.message) ? 'سەرەتا ئیمەیڵەکەت پشتڕاست بکەرەوە.' : 'ئیمەیڵ یان وشەی نهێنی هەڵەیە.');
      return;
    }
    boot();
  });
}

function showWaiting(rejected) {
  gate(rejected
    ? `<h2 style="margin:0;text-align:center">دەستپێگەیشتن ڕێگەپێنەدراوە</h2><p style="line-height:2;margin:0">داواکارییەکەت قبوڵ نەکراوە. بۆ زانیاری زیاتر پەیوەندی بە فرۆشگاکەوە بکە.</p><button class="btn btn-light full" id="out">دەرچوون</button>`
    : `<h2 style="margin:0;text-align:center">چاوەڕێی ڕێپێدان بە</h2><p style="line-height:2;margin:0">هەژمارەکەت دروست کرا. هەرکاتێک بەڕێوەبەر ڕێگەت پێبدات دەتوانیت بەرهەمەکان ببینیت.</p><button class="btn btn-primary full" id="recheck">پشکنینەوە</button><button class="btn btn-light full" id="out">دەرچوون</button>`);
  document.getElementById('recheck')?.addEventListener('click', boot);
  document.getElementById('out').onclick = logout;
}

async function logout() {
  await sb.auth.signOut();
  write(CART, []);
  location.reload();
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showAuth('login'); return; }
  const { data: prof, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) { console.error(error); showAuth('login'); return; }
  profile = prof;
  if (!prof || prof.status === 'pending') { showWaiting(false); return; }
  if (prof.status === 'rejected') { showWaiting(true); return; }
  hideGate();
  if (!document.getElementById('logout-btn')) {
    document.querySelector('.nav-actions')?.insertAdjacentHTML('afterbegin',
      '<button class="btn btn-light" id="logout-btn" type="button">دەرچوون</button>');
    document.getElementById('logout-btn').onclick = logout;
  }
  const form = document.getElementById('checkout-form');
  if (form) { form.customer.value = prof.full_name || ''; form.address.value = prof.address || ''; }
  loadProducts();
}

/* ================= Store ================= */
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
  if (profile) { form.customer.value = profile.full_name || ''; form.address.value = profile.address || ''; }
  toast('داواکارییەکەت تۆمارکرا ✓ کۆد: ' + code);
  loadProducts();
});

renderCart();
boot();
