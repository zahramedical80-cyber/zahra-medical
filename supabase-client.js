// Supabase client — the publishable key is safe in frontend code (RLS protects the data).
// NEVER put the service_role / secret key here.
const SUPABASE_URL = 'https://gvgtiisiywcwmvohlmlk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZDoTFpAcSgDTZHVVuGzjCQ_eKo_L4Pn';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- Phone layout: 4 categories per row + product density toggle (2 or 4 per row) ----
(function () {
  const css = `
.view-toggle{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:0 0 10px;font-size:13px;color:var(--muted)}
.view-toggle button{width:38px;height:36px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--muted);font-weight:800;cursor:pointer}
.view-toggle button.active{background:var(--ink);border-color:var(--ink);color:#fff}
@media(min-width:820px){.view-toggle{display:none}}
@media(max-width:819px){
.category-grid{grid-template-columns:repeat(4,1fr);gap:8px}
.category-grid .category-card{flex-direction:column;justify-content:flex-start;text-align:center;gap:6px;padding:10px 4px}
.category-grid .category-card b{font-size:11px}
.product-grid.cols-4{grid-template-columns:repeat(4,1fr);gap:6px}
.product-grid.cols-4 .product-card{padding:6px;border-radius:10px}
.product-grid.cols-4 .product-art{aspect-ratio:1;font-size:26px;margin-bottom:6px}
.product-grid.cols-4 .product-category{display:none}
.product-grid.cols-4 .product-card h3{font-size:11px;line-height:1.4;margin-bottom:6px}
.product-grid.cols-4 .product-price{font-size:11px}
.product-grid.cols-4 .add-btn{min-height:32px;font-size:11px;padding:0}
}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const grid = document.getElementById('product-grid');
  if (!grid) return;
  let cols = '4';
  try { cols = localStorage.getItem('zm-cols') || '4'; } catch (e) {}
  const bar = document.createElement('div');
  bar.className = 'view-toggle';
  bar.innerHTML = '<span>بەرهەم لە ڕیزێکدا:</span><button type="button" data-cols="2" aria-label="دوو بەرهەم لە ڕیزێکدا">٢</button><button type="button" data-cols="4" aria-label="چوار بەرهەم لە ڕیزێکدا">٤</button>';
  grid.before(bar);
  const apply = c => {
    grid.classList.toggle('cols-4', c === '4');
    grid.classList.toggle('cols-2', c === '2');
    bar.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.cols === c));
    try { localStorage.setItem('zm-cols', c); } catch (e) {}
  };
  bar.addEventListener('click', e => { const b = e.target.closest('[data-cols]'); if (b) apply(b.dataset.cols); });
  apply(cols);
})();
