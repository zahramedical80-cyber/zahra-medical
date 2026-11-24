const ADMIN_EMAIL = 'abdurahmanemran001@gmail.com'; // real protection is the database policies; this only drives the UI
const money = n => new Intl.NumberFormat('en-US').format(n) + ' د.ع';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { pending: 'چاوەڕێ', approved: 'ڕێپێدراو', rejected: 'ڕەتکراوە' };

// ---------- Login (injected) ----------
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
    start();
  });
}

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showLogin(); return; }
  if ((session.user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    await sb.auth.signOut();
    showLogin('ئەم بەشە تەنها بۆ بەڕێوەبەرە.');
    return;
  }
  document.getElementById('login-box')?.remove();
  ensureSignupsPanel();
  render();
}

function ensureSignupsPanel() {
  if ($('admin-signups')) return;
  const wrap = document.querySelector('.admin-wrap');
  const anchor = wrap.querySelector('.stats') || wrap.firstElementChild;
  anchor.insertAdjacentHTML('afterend',
    `<section class="panel" style="margin-bottom:18px"><h2>👥 کڕیارەکان و داواکارییەکانی تۆمارکردن</h2><div class="table-wrap"><table><thead><tr><th>ناو</th><th>ئیمەیڵ</th><th>شوێن</th><th>دۆخ</th><th></th></tr></thead><tbody id="admin-signups"></tbody></table></div></section>`);
  const logoutLink = document.querySelector('.admin-nav');
  if (logoutLink && !$('admin-logout')) {
    logoutLink.insertAdjacentHTML('beforeend', '<a href="#" id="admin-logout">دەرچوون</a>');
    $('admin-logout').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
  }
}

// ---------- Data ----------
async function render() {
  const [pr, or, cu] = await Promise.all([
    sb.from('products').select('*').order('created_at'),
    sb.from('orders').select('*').order('created_at', { ascending: false }),
    sb.from('profiles').select('*').order('created_at', { ascending: false })
  ]);
  if (pr.error || or.error || cu.error) { console.error(pr.error || or.error || cu.error); return; }
  const p = pr.data, o = or.data;
  const customers = cu.data.filter(x => (x.email || '').toLowerCase() !== ADMIN_EMAIL)
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
  $('stat-products').textContent = p.length;
  $('stat-orders').textContent = o.length;
  $('stat-sales').textContent = money(o.filter(x => x.status !== 'cancelled').reduce((s, x) => s + Number(x.total || 0), 0));
  $('admin-products').innerHTML = p.map(x =>
    `<tr><td>${esc(x.icon)} ${esc(x.name)}</td><td>${esc(x.category)}</td><td>${money(x.price)}</td><td>${x.stock}</td><td><button class="del-btn" data-del="${x.id}">سڕینەوە</button></td></tr>`
  ).join('') || '<tr><td colspan="5">بەرهەم نییە.</td></tr>';
  $('admin-orders').innerHTML = o.map(x =>
    `<tr><td>${esc(x.code)}</td><td>${esc(x.customer)}</td><td>${esc(x.phone)}</td><td>${money(x.total)}</td><td>${new Date(x.created_at).toLocaleString('ku-IQ')}</td></tr>`
  ).join('') || '<tr><td colspan="5">هێشتا داواکاری تۆمار نەکراوە.</td></tr>';
  const btn = (id, st, label) => `<button class="del-btn" style="background:${st === 'approved' ? '#e7f7ee;color:#1b7f4b' : '#fff0f0;color:#b44'}" data-user="${id}" data-status="${st}">${label}</button>`;
  $('admin-signups').innerHTML = customers.map(x =>
    `<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${esc(x.address)}</td><td>${STATUS[x.status] || esc(x.status)}</td><td>${
      x.status === 'pending' ? btn(x.id, 'approved', 'ڕێپێدان') + ' ' + btn(x.id, 'rejected', 'ڕەتکردنەوە')
      : x.status === 'approved' ? btn(x.id, 'rejected', 'ڕاگرتن')
      : btn(x.id, 'approved', 'ڕێپێدان')}</td></tr>`
  ).join('') || '<tr><td colspan="5">هێشتا کەس تۆمار نەبووە.</td></tr>';
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
  const u = e.target.closest('[data-user]');
  if (u) {
    const { error } = await sb.from('profiles').update({ status: u.dataset.status }).eq('id', u.dataset.user);
    if (error) { alert('هەڵە: ' + error.message); return; }
    render();
  }
});

start();
