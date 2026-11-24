const money = n => new Intl.NumberFormat('en-US').format(n) + ' د.ع';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Login (injected, so admin.html needs no changes besides the script tags) ----------
function showLogin(msg) {
  document.getElementById('login-box')?.remove();
  document.body.insertAdjacentHTML('afterbegin',
    `<div id="login-box" style="position:fixed;inset:0;z-index:999;background:#fff;display:grid;place-items:center;direction:rtl">
      <form id="login-form" style="display:grid;gap:12px;width:min(340px,90vw)">
        <h2>چوونەژوورەوەی بەڕێوەبەر</h2>
        <input name="email" type="email" placeholder="ئیمەیڵ" required style="padding:10px">
        <input name="password" type="password" placeholder="وشەی نهێنی" required style="padding:10px">
        <button type="submit" style="padding:10px">چوونەژوورەوە</button>
        <small id="login-msg" style="color:#c0392b">${esc(msg || '')}</small>
      </form></div>`);
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    if (error) { $('login-msg').textContent = 'ئیمەیڵ یان وشەی نهێنی هەڵەیە.'; return; }
    document.getElementById('login-box').remove();
    render();
  });
}

// ---------- Data ----------
async function render() {
  const [{ data: p, error: e1 }, { data: o, error: e2 }] = await Promise.all([
    sb.from('products').select('*').order('created_at'),
    sb.from('orders').select('*').order('created_at', { ascending: false })
  ]);
  if (e1 || e2) { console.error(e1 || e2); return; }
  $('stat-products').textContent = p.length;
  $('stat-orders').textContent = o.length;
  $('stat-sales').textContent = money(o.filter(x => x.status !== 'cancelled').reduce((s, x) => s + Number(x.total || 0), 0));
  $('admin-products').innerHTML = p.map(x =>
    `<tr><td>${esc(x.icon)} ${esc(x.name)}</td><td>${esc(x.category)}</td><td>${money(x.price)}</td><td>${x.stock}</td><td><button class="del-btn" data-del="${x.id}">سڕینەوە</button></td></tr>`
  ).join('') || '<tr><td colspan="5">بەرهەم نییە.</td></tr>';
  $('admin-orders').innerHTML = o.map(x =>
    `<tr><td>${esc(x.code)}</td><td>${esc(x.customer)}</td><td>${esc(x.phone)}</td><td>${money(x.total)}</td><td>${new Date(x.created_at).toLocaleString('ku-IQ')}</td></tr>`
  ).join('') || '<tr><td colspan="5">هێشتا داواکاری تۆمار نەکراوە.</td></tr>';
}

$('product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const { error } = await sb.from('products').insert({
    name: f.get('name'), category: f.get('category'),
    price: Number(f.get('price')), stock: Number(f.get('stock')),
    icon: f.get('icon') || '📦'
  });
  if (error) { alert('هەڵە: ' + error.message); return; }
  e.target.reset(); render();
});

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-del]');
  if (b && confirm('دڵنیایت لە سڕینەوەی ئەم بەرهەمە؟')) {
    const { error } = await sb.from('products').delete().eq('id', b.dataset.del);
    if (error) { alert('هەڵە: ' + error.message); return; }
    render();
  }
});

// ---------- Start ----------
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  session ? render() : showLogin();
})();
