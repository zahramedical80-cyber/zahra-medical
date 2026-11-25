// Customer profile: account info, debt (قەرد) with payments, and own orders. Refreshes every 10s while open,
// so changes the admin makes (edited quantities, دانراو, payments) show up here.
(function () {
  const css = document.createElement('style');
  css.textContent = `#logout-btn{display:none!important}
.pf-card{border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px;background:#fff}
.pf-debt{font-size:30px;font-weight:800;line-height:1.3}
.pf-row{display:flex;justify-content:space-between;gap:10px;align-items:center}
.pf-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700}
.pf-order{cursor:pointer}.pf-items{margin-top:10px;border-top:1px solid var(--line)}
.pf-items .pf-row{padding:8px 0;border-bottom:1px solid var(--line);font-size:14px}
.pf-h{margin:18px 0 10px;font-size:17px;color:var(--ink)}`;
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
  let data = null, timer = null;
  const when = d => new Date(d).toLocaleString('ku-IQ', { dateStyle: 'medium', timeStyle: 'short' });

  function draw() {
    if (!data) { body.innerHTML = '<p>...</p>'; return; }
    const { orders, acc } = data;
    const debt = Number(acc.delivered || 0) - Number(acc.paid || 0);
    const pays = acc.payments || [];
    body.innerHTML = `<h3>پڕۆفایلەکەم</h3>
      <div class="pf-card"><b>${esc(profile?.full_name)}</b><div style="color:var(--muted)">${esc(profile?.email)}</div><div style="color:var(--muted)">${esc(profile?.address)}</div></div>
      <div class="pf-card"><div style="color:var(--muted)">قەرد</div>
        <div class="pf-debt" style="color:${debt > 0 ? '#b44' : '#1b7f4b'}">${debt > 0 ? money(debt) : 'قەردت نییە'}</div>
        <div style="color:var(--muted);font-size:13px">کۆی داواکارییە دانراوەکان: ${money(acc.delivered || 0)} · پارەدراو: ${money(acc.paid || 0)}</div>
        ${pays.length ? `<div class="pf-items">${pays.slice(0, 8).map(p => `<div class="pf-row"><span>${esc(when(p.created_at))}${p.note ? ' · ' + esc(p.note) : ''}</span><b style="color:#1b7f4b">− ${money(p.amount)}</b></div>`).join('')}</div>` : ''}
      </div>
      <h4 class="pf-h">داواکارییەکانم</h4>
      ${orders.map(o => {
        const s = ST[o.status] || [o.status, '#555', '#eee'], open = exp.has(o.id);
        return `<div class="pf-card pf-order" data-pf-order="${o.id}"><div class="pf-row"><div><b>${money(o.total)}</b><div style="color:var(--muted);font-size:13px">${esc(when(o.created_at))} · ${(o.items || []).length} بەرهەم</div></div><span class="pf-badge" style="color:${s[1]};background:${s[2]}">${s[0]}</span></div>
          ${open ? `<div class="pf-items">${(o.items || []).map(i => `<div class="pf-row"><span>${esc(i.name)} × ${i.qty}</span><b>${money(i.price * i.qty)}</b></div>`).join('')}</div>` : ''}</div>`;
      }).join('') || '<p style="color:var(--muted)">هێشتا داواکاریت نییە.</p>'}
      <button class="btn btn-light full" data-pf-logout>دەرچوون</button>`;
  }

  async function load() {
    const [o, a] = await Promise.all([sb.rpc('my_orders'), sb.rpc('my_account')]);
    if (o.error || a.error) { console.error(o.error || a.error); if (!data) body.innerHTML = '<p>نەتوانرا بخوێنرێتەوە.</p>'; return; }
    data = { orders: o.data || [], acc: a.data || {} };
    draw();
  }
  const openPf = () => { pf.classList.add('open'); draw(); load(); clearInterval(timer); timer = setInterval(load, 10000); };
  const closePf = () => { pf.classList.remove('open'); clearInterval(timer); };

  pf.addEventListener('click', e => {
    if (e.target === pf || e.target.closest('[data-pf-close]')) { closePf(); return; }
    const o = e.target.closest('[data-pf-order]');
    if (o) { const id = o.dataset.pfOrder; exp.has(id) ? exp.delete(id) : exp.add(id); draw(); return; }
    if (e.target.closest('[data-pf-logout]')) logout();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pf.classList.contains('open')) load(); });

  // the profile button appears in the header once the customer is signed in and approved
  function addBtn() {
    const na = document.querySelector('.nav-actions');
    if (!na || document.getElementById('pf-open') || !document.getElementById('logout-btn')) return;
    na.insertAdjacentHTML('afterbegin', '<button class="btn btn-light" id="pf-open" type="button">پڕۆفایل</button>');
    document.getElementById('pf-open').onclick = openPf;
  }
  new MutationObserver(addBtn).observe(document.querySelector('.nav-actions'), { childList: true });
  addBtn();
})();
