// Customer profile: share app, notifications inbox (+ phone push), account, debt and orders (with "order again").
// Refreshes every 10s while open, so admin changes (edited quantities, دانراو, payments, announcements) show up.
(function () {
  const VAPID = 'BFy4N44kpTJXxw67c6A86oiqDX5wezUD-tvXcAo3pio0mYkNJ-Wo8CL3oKU7d8jy9h2FcMwWen4wOdey3hg2qr8';
  const css = document.createElement('style');
  css.textContent = `#logout-btn{display:none!important}
.pf-card{border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px;background:#fff}
.pf-debt{font-size:30px;font-weight:800;line-height:1.3}
.pf-row{display:flex;justify-content:space-between;gap:10px;align-items:center}
.pf-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700}
.pf-order{cursor:pointer}.pf-items{margin-top:10px;border-top:1px solid var(--line)}
.pf-items .pf-row{padding:8px 0;border-bottom:1px solid var(--line);font-size:14px}
.pf-h{margin:18px 0 10px;font-size:17px;color:var(--ink)}
.pf-new{border-color:var(--cross);background:#fff8f7}.pf-disc{background:var(--cross);color:#fff}
.pf-note{color:var(--muted);font-size:13px;line-height:1.7}
#pf-open .count{margin-inline-start:6px}`;
  document.head.appendChild(css);

  const ST = {
    new: ['چاوەڕێی پشتڕاستکردنەوە', '#8a6d1d', '#fff7df'],
    confirmed: ['پشتڕاستکراوە', '#087c9c', '#e8f5f9'],
    delivered: ['دانراو', '#1b7f4b', '#e7f7ee'],
    cancelled: ['هەڵوەشاوە', '#b44', '#fff0f0']
  };
  const pf = document.createElement('div');
  pf.className = 'zm-modal';
  pf.innerHTML = '<div class="zm-sheet" role="dialog" aria-modal="true"><button class="icon-btn zm-x" data-pf-close aria-label="داخستن">✕</button><div class="zm-body" id="pf-body"></div></div>';
  document.body.appendChild(pf);
  const body = pf.querySelector('#pf-body');
  const exp = new Set();
  let data = null, notes = [], timer = null, lastJson = '', pushOn = false, seenBefore = 0, prevUnread = null;
  let seen = Number(localStorage.getItem('zm-seen') || 0);
  const when = d => new Date(d).toLocaleString('ku-IQ', { dateStyle: 'medium', timeStyle: 'short' });
  const pushOk = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const b64key = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  const unread = () => notes.filter(n => new Date(n.created_at).getTime() > seen).length;
  function badge() {
    const b = document.getElementById('pf-open'), u = unread();
    if (b) b.innerHTML = 'پڕۆفایل' + (u ? `<span class="count">${u}</span>` : '');
  }

  function draw() {
    if (!data) { body.innerHTML = '<p>...</p>'; return; }
    const { orders, acc } = data;
    const debt = Number(acc.delivered || 0) - Number(acc.paid || 0);
    const pays = acc.payments || [];
    const pushBlock = pushOk
      ? (pushOn
        ? `<div class="pf-row"><span>نۆتیفیکەیشنی مۆبایل چالاکە ✓</span><button class="btn btn-light" data-pf-pushoff>کوژاندنەوە</button></div>`
        : `<button class="btn btn-primary full" data-pf-pushon>نۆتیفیکەیشنی مۆبایل چالاک بکە</button><div class="pf-note" style="margin-top:6px">داشکاندن و نامە نوێیەکان راستەوخۆ بۆ مۆبایلەکەت دێن، بەبێ ئەوەی ئەپەکە کراوە بێت.</div>`)
      : '<div class="pf-note">بۆ وەرگرتنی نۆتیفیکەیشنی مۆبایل لە iPhone: لە Safari دوگمەی Share ← Add to Home Screen، پاشان ئەپەکە لە شاشەکەتەوە بکەرەوە.</div>';
    body.innerHTML = `<h3>پڕۆفایلەکەم</h3>
      <button class="btn btn-light full" data-pf-share style="margin-bottom:12px">هاوبەشیکردنی ئەپەکە</button>
      <div class="pf-card"><b>${esc(profile?.full_name)}</b><div style="color:var(--muted)">${esc(profile?.email)}</div><div style="color:var(--muted)">${esc(profile?.address)}</div></div>
      <h4 class="pf-h" style="margin-top:6px">نۆتیفیکەیشنەکان</h4>
      <div class="pf-card">${pushBlock}</div>
      ${notes.map(n => `<div class="pf-card ${new Date(n.created_at).getTime() > seenBefore ? 'pf-new' : ''}"><div class="pf-row"><b>${esc(n.title)}</b>${n.discount_percent ? `<span class="pf-badge pf-disc">${n.discount_percent}%</span>` : ''}</div>${n.body ? `<div class="pf-note" style="color:var(--text)">${esc(n.body)}</div>` : ''}<div class="pf-row" style="margin-top:6px"><span class="pf-note">${esc(when(n.created_at))}</span>${n.product_id ? `<button class="btn btn-light" data-pf-prod="${n.product_id}">بینینی بەرهەم</button>` : ''}</div></div>`).join('') || '<p class="pf-note">هێشتا نۆتیفیکەیشنت نییە.</p>'}
      <h4 class="pf-h">قەرد</h4>
      <div class="pf-card">
        <div class="pf-debt" style="color:${debt > 0 ? '#b44' : '#1b7f4b'}">${debt > 0 ? money(debt) : 'قەردت نییە'}</div>
        <div class="pf-note">کۆی داواکارییە دانراوەکان: ${money(acc.delivered || 0)} · پارەدراو: ${money(acc.paid || 0)}</div>
        ${pays.length ? `<div class="pf-items">${pays.slice(0, 8).map(p => `<div class="pf-row"><span>${esc(when(p.created_at))}${p.note ? ' · ' + esc(p.note) : ''}</span><b style="color:#1b7f4b">− ${money(p.amount)}</b></div>`).join('')}</div>` : ''}
      </div>
      <h4 class="pf-h">داواکارییەکانم</h4>
      ${orders.map(o => {
        const s = ST[o.status] || [o.status, '#555', '#eee'], open = exp.has(o.id);
        return `<div class="pf-card pf-order" data-pf-order="${o.id}"><div class="pf-row"><div><b>${money(o.total)}</b><div class="pf-note">${esc(when(o.created_at))} · ${(o.items || []).length} بەرهەم</div></div><span class="pf-badge" style="color:${s[1]};background:${s[2]}">${s[0]}</span></div>
          ${open ? `<div class="pf-items">${(o.items || []).map(i => `<div class="pf-row"><span>${esc(i.name)} × ${i.qty}</span><b>${money(i.price * i.qty)}</b></div>`).join('')}</div><button class="btn btn-primary full" style="margin-top:10px" data-pf-again="${o.id}">دووبارە داواکردنەوە</button>` : ''}</div>`;
      }).join('') || '<p class="pf-note">هێشتا داواکاریت نییە.</p>'}
      <button class="btn btn-light full" data-pf-logout style="margin-top:6px">دەرچوون</button>`;
  }

  async function fetchNotes() {
    const { data: n, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(30);
    if (!error) notes = n;
  }
  async function load() {
    const [o, a] = await Promise.all([sb.rpc('my_orders'), sb.rpc('my_account'), fetchNotes()]);
    if (o.error || a.error) { console.error(o.error || a.error); if (!data) body.innerHTML = '<p>نەتوانرا بخوێنرێتەوە.</p>'; return; }
    const next = { orders: o.data || [], acc: a.data || {} }, j = JSON.stringify([next, notes]);
    if (j === lastJson && data) return; // nothing changed => no redraw (keeps scroll position)
    lastJson = j; data = next; draw();
  }
  async function checkPush() {
    if (!pushOk) return;
    const reg = await navigator.serviceWorker.getRegistration();
    pushOn = !!(reg && await reg.pushManager.getSubscription()) && Notification.permission === 'granted';
  }

  async function openPf() {
    seenBefore = seen; seen = Date.now(); localStorage.setItem('zm-seen', String(seen)); badge();
    pf.classList.add('open'); draw(); lastJson = '';
    await checkPush(); await load(); draw();
    clearInterval(timer); timer = setInterval(load, 10000);
  }
  const closePf = () => { pf.classList.remove('open'); clearInterval(timer); };

  async function enablePush() {
    try {
      const perm = await Notification.requestPermission(); // first, inside the tap
      if (perm !== 'granted') { toast('ڕێگەپێدانی نۆتیفیکەیشن نەدرا.'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64key(VAPID) });
      const j = sub.toJSON();
      const { error } = await sb.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
      if (error) throw error;
      pushOn = true; toast('نۆتیفیکەیشنی مۆبایل چالاک کرا ✓');
    } catch (e) { console.error(e); toast('نەتوانرا چالاک بکرێت.'); }
    draw();
  }
  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.getRegistration(), sub = await reg?.pushManager.getSubscription();
      if (sub) { await sb.rpc('remove_push_subscription', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
      pushOn = false;
    } catch (e) { console.error(e); }
    draw();
  }
  async function share() {
    const d = { title: 'Zahra Medical', text: 'فرۆشگای زەهرا مێدیکاڵ — پێداویستی پزیشکی لە یەک شوێندا', url: location.origin };
    try {
      if (navigator.share) await navigator.share(d);
      else { await navigator.clipboard.writeText(d.url); toast('لینکەکە کۆپی کرا'); }
    } catch (e) { /* cancelled */ }
  }
  function again(id) {
    const o = data.orders.find(x => x.id === id);
    let n = 0;
    (o?.items || []).forEach(i => {
      if (!products.some(p => p.id === i.product_id)) return;
      const f = cart.find(x => x.id === i.product_id);
      f ? f.qty += i.qty : cart.push({ id: i.product_id, qty: i.qty });
      n++;
    });
    if (!n) { toast('ئەم بەرهەمانە ئێستا بەردەست نین.'); return; }
    renderCart(); closePf(); document.getElementById('cart-open').click();
  }

  pf.addEventListener('click', e => {
    if (e.target === pf || e.target.closest('[data-pf-close]')) { closePf(); return; }
    const ag = e.target.closest('[data-pf-again]');
    if (ag) { again(ag.dataset.pfAgain); return; }
    const pr = e.target.closest('[data-pf-prod]');
    if (pr) { closePf(); openProduct(pr.dataset.pfProd); return; }
    const o = e.target.closest('[data-pf-order]');
    if (o) { const id = o.dataset.pfOrder; exp.has(id) ? exp.delete(id) : exp.add(id); draw(); return; }
    if (e.target.closest('[data-pf-share]')) { share(); return; }
    if (e.target.closest('[data-pf-pushon]')) { enablePush(); return; }
    if (e.target.closest('[data-pf-pushoff]')) { disablePush(); return; }
    if (e.target.closest('[data-pf-logout]')) logout();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (pf.classList.contains('open')) load(); else poll(); } });

  // while the page is open, check for new announcements: badge on the profile button + a toast
  async function poll() {
    if (document.hidden || pf.classList.contains('open') || !document.getElementById('pf-open')) return;
    await fetchNotes();
    const u = unread();
    if (prevUnread !== null && u > prevUnread && notes[0]) toast('نۆتیفیکەیشنی نوێ: ' + notes[0].title);
    prevUnread = u; badge();
  }

  // the profile button appears in the header once the customer is signed in and approved
  function addBtn() {
    const na = document.querySelector('.nav-actions');
    if (!na || document.getElementById('pf-open') || !document.getElementById('logout-btn')) return;
    na.insertAdjacentHTML('afterbegin', '<button class="btn btn-light" id="pf-open" type="button">پڕۆفایل</button>');
    document.getElementById('pf-open').onclick = openPf;
    poll(); setInterval(poll, 45000);
  }
  new MutationObserver(addBtn).observe(document.querySelector('.nav-actions'), { childList: true });
  addBtn();
})();
