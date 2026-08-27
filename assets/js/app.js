const DATA = window.HV_DATA;
// A relative url() inside a custom property resolves against the
// stylesheet that consumes it, not against the document, so the repo
// build asked for assets/css/assets/img/grain.png and got a 404 —
// while the inlined artifact, whose value is a data URI, worked.
// Absolutising against document.baseURI fixes the repo build and
// leaves a data URI untouched, since it is already absolute.
document.documentElement.style.setProperty('--grain-img',
  'url("' + new URL(DATA.assets.grain, document.baseURI).href + '")');

const sel = document.getElementById('sel');
const prep = document.getElementById('prep');
const P = DATA.products;

document.getElementById('count').textContent =
  P.length + ' preparations on file';

P.forEach((p, i) => {
  const o = document.createElement('option');
  o.value = i;
  o.textContent = p.brand + (p.generic ? '  ·  ' + p.generic : '');
  sel.appendChild(o);
});

function esc(s){
  return String(s).replace(/[&<>"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function show(i){
  const p = P[i];
  document.documentElement.style.setProperty('--accent', p.accent);
  const inks = p.swatch.map(c =>
    '<i style="background:' + esc(c) + '"></i>').join('');
  prep.innerHTML =
    '<figure class="plate fade" style="margin:0">' +
      '<img src="' + p.img + '" alt="' + esc(p.brand) + ' advertisement">' +
      '<figcaption>' + esc(p.series_label) +
        ' · 2550 × 3300 at 300 dpi</figcaption>' +
    '</figure>' +
    '<div class="copy fade">' +
      '<p class="eyebrow">' + esc(p.indication) + '</p>' +
      '<h2>' + esc(p.brand) + '</h2>' +
      (p.generic ? '<p class="gen">' + esc(p.generic) + '</p>' : '') +
      '<p class="body">' + esc(p.body) + '</p>' +
      '<dl class="spec">' +
        '<div><dt>Series</dt><dd>' + esc(p.series_label) + '</dd></div>' +
        '<div><dt>Supply</dt><dd>' + esc(p.supply) + '</dd></div>' +
        '<div><dt>Ink</dt><dd>' + esc(p.ink) +
          '<div class="inks">' + inks + '</div></dd></div>' +
      '</div></dl>' +
    '</div>';
}

sel.addEventListener('change', e => show(+e.target.value));
show(0);
