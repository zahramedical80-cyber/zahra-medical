const ADMIN_EMAIL = 'abdurahmanemran001@gmail.com'; // real protection is the database policies; this only drives the UI
const money = n => new Intl.NumberFormat('en-US').format(n) + ' د.ع';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { pending: 'چاوەڕێ', approved: 'ڕێپێدراو', rejected: 'ڕەتکراوە' };
const fieldCss = 'padding:10px;border:1px solid #dce8eb;border-radius:9px;font-size:16px';
let cats = [], prods = [];

// ---------- Login (injected) ----------
function showLogin(msg) {
  document.getElementById('login-box')?.remove();
  document.body.insertAdjacentHTML('afterbegin',
    `<div id="login-box" style="position:fixed;inset:0;z-index:999;background:#fff;display:grid;place-items:center;direction:rtl">
      <form id="login-form" style="display:grid;gap:12px;width:min(340px,90vw)">
        <h2>چوونەژوورەوەی بەڕێوەبەر</h2>
        <input name="email" type="email" placeholder="ئیمەیڵ" required style="${fieldCss}">
        <input name="password" type="password" placeholder="وشەی نهێنی" required style="${fieldCss}">
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
  prepare();
  render();
}

// ---------- One-time page setup (panels + product form upgrade) ----------
function prepare() {
  if ($('admin-signups')) return;
  const wrap = document.querySelector('.admin-wrap');
  const anchor = wrap.querySelector('.stats') || wrap.firstElementChild;
  anchor.insertAdjacentHTML('afterend',
    `<section class="panel" style="margin-bottom:18px"><h2>🏷️ بەشەکانی فرۆشگا</h2><div id="admin-cats"></div><div style="display:flex;gap:8px;margin-top:10px"><input id="new-cat" placeholder="بەشی نوێ" style="flex:1;${fieldCss}"><button class="btn btn-light" data-cat-add>زیادکردنی بەش</button></div></section>
    <section class="panel" style="margin-bottom:18px"><h2>👥 کڕیارەکان و داواکارییەکانی تۆمارکردن</h2><div class="table-wrap"><table><thead><tr><th>ناو</th><th>ئیمەیڵ</th><th>شوێن</th><th>دۆخ</th><th></th></tr></thead><tbody id="admin-signups"></tbody></table></div></section>`);
  const nav = document.querySelector('.admin-nav');
  if (nav && !$('admin-logout')) {
    nav.insertAdjacentHTML('beforeend', '<a href="#" id="admin-logout">دەرچوون</a>');
    $('admin-logout').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
  }
  const f = $('product-form');
  f.querySelector('[name=icon]')?.closest('label')?.remove();
  f.insertAdjacentHTML('afterbegin', '<input type="hidden" name="id">');
  const submit = f.querySelector('button[type=submit]');
  submit.insertAdjacentHTML('beforebegin', '<label>وێنەی بەرهەم<input name="image" type="file" accept="image/*"></label><small id="img-note" class="muted"></small>');
  submit.insertAdjacentHTML('afterend', '<button type="button" class="btn btn-light" id="cancel-edit" hidden>هەڵوەشاندنەوە</button>');
  $('cancel-edit').onclick = resetForm;
}

function resetForm() {
  const f = $('product-form');
  f.reset(); f.id.value = '';
  $('img-note').textContent = ''; $('cancel-edit').hidden = true;
  f.querySelector('button[type=submit]').textContent = 'زیادکردنی بەرهەم';
}

async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
}

async function uploadImage(file) {
  const blob = await shrink(file);
  const name = crypto.randomUUID() + '.jpg';
  const { error } = await sb.storage.from('product-images').upload(name, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return sb.storage.from('product-images').getPublicUrl(name).data.publicUrl;
}

// ---------- Data ----------
async function render() {
  const [pr, or, cu, ca] = await Promise.all([
    sb.from('products').select('*').order('created_at'),
    sb.from('orders').select('*').order('created_at', { ascending: false }),
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('categories').select('*').order('sort').order('name')
  ]);
  const err = pr.error || or.error || cu.error || ca.error;
  if (err) { console.error(err); return; }
  prods = pr.data; cats = ca.data;
  const o = or.data;
  const customers = cu.data.filter(x => (x.email || '').toLowerCase() !== ADMIN_EMAIL)
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
  $('stat-products').textContent = prods.length;
  $('stat-orders').textContent = o.length;
  $('stat-sales').textContent = money(o.filter(x => x.status !== 'cancelled').reduce((s, x) => s + Number(x.total || 0), 0));

  const sel = $('product-form').category, keep = sel.value;
  sel.innerHTML = cats.map(c => `<option>${esc(c.name)}</option>`).join('');
  if (keep) sel.value = keep;
  $('admin-cats').innerHTML = cats.map(c =>
    `<div style="display:flex;gap:8px;margin-bottom:8px"><input data-cat-name="${c.id}" value="${esc(c.name)}" style="flex:1;${fieldCss}"><button class="btn btn-primary" data-cat-save="${c.id}">پاشەکەوتکردن</button></div>`).join('');

  const thumb = x => x.image_url ? `<img src="${esc(x.image_url)}" alt="" style="width:38px;height:38px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-inline-end:8px">` : '';
  $('admin-products').innerHTML = prods.map(x =>
    `<tr><td>${thumb(x)}${esc(x.name)}</td><td>${esc(x.category)}</td><td>${money(x.price)}</td><td>${x.stock}</td><td><button class="del-btn" style="background:#eef6f8;color:#087c9c" data-edit="${x.id}">دەستکاری</button> <button class="del-btn" data-del="${x.id}">سڕینەوە</button></td></tr>`
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
  const f = e.target, d = new FormData(f), btn = f.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const row = { name: d.get('name'), category: d.get('category'), price: Number(d.get('price')), stock: Number(d.get('stock')) };
    const file = d.get('image');
    if (file && file.size) row.image_url = await uploadImage(file);
    const id = d.get('id');
    const { error } = id
      ? await sb.from('products').update(row).eq('id', id)
      : await sb.from('products').insert({ ...row, icon: '' });
    if (error) throw error;
    resetForm(); render();
  } catch (err) { alert('هەڵە: ' + (err.message || err)); }
  btn.disabled = false;
});

document.addEventListener('click', async e => {
  const fail = error => { if (error) { alert('هەڵە: ' + error.message); return true; } };
  const del = e.target.closest('[data-del]');
  if (del && confirm('دڵنیایت لە سڕینەوەی ئەم بەرهەمە؟')) {
    if (!fail((await sb.from('products').delete().eq('id', del.dataset.del)).error)) render();
  }
  const ed = e.target.closest('[data-edit]');
  if (ed) {
    const p = prods.find(x => x.id === ed.dataset.edit), f = $('product-form');
    f.id.value = p.id; f.name.value = p.name; f.category.value = p.category; f.price.value = p.price; f.stock.value = p.stock;
    $('img-note').textContent = p.image_url ? 'وێنەی ئێستا دەمێنێتەوە مەگەر وێنەیەکی نوێ هەڵبژێری.' : '';
    $('cancel-edit').hidden = false;
    f.querySelector('button[type=submit]').textContent = 'پاشەکەوتکردنی گۆڕانکارییەکان';
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const cs = e.target.closest('[data-cat-save]');
  if (cs) {
    const name = document.querySelector(`[data-cat-name="${cs.dataset.catSave}"]`).value.trim();
    if (name && !fail((await sb.from('categories').update({ name }).eq('id', cs.dataset.catSave)).error)) render();
  }
  if (e.target.closest('[data-cat-add]')) {
    const name = $('new-cat').value.trim();
    if (name && !fail((await sb.from('categories').insert({ name, sort: cats.length + 1 })).error)) { $('new-cat').value = ''; render(); }
  }
  const u = e.target.closest('[data-user]');
  if (u && !fail((await sb.from('profiles').update({ status: u.dataset.status }).eq('id', u.dataset.user)).error)) render();
});

start();
