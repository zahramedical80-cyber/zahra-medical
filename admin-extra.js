// Admin extras: search & filters, CSV export, invoices (print / WhatsApp), push notification for new orders.
// Loaded after admin.js; it wraps the render functions and adds its own controls.
(function () {
  const VAPID = 'BFy4N44kpTJXxw67c6A86oiqDX5wezUD-tvXcAo3pio0mYkNJ-Wo8CL3oKU7d8jy9h2FcMwWen4wOdey3hg2qr8';
  const q = id => document.getElementById(id);
  const inp = 'width:100%;padding:10px;border:1px solid #dce8eb;border-radius:9px;font-size:16px;margin-bottom:10px';
  let oq = '', cq = '', debtOnly = false;
  const pushOk = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const b64key = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  // ---- search wrappers (swap the data for one render, then restore it)
  const _ro = renderOrders;
  renderOrders = function () {
    const all = orders, s = oq.trim().toLowerCase();
    if (s) orders = all.filter(o => [o.customer, o.phone, o.code, o.address, ...(o.order_items || []).map(i => i.name)].join(' ').toLowerCase().includes(s));
    try { _ro(); } finally { orders = all; }
    document.querySelectorAll('#admin-orders [data-order][data-ostatus]').forEach(b => {
      const box = b.parentElement;
      if (box.querySelector('[data-inv]')) return;
      const id = b.dataset.order;
      box.insertAdjacentHTML('beforeend', `<button class="btn btn-light" data-inv="print" data-id="${id}">چاپکردنی پسوولە</button><button class="btn btn-light" data-inv="wa" data-id="${id}">ناردن بە WhatsApp</button>`);
    });
  };
  const _rc = renderCustomers;
  renderCustomers = function () {
    const all = people, s = cq.trim().toLowerCase();
    let l = all;
    if (s) l = l.filter(x => [x.full_name, x.email, x.address].join(' ').toLowerCase().includes(s));
    if (debtOnly) l = l.filter(x => debtOf(x.id) > 0);
    people = l;
    try { _rc(); } finally { people = all; }
  };

  // ---- CSV
  function csv(rows, name) {
    const t = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + t], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function exportCsv(kind) {
    const day = new Date().toLocaleDateString('en-CA');
    if (kind === 'debtors') {
      csv([['ناو', 'ئیمەیڵ', 'ناونیشان', 'قەرد']].concat(people.filter(x => debtOf(x.id) > 0).map(x => [x.full_name, x.email, x.address, Math.round(debtOf(x.id))])), `debtors-${day}.csv`);
    } else {
      csv([['کۆد', 'بەروار', 'کڕیار', 'مۆبایل', 'ناونیشان', 'دۆخ', 'کۆ', 'بەرهەمەکان', 'شوێن']].concat(orders.map(o => [o.code, new Date(o.created_at).toLocaleString('en-GB'), o.customer, o.phone, o.address, ST[o.status] || o.status, Math.round(o.total), (o.order_items || []).map(i => `${i.name} x${i.qty}`).join(' | '), o.lat != null ? `https://www.google.com/maps?q=${o.lat},${o.lng}` : ''])), `orders-${day}.csv`);
    }
  }

  // ---- invoice: print or WhatsApp text
  const orderById = id => orders.find(o => o.id === id);
  function invText(o) {
    const debt = o.user_id ? debtOf(o.user_id) : 0;
    const lines = (o.order_items || []).map(i => `• ${i.name} × ${i.qty} = ${money(i.price * i.qty)}`);
    return ['Zahra Medical — پسوولە', `کۆد: ${o.code}`, `بەروار: ${new Date(o.created_at).toLocaleDateString('en-GB')}`, `کڕیار: ${o.customer}`, '', ...lines, '', `کۆی گشتی: ${money(o.total)}`].concat(debt > 0 ? [`کۆی قەردی ئێستا: ${money(debt)}`] : []).join('\n');
  }
  function printInv(o) {
    const w = window.open('', '_blank');
    if (!w) { alert('ڕێگە بە هەڵقونی پەنجەرەی نوێ (popup) بدە.'); return; }
    const rows = (o.order_items || []).map(i => `<tr><td>${esc(i.name)}</td><td>${money(i.price)}</td><td>${i.qty}</td><td>${money(i.price * i.qty)}</td></tr>`).join('');
    w.document.write(`<!doctype html><html dir="rtl" lang="ckb"><head><meta charset="utf-8"><title>${esc(o.code)}</title><style>body{font-family:'Noto Sans Arabic',system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#14262a}h1{margin:0;color:#0e3b36}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:right}.tot{font-size:20px;font-weight:800}</style></head><body><h1>✚ ZAHRA MEDICAL</h1><p>پسوولە · ${esc(o.code)}<br>${new Date(o.created_at).toLocaleString('en-GB')}</p><p><b>${esc(o.customer)}</b><br>${esc(o.phone)} · ${esc(o.address)}</p><table><tr><th>بەرهەم</th><th>نرخ</th><th>ژمارە</th><th>کۆ</th></tr>${rows}</table><div class="tot">کۆی گشتی: ${money(o.total)}</div><script>onload=()=>print()<\/script></body></html>`);
    w.document.close();
  }
  function whatsapp(o) {
    let d = String(o.phone || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '964' + d.slice(1);
    if (d.length < 10) { alert('ژمارەی مۆبایلی کڕیار دروست نییە.'); return; }
    window.open(`https://wa.me/${d}?text=${encodeURIComponent(invText(o))}`, '_blank');
  }

  // ---- push for new orders on this device
  async function drawPush() {
    const el = q('adm-push');
    if (!el) return;
    if (!pushOk) { el.innerHTML = '<span class="muted">ئەم ئامێرە نۆتیفیکەیشنی وێب پاشگیری ناکات (لە iPhone پێش تر Add to Home Screen).</span>'; return; }
    const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription();
    const on = !!sub && Notification.permission === 'granted';
    el.innerHTML = on
      ? 'نۆتیفیکەیشنی داواکاریی نوێ لەسەر ئەم ئامێرە چالاکە ✓ <button class="btn btn-light" data-x-pushoff>کوژاندنەوە</button>'
      : '<button class="btn btn-primary" data-x-pushon>نۆتیفیکەیشنی داواکاریی نوێ چالاک بکە';
  }
  async function pushOn() {
    try {
      if (await Notification.requestPermission() !== 'granted') { alert('ڕێگەپێدانی نۆتیفیکەیشن نەدرا.'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64key(VAPID) });
      const j = sub.toJSON();
      const { error } = await sb.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
      if (error) throw error;
    } catch (e) { console.error(e); alert('نەتوانرا چالاک بکرێت: ' + (e.message || e)); }
    drawPush();
  }
  async function pushOff() {
    try {
      const reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription();
      if (sub) { await sb.rpc('remove_push_subscription', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
    } catch (e) { console.error(e); }
    drawPush();
  }

  // ---- UI, added once admin.js has built the page
  function init() {
    q('ord-tabs').insertAdjacentHTML('beforebegin',
      `<div id="adm-push" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"></div>
       <input id="x-ord-search" type="search" placeholder="گەڕان: کڕیار، مۆبایل، کۆد، بەرهەم..." style="${inp}">
       <div style="margin-bottom:12px"><button class="btn btn-light" data-csv="orders">CSV داواکارییەکان</button></div>`);
    q('admin-signups').insertAdjacentHTML('beforebegin',
      `<input id="x-cus-search" type="search" placeholder="گەڕان: ناو، ئیمەیڵ، ناونیشان..." style="${inp}">
       <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-light" id="x-debt">تەنها قەرداران</button><button class="btn btn-light" data-csv="debtors">CSV قەرداران</button></div>`);
    drawPush();
  }
  const wait = setInterval(() => { if (q('ord-tabs') && q('admin-signups')) { clearInterval(wait); init(); } }, 200);

  document.addEventListener('input', e => {
    if (e.target.id === 'x-ord-search') { oq = e.target.value; renderOrders(); }
    if (e.target.id === 'x-cus-search') { cq = e.target.value; renderCustomers(); }
  });
  document.addEventListener('click', e => {
    const inv = e.target.closest('[data-inv]');
    if (inv) { const o = orderById(inv.dataset.id); if (o) inv.dataset.inv === 'print' ? printInv(o) : whatsapp(o); return; }
    const c = e.target.closest('[data-csv]');
    if (c) { exportCsv(c.dataset.csv); return; }
    if (e.target.closest('#x-debt')) {
      debtOnly = !debtOnly;
      const b = q('x-debt'); b.classList.toggle('btn-primary', debtOnly); b.classList.toggle('btn-light', !debtOnly);
      renderCustomers(); return;
    }
    if (e.target.closest('[data-x-pushon]')) pushOn();
    if (e.target.closest('[data-x-pushoff]')) pushOff();
  });
})();
