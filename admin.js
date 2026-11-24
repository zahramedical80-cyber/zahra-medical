const ADMIN_EMAIL = 'abdurahmanemran001@gmail.com'; // real protection is the database policies; this only drives the UI
const money = n => new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0)) + ' د.ع';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { pending: 'چاوەڕێ', approved: 'ڕێپێدراو', rejected: 'ڕەتکراوە' };
const TABS = [['orders', 'داواکارییەکان'], ['customers', 'کڕیاران'], ['products', 'بەرهەمەکان'], ['cats', 'بەشەکان'], ['sales', 'فرۆشتن و قازانج']];
const fieldCss = 'padding:10px;border:1px solid #dce8eb;border-radius:9px;font-size:16px;width:100%';
const card = 'border:1px solid #e1ebed;border-radius:12px;padding:12px;margin-bottom:10px';
let cats = [], prods = [], costs = {}, orders = [], people = [], orderFilter = null, tab = 'orders';

// ---------- Login ----------
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

// ---------- One-time page setup: tabs, panels, upgraded product form ----------
function prepare() {
  if ($('tabs')) return;
  const wrap = document.querySelector('.admin-wrap');
  wrap.querySelector('.warning')?.remove();
  const stats = wrap.querySelector('.stats'), grid = wrap.querySelector('.admin-grid'), op = wrap.querySelector('.orders-panel');
  stats.dataset.tab = 'sales'; grid.dataset.tab = 'products'; op.dataset.tab = 'orders';
  op.innerHTML = '<h2>داواکارییەکان</h2><div id="order-filter"></div><div id="admin-orders"></div>';
  op.style.marginTop = '0';
  wrap.insertAdjacentHTML('afterbegin',
    `<div id="tabs" style="display:flex;gap:8px;overflow-x:auto;margin-bottom:18px;padding-bottom:4px">${TABS.map(([k, l]) => `<button class="btn btn-light" data-tab-btn="${k}" style="flex:none">${l}</button>`).join('')}</div>`);
  stats.insertAdjacentHTML('afterend',
    `<section class="panel" data-tab="customers" style="margin-bottom:18px"><h2>کڕیاران</h2><div id="admin-signups"></div></section>
     <section class="panel" data-tab="cats" style="margin-bottom:18px"><h2>بەشەکانی فرۆشگا</h2><div id="admin-cats"></div><div style="display:flex;gap:8px;margin-top:10px"><input id="new-cat" placeholder="بەشی نوێ" style="${fieldCss}"><button class="btn btn-light" data-cat-add style="flex:none">زیادکردن</button></div></section>
     <section class="panel" data-tab="sales" style="margin-bottom:18px"><h2>فرۆشتن و قازانج</h2><div id="sales-cards"></div><h3>ڕۆژانە</h3><div class="table-wrap" id="sales-days"></div><h3>مانگانە</h3><div class="table-wrap" id="sales-months"></div><p class="muted">قازانج = نرخی فرۆشتن − نرخی کڕین. داواکارییە کۆنەکان نرخی کڕینیان تۆمار نەکراوە.</p></section>`);
  const nav = document.querySelector('.admin-nav');
  if (nav && !$('admin-logout')) {
    nav.insertAdjacentHTML('beforeend', '<a href="#" id="admin-logout">دەرچوون</a>');
    $('admin-logout').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); location.reload(); };
  }
  const f = $('product-form');
  f.querySelector('[name=icon]')?.closest('label')?.remove();
  f.insertAdjacentHTML('afterbegin', '<input type="hidden" name="id">');
  f.querySelector('[name=price]').closest('label').insertAdjacentHTML('afterend',
    `<label>باسکردن (وەصفی بەرهەم)<textarea name="description" rows="3" maxlength="2000" style="${fieldCss};margin-top:6px"></textarea></label>
     <label>نرخی کڕین (بۆ قازانج، کڕیار نایبینێت)<input name="cost" type="number" min="0" value="0"></label>`);
  const submit = f.querySelector('button[type=submit]');
  submit.insertAdjacentHTML('beforebegin', '<label>وێنەی بەرهەم<input name="image" type="file" accept="image/*"></label><small id="img-note" class="muted"></small>');
  submit.insertAdjacentHTML('afterend', '<button type="button" class="btn btn-light" id="cancel-edit" hidden>هەڵوەشاندنەوە</button>');
  $('cancel-edit').onclick = resetForm;
  showTab(tab);
}

function showTab(k) {
  tab = k;
  document.querySelectorAll('[data-tab]').forEach(el => { el.style.display = el.dataset.tab === k ? '' : 'none'; });
  document.querySelectorAll('[data-tab-btn]').forEach(b => {
    const on = b.dataset.tabBtn === k;
    b.classList.toggle('btn-primary', on); b.classList.toggle('btn-light', !on);
  });
}

function resetForm() {
  const f = $('product-form');
  f.reset(); f.elements.id.value = '';
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
  const blob = await shrink(file), name = crypto.randomUUID() + '.jpg';
  const { error } = await sb.storage.from('product-images').upload(name, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return sb.storage.from('product-images').getPublicUrl(name).data.publicUrl;
}

// ---------- Data + rendering ----------
async function render() {
  const [pr, pc, or, cu, ca] = await Promise.all([
    sb.from('products').select('*').order('created_at'),
    sb.from('product_costs').select('*'),
    sb.from('orders').select('*, order_items(name, price, qty, cost)').order('created_at', { ascending: false }),
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('categories').select('*').order('sort').order('name')
  ]);
  const err = pr.error || pc.error || or.error || cu.error || ca.error;
  if (err) { console.error(err); alert('هەڵە: ' + err.message); return; }
  prods = pr.data; cats = ca.data; orders = or.data;
  costs = Object.fromEntries(pc.data.map(c => [c.product_id, c.cost]));
  people = cu.data.filter(x => (x.email || '').toLowerCase() !== ADMIN_EMAIL)
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
  renderTabs(); renderCustomers(); renderProducts(); renderCats(); renderOrders(); renderSales();
}

function renderTabs() {
  const pending = people.filter(x => x.status === 'pending').length;
  document.querySelectorAll('[data-tab-btn]').forEach(b => {
    const base = TABS.find(t => t[0] === b.dataset.tabBtn)[1];
    b.textContent = b.dataset.tabBtn === 'customers' && pending ? `${base} (${pending})` : base;
  });
}

function renderCustomers() {
  const btn = (id, st, label) => `<button class="del-btn" style="background:${st === 'approved' ? '#e7f7ee;color:#1b7f4b' : '#fff0f0;color:#b44'}" data-user="${id}" data-status="${st}">${label}</button>`;
  $('admin-signups').innerHTML = people.map(x => {
    const mine = orders.filter(o => o.user_id === x.id && o.status !== 'cancelled');
    return `<div style="${card}"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(x.full_name)}</b><span>${STATUS[x.status] || esc(x.status)}</span></div>
      <div class="muted">${esc(x.email)}</div><div class="muted">${esc(x.address)}</div>
      <div style="margin:6px 0">${mine.length} داواکاری · ${money(mine.reduce((s, o) => s + Number(o.total || 0), 0))}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${x.status === 'pending' ? btn(x.id, 'approved', 'ڕێپێدان') + btn(x.id, 'rejected', 'ڕەتکردنەوە') : x.status === 'approved' ? btn(x.id, 'rejected', 'ڕاگرتن') : btn(x.id, 'approved', 'ڕێپێدان')}
      <button class="del-btn" style="background:#eef6f8;color:#087c9c" data-cust-orders="${x.id}">داواکارییەکانی</button></div></div>`;
  }).join('') || '<p class="muted">هێشتا کەس تۆمار نەبووە.</p>';
}

function renderProducts() {
  $('stat-products').textContent = prods.length;
  const sel = $('product-form').elements.category, keep = sel.value;
  sel.innerHTML = cats.map(c => `<option>${esc(c.name)}</option>`).join('');
  if (keep) sel.value = keep;
  const thumb = x => x.image_url ? `<img src="${esc(x.image_url)}" alt="" style="width:38px;height:38px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-inline-end:8px">` : '';
  $('admin-products').innerHTML = prods.map(x =>
    `<tr><td>${thumb(x)}${esc(x.name)}</td><td>${esc(x.category)}</td><td>${money(x.price)}<br><small class="muted">کڕین: ${money(costs[x.id] || 0)}</small></td><td>${x.stock}</td><td><button class="del-btn" style="background:#eef6f8;color:#087c9c" data-edit="${x.id}">دەستکاری</button> <button class="del-btn" data-del="${x.id}">سڕینەوە</button></td></tr>`
  ).join('') || '<tr><td colspan="5">بەرهەم نییە.</td></tr>';
}

function renderCats() {
  $('admin-cats').innerHTML = cats.map(c =>
    `<div style="display:flex;gap:8px;margin-bottom:8px"><input data-cat-name="${c.id}" value="${esc(c.name)}" style="${fieldCss}"><button class="btn btn-primary" data-cat-save="${c.id}" style="flex:none">پاشەکەوت</button></div>`).join('');
}

function renderOrders() {
  const who = orderFilter && people.find(p => p.id === orderFilter);
  $('order-filter').innerHTML = who
    ? `<div style="${card};display:flex;justify-content:space-between;align-items:center"><b>داواکارییەکانی ${esc(who.full_name)}</b><button class="del-btn" style="background:#eef6f8;color:#087c9c" data-clear-filter>هەمووی</button></div>` : '';
  const list = orders.filter(o => !orderFilter || o.user_id === orderFilter);
  $('admin-orders').innerHTML = list.map(o => {
    const items = (o.order_items || []).map(i => `${esc(i.name)} × ${i.qty}`).join('، ');
    const loc = o.lat != null ? `<a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" rel="noopener">شوێنەکەی ببینە</a>` : '';
    return `<div style="${card}"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(o.customer)}</b><span class="muted">${new Date(o.created_at).toLocaleString('ku-IQ')}</span></div>
      <div class="muted">${esc(o.code)} · ${esc(o.phone)}</div><div class="muted">${esc(o.address)}</div>
      <div style="margin:6px 0">${items}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${money(o.total)}</b>${loc}</div></div>`;
  }).join('') || '<p class="muted">هێشتا داواکاری تۆمار نەکراوە.</p>';
}

function renderSales() {
  const live = orders.filter(o => o.status !== 'cancelled');
  const cost = o => (o.order_items || []).reduce((s, i) => s + Number(i.cost || 0) * i.qty, 0);
  const day = d => d.toLocaleDateString('en-CA'), mon = d => day(d).slice(0, 7);
  const group = kf => {
    const m = {};
    live.forEach(o => { const k = kf(new Date(o.created_at)), g = m[k] || (m[k] = { n: 0, sale: 0, cost: 0 }); g.n++; g.sale += Number(o.total || 0); g.cost += cost(o); });
    return m;
  };
  const days = group(day), months = group(mon), now = new Date();
  const z = { n: 0, sale: 0, cost: 0 };
  const t = days[day(now)] || z, m = months[mon(now)] || z;
  const box = (title, g) => `<div style="${card};flex:1 1 150px;margin:0"><small class="muted">${title}</small><div style="font-size:20px;font-weight:800">${money(g.sale)}</div><div style="color:#1b7f4b">قازانج: ${money(g.sale - g.cost)}</div><small class="muted">${g.n} داواکاری</small></div>`;
  $('sales-cards').innerHTML = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${box('ئەمڕۆ', t)}${box('ئەم مانگە', m)}</div>`;
  $('stat-orders').textContent = live.length;
  $('stat-sales').textContent = money(live.reduce((s, o) => s + Number(o.total || 0), 0));
  const table = (g, n) => `<table><thead><tr><th>بەروار</th><th>داواکاری</th><th>فرۆشتن</th><th>قازانج</th></tr></thead><tbody>${
    Object.entries(g).sort((a, b) => b[0].localeCompare(a[0])).slice(0, n).map(([k, v]) => `<tr><td>${k}</td><td>${v.n}</td><td>${money(v.sale)}</td><td>${money(v.sale - v.cost)}</td></tr>`).join('') || '<tr><td colspan="4">هێشتا فرۆشتن نییە.</td></tr>'}</tbody></table>`;
  $('sales-days').innerHTML = table(days, 30);
  $('sales-months').innerHTML = table(months, 12);
}

// ---------- Actions ----------
$('product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, d = new FormData(f), btn = f.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const row = { name: d.get('name'), category: d.get('category'), price: Number(d.get('price')), stock: Number(d.get('stock')), description: String(d.get('description') || '').trim() || null };
    const file = d.get('image');
    if (file && file.size) row.image_url = await uploadImage(file);
    const id = d.get('id');
    let pid = id;
    if (id) { const { error } = await sb.from('products').update(row).eq('id', id); if (error) throw error; }
    else { const { data, error } = await sb.from('products').insert({ ...row, icon: '' }).select('id').single(); if (error) throw error; pid = data.id; }
    const { error: ce } = await sb.from('product_costs').upsert({ product_id: pid, cost: Number(d.get('cost')) || 0 });
    if (ce) throw ce;
    resetForm(); render();
  } catch (err) { alert('هەڵە: ' + (err.message || err)); }
  btn.disabled = false;
});

document.addEventListener('click', async e => {
  const fail = error => { if (error) { alert('هەڵە: ' + error.message); return true; } };
  const tb = e.target.closest('[data-tab-btn]');
  if (tb) { showTab(tb.dataset.tabBtn); return; }
  const del = e.target.closest('[data-del]');
  if (del && confirm('دڵنیایت لە سڕینەوەی ئەم بەرهەمە؟')) {
    if (!fail((await sb.from('products').delete().eq('id', del.dataset.del)).error)) render();
  }
  const ed = e.target.closest('[data-edit]');
  if (ed) {
    const p = prods.find(x => x.id === ed.dataset.edit), f = $('product-form').elements;
    f.id.value = p.id; f.name.value = p.name; f.category.value = p.category; f.price.value = p.price;
    f.description.value = p.description || ''; f.cost.value = costs[p.id] || 0; f.stock.value = p.stock;
    $('img-note').textContent = p.image_url ? 'وێنەی ئێستا دەمێنێتەوە مەگەر وێنەیەکی نوێ هەڵبژێری.' : '';
    $('cancel-edit').hidden = false;
    $('product-form').querySelector('button[type=submit]').textContent = 'پاشەکەوتکردنی گۆڕانکارییەکان';
    $('product-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  const co = e.target.closest('[data-cust-orders]');
  if (co) { orderFilter = co.dataset.custOrders; renderOrders(); showTab('orders'); }
  if (e.target.closest('[data-clear-filter]')) { orderFilter = null; renderOrders(); }
});

start();
