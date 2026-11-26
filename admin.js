const ADMIN_EMAIL = 'abdurahmanemran001@gmail.com'; // the owner; admin rights themselves are checked by the database (is_admin)
const money = n => new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0)) + ' د.ع';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = s => Number(String(s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6f0).replace(/[,\s]/g, ''));
const STATUS = { pending: 'چاوەڕێ', approved: 'ڕێپێدراو', rejected: 'ڕەتکراوە' };
const ST = { new: 'نوێ', confirmed: 'پشتڕاستکراوە', delivered: 'دانراو', cancelled: 'هەڵوەشاوە' };
const TABS = [['orders', 'داواکارییەکان'], ['customers', 'کڕیاران'], ['products', 'بەرهەمەکان'], ['cats', 'بەشەکان'], ['sales', 'فرۆشتن و قازانج'], ['notify', 'نۆتیفیکەیشن'], ['admins', 'ئەدمین']];
const fieldCss = 'padding:10px;border:1px solid #dce8eb;border-radius:9px;font-size:16px;width:100%';
const card = 'border:1px solid #e1ebed;border-radius:12px;padding:12px;margin-bottom:10px';
let cats = [], prods = [], costs = {}, orders = [], people = [], payments = [], admins = [], notes = [], orderFilter = null, tab = 'orders', ordView = 'active';
const openOrders = new Set();

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
  const { data: ok } = await sb.rpc('is_admin');
  if (!ok) {
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
  op.innerHTML = '<h2>داواکارییەکان</h2><div id="ord-tabs" style="display:flex;gap:8px;margin-bottom:12px"></div><div id="order-filter"></div><div id="admin-orders"></div>';
  op.style.marginTop = '0';
  wrap.insertAdjacentHTML('afterbegin',
    `<div id="tabs" style="display:flex;gap:8px;overflow-x:auto;margin-bottom:18px;padding-bottom:4px">${TABS.map(([k, l]) => `<button class="btn btn-light" data-tab-btn="${k}" style="flex:none">${l}</button>`).join('')}</div>`);
  stats.insertAdjacentHTML('afterend',
    `<section class="panel" data-tab="customers" style="margin-bottom:18px"><h2>کڕیاران</h2><div id="admin-signups"></div></section>
     <section class="panel" data-tab="cats" style="margin-bottom:18px"><h2>بەشەکانی فرۆشگا</h2><div id="admin-cats"></div><div style="display:flex;gap:8px;margin-top:10px"><input id="new-cat" placeholder="بەشی نوێ" style="${fieldCss}"><button class="btn btn-light" data-cat-add style="flex:none">زیادکردن</button></div></section>
     <section class="panel" data-tab="sales" style="margin-bottom:18px"><h2>فرۆشتن و قازانج</h2><div id="sales-cards"></div><h3>ڕۆژانە</h3><div class="table-wrap" id="sales-days"></div><h3>مانگانە</h3><div class="table-wrap" id="sales-months"></div><p class="muted">قازانج = نرخی فرۆشتن − نرخی کڕین. داواکارییە کۆنەکان نرخی کڕینیان تۆمار نەکراوە.</p></section>
     <section class="panel" data-tab="notify" style="margin-bottom:18px"><h2>نۆتیفیکەیشن و داشکاندن</h2>
       <div style="display:grid;gap:10px"><input id="nt-title" maxlength="100" placeholder="سەردێړ (بۆ نموونە: داشکاندنی هەفتە)" style="${fieldCss}">
       <textarea id="nt-body" rows="3" maxlength="500" placeholder="ناوەڕۆک" style="${fieldCss}"></textarea>
       <input id="nt-disc" type="number" min="1" max="100" placeholder="ڕێژەی داشکاندن % (ئارەزوومەندانە)" style="${fieldCss}">
       <select id="nt-prod" style="${fieldCss}"></select>
       <button class="btn btn-primary" data-note-send>ناردن بۆ هەموو کڕیاران</button></div>
       <h3>ناردراوەکان</h3><div id="admin-notes"></div></section>
     <section class="panel" data-tab="admins" style="margin-bottom:18px"><h2>ئەدمینەکان</h2><p class="muted">ئەدمین دەتوانێت هەموو بەشەکانی بەڕێوەبردن ببینێت. ئەم کەسە دەبێت پێشتر لە ماڵپەڕەکە هەژمارێکی دروست کردبێت بە هەمان ئیمەیڵ.</p>
       <div id="admin-admins"></div><div style="display:flex;gap:8px;margin-top:10px"><input id="new-admin" type="email" placeholder="ئیمەیڵی ئەدمینی نوێ" style="${fieldCss}"><button class="btn btn-light" data-admin-add style="flex:none">زیادکردن</button></div></section>`);
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
  const [pr, pc, or, cu, ca, pm, ad, an] = await Promise.all([
    sb.from('products').select('*').order('created_at'),
    sb.from('product_costs').select('*'),
    sb.from('orders').select('*, order_items(id, name, price, qty, cost)').order('created_at', { ascending: false }),
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('categories').select('*').order('sort').order('name'),
    sb.from('payments').select('*').order('created_at', { ascending: false }),
    sb.from('admins').select('*').order('added_at'),
    sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(50)
  ]);
  const err = pr.error || pc.error || or.error || cu.error || ca.error || pm.error || ad.error || an.error;
  if (err) { console.error(err); alert('هەڵە: ' + err.message); return; }
  prods = pr.data; cats = ca.data; orders = or.data; payments = pm.data; admins = ad.data; notes = an.data;
  costs = Object.fromEntries(pc.data.map(c => [c.product_id, c.cost]));
  const adminMails = new Set(admins.map(a => a.email));
  people = cu.data.filter(x => !adminMails.has((x.email || '').toLowerCase()))
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
  renderTabs(); renderCustomers(); renderProducts(); renderCats(); renderOrders(); renderSales(); renderNotes(); renderAdmins();
}

function renderTabs() {
  const badge = { customers: people.filter(x => x.status === 'pending').length, orders: orders.filter(o => o.status === 'new').length };
  document.querySelectorAll('[data-tab-btn]').forEach(b => {
    const k = b.dataset.tabBtn, base = TABS.find(t => t[0] === k)[1];
    b.textContent = badge[k] ? `${base} (${badge[k]})` : base;
  });
}

const debtOf = id => orders.filter(o => o.user_id === id && o.status === 'delivered').reduce((s, o) => s + Number(o.total || 0), 0)
  - payments.filter(p => p.user_id === id).reduce((s, p) => s + Number(p.amount || 0), 0);

function renderCustomers() {
  const btn = (id, st, label) => `<button class="del-btn" style="background:${st === 'approved' ? '#e7f7ee;color:#1b7f4b' : '#fff0f0;color:#b44'}" data-user="${id}" data-status="${st}">${label}</button>`;
  $('admin-signups').innerHTML = people.map(x => {
    const mine = orders.filter(o => o.user_id === x.id && o.status !== 'cancelled'), debt = debtOf(x.id);
    return `<div style="${card}"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(x.full_name)}</b><span>${STATUS[x.status] || esc(x.status)}</span></div>
      <div class="muted">${esc(x.email)}</div><div class="muted">${esc(x.address)}</div>
      <div style="margin:6px 0">${mine.length} داواکاری · ${money(mine.reduce((s, o) => s + Number(o.total || 0), 0))}</div>
      <div style="margin:6px 0;font-weight:800;color:${debt > 0 ? '#b44' : '#1b7f4b'}">قەرد: ${money(debt)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${x.status === 'pending' ? btn(x.id, 'approved', 'ڕێپێدان') + btn(x.id, 'rejected', 'ڕەتکردنەوە') : x.status === 'approved' ? btn(x.id, 'rejected', 'ڕاگرتن') : btn(x.id, 'approved', 'ڕێپێدان')}
      <button class="del-btn" style="background:#e7f7ee;color:#1b7f4b" data-pay="${x.id}">پارە وەرگیرا</button>
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

function renderNotes() {
  const sel = $('nt-prod'), keep = sel.value;
  sel.innerHTML = '<option value="">بێ بەرهەمی دیاریکراو</option>' + prods.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  sel.value = keep;
  $('admin-notes').innerHTML = notes.map(n => `<div style="${card}"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(n.title)}${n.discount_percent ? ` · ${n.discount_percent}%` : ''}</b><button class="del-btn" data-note-del="${n.id}">سڕینەوە</button></div>${n.body ? `<div class="muted">${esc(n.body)}</div>` : ''}<small class="muted">${new Date(n.created_at).toLocaleString('ku-IQ')}</small></div>`).join('') || '<p class="muted">هێشتا هیچت نهاردووە.</p>';
}

function renderAdmins() {
  $('admin-admins').innerHTML = admins.map(a => `<div style="${card};display:flex;justify-content:space-between;align-items:center;gap:8px"><span>${esc(a.email)}${a.email === ADMIN_EMAIL ? ' <small class="muted">(خاوەن)</small>' : ''}</span>${a.email === ADMIN_EMAIL ? '' : `<button class="del-btn" data-admin-del="${esc(a.email)}">لابردن</button>`}</div>`).join('');
}

// Orders: active list (new / confirmed) vs history (دانراو / cancelled); tap a card to open it, edit quantities, mark as دانراو
function renderOrders() {
  const who = orderFilter && people.find(p => p.id === orderFilter);
  $('order-filter').innerHTML = who
    ? `<div style="${card};display:flex;justify-content:space-between;align-items:center"><b>داواکارییەکانی ${esc(who.full_name)}</b><button class="del-btn" style="background:#eef6f8;color:#087c9c" data-clear-filter>هەمووی</button></div>` : '';
  const mine = orders.filter(o => !orderFilter || o.user_id === orderFilter);
  const hist = o => o.status === 'delivered' || o.status === 'cancelled';
  const act = mine.filter(o => !hist(o)), his = mine.filter(hist);
  $('ord-tabs').innerHTML = [['active', `چالاک (${act.length})`], ['history', `مێژوو (${his.length})`]]
    .map(([k, l]) => `<button class="btn ${ordView === k ? 'btn-primary' : 'btn-light'}" data-ord-view="${k}">${l}</button>`).join('');
  const small = 'padding:8px 12px;border-radius:9px;border:0;cursor:pointer;font-weight:700';
  $('admin-orders').innerHTML = (ordView === 'active' ? act : his).map(o => {
    const items = o.order_items || [], open = openOrders.has(o.id);
    const head = `<div data-toggle-order="${o.id}" style="display:flex;justify-content:space-between;gap:8px;cursor:pointer"><div><b>${esc(o.customer)}</b><div class="muted">${new Date(o.created_at).toLocaleString('ku-IQ')} · ${items.length} بەرهەم</div></div><div style="text-align:left"><b>${money(o.total)}</b><div class="muted">${ST[o.status] || esc(o.status)} ${open ? '▴' : '▾'}</div></div></div>`;
    if (!open) return `<div style="${card}">${head}</div>`;
    const editable = o.status !== 'cancelled';
    const rows = items.map(i => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid #eef3f4"><span style="flex:1">${esc(i.name)}<br><small class="muted">${money(i.price)} × ${i.qty} = ${money(i.price * i.qty)}</small></span>${editable ? `<span style="display:flex;align-items:center;gap:6px"><button style="${small};background:#eef6f8" data-item="${i.id}" data-q="${i.qty - 1}">−</button><b>${i.qty}</b><button style="${small};background:#eef6f8" data-item="${i.id}" data-q="${i.qty + 1}">+</button><button style="${small};background:#fff0f0;color:#b44" data-item="${i.id}" data-q="0">✕</button></span>` : ''}</div>`).join('');
    const loc = o.lat != null ? `<a href="https://www.google.com/maps?q=${o.lat},${o.lng}" target="_blank" rel="noopener">شوێنەکەی ببینە</a>` : '<span class="muted">بێ شوێن</span>';
    const acts = o.status === 'new' || o.status === 'confirmed'
      ? `<button class="btn btn-primary" data-ostatus="delivered" data-order="${o.id}">دانراو</button><button class="btn btn-light" data-ostatus="cancelled" data-order="${o.id}">هەڵوەشاندنەوە</button>`
      : `<button class="btn btn-light" data-ostatus="new" data-order="${o.id}">گەڕاندنەوە بۆ چالاک</button>`;
    return `<div style="${card};border-color:#087c9c">${head}<div class="muted" style="margin-top:8px">${esc(o.code)} · ${esc(o.phone)}</div><div class="muted">${esc(o.address)}</div><div style="margin:6px 0">${loc}</div>${rows}<div style="display:flex;justify-content:space-between;font-weight:800;padding:10px 0"><span>کۆی گشتی</span><span>${money(o.total)}</span></div><div style="display:flex;gap:8px;flex-wrap:wrap">${acts}</div></div>`;
  }).join('') || `<p class="muted">${ordView === 'active' ? 'داواکارییەکی چالاک نییە.' : 'مێژوو بەتاڵە.'}</p>`;
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
  const ov = e.target.closest('[data-ord-view]');
  if (ov) { ordView = ov.dataset.ordView; renderOrders(); return; }
  const tg = e.target.closest('[data-toggle-order]');
  if (tg) { const id = tg.dataset.toggleOrder; openOrders.has(id) ? openOrders.delete(id) : openOrders.add(id); renderOrders(); return; }
  const it = e.target.closest('[data-item]');
  if (it) {
    if (Number(it.dataset.q) <= 0 && !confirm('ئەم بەرهەمە لە داواکارییەکە لاببرێت؟')) return;
    if (!fail((await sb.rpc('admin_set_item_qty', { p_item: it.dataset.item, p_qty: Number(it.dataset.q) })).error)) render();
    return;
  }
  const os = e.target.closest('[data-ostatus]');
  if (os) {
    if (os.dataset.ostatus === 'cancelled' && !confirm('داواکارییەکە هەڵبوەشێنرێتەوە؟')) return;
    if (!fail((await sb.rpc('admin_set_order_status', { p_order: os.dataset.order, p_status: os.dataset.ostatus })).error)) render();
    return;
  }
  const pay = e.target.closest('[data-pay]');
  if (pay) {
    const a = num(prompt('بړی پارەکە (د.ع):') || '');
    if (!(a > 0)) return;
    const note = prompt('تێبینی (ئارەزوومەندانە):') || null;
    if (!fail((await sb.rpc('admin_add_payment', { p_user: pay.dataset.pay, p_amount: a, p_note: note })).error)) render();
    return;
  }
  if (e.target.closest('[data-note-send]')) {
    const title = $('nt-title').value.trim();
    if (!title) { alert('سەردێړ بنووسە.'); return; }
    const disc = num($('nt-disc').value || '0');
    const row = { title, body: $('nt-body').value.trim() || null, discount_percent: disc >= 1 && disc <= 100 ? Math.round(disc) : null, product_id: $('nt-prod').value || null };
    if (!fail((await sb.from('announcements').insert(row)).error)) { $('nt-title').value = ''; $('nt-body').value = ''; $('nt-disc').value = ''; $('nt-prod').value = ''; render(); alert('ناردرا.'); }
    return;
  }
  const nd = e.target.closest('[data-note-del]');
  if (nd && confirm('ئەم نۆتیفیکەیشنە بسڕرێتەوە؟')) {
    if (!fail((await sb.from('announcements').delete().eq('id', nd.dataset.noteDel)).error)) render();
    return;
  }
  if (e.target.closest('[data-admin-add]')) {
    const mail = $('new-admin').value.trim().toLowerCase();
    if (mail && !fail((await sb.from('admins').insert({ email: mail })).error)) { $('new-admin').value = ''; render(); }
    return;
  }
  const ad = e.target.closest('[data-admin-del]');
  if (ad && confirm('ئەم ئەدمینە لاببرێت؟')) {
    if (!fail((await sb.from('admins').delete().eq('email', ad.dataset.adminDel)).error)) render();
    return;
  }
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
  if (co) { orderFilter = co.dataset.custOrders; ordView = 'active'; renderOrders(); showTab('orders'); }
  if (e.target.closest('[data-clear-filter]')) { orderFilter = null; renderOrders(); }
});

start();
