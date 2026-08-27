const DATA = window.HV_DATA;
// A relative url() inside a custom property resolves against the
// stylesheet that consumes it, not against the document, so the repo
// build asked for assets/css/assets/img/grain.png and got a 404 —
// while the inlined artifact, whose value is a data URI, worked.
// Absolutising against document.baseURI fixes the repo build and
// leaves a data URI untouched, since it is already absolute.
document.documentElement.style.setProperty('--grain-img',
  'url("' + new URL(DATA.assets.grain, document.baseURI).href + '")');
if (DATA.assets.filmgrain) {
  document.documentElement.style.setProperty('--film-img',
    'url("' + new URL(DATA.assets.filmgrain, document.baseURI).href + '")');
}

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


/* ------------------------------------------------------------------
   SIGNAL DEGRADATION

   The plates are glitched in Python — pixel arrays, channel rolls, row
   slabs, JPEG bitstream corruption. None of that is available to a web
   page, and faking it with a canvas snapshot needs html2canvas, which
   the artifact's CSP blocks outright and which would taint on the
   Google Fonts anyway.

   So the page is torn the only way a browser can tear a live document:
   by cloning it. A pool of hidden copies of .wrap sits in a fixed
   overlay, scroll-aligned to the real one, and each slab is one of
   those copies clipped to a band and shifted. The bands land on real
   type and real photographs because they ARE the real type and
   photographs, which is why it reads as displacement rather than as an
   effect laid over the top.

   The interruption slate is deliberately NOT torn. It is the one
   surface that stays whole — it only drifts, message and slug bar
   together on the same gate weave, which is what a projected card
   does. The tearing is what the transmission is doing; the slate is
   what is put up in its place.

   THE ARC. A reader gets roughly five minutes. Bursts arrive at four
   declared severities and the transmission drops to a slate every
   twenty seconds or so. At the end of that window the slate comes up
   and does not go down again. The site is unusable until it is
   reloaded, which is the point: you were given five minutes of access
   to the record and then it was withdrawn.

   Two things keep that from being merely hostile:

   - SIGNAL in the masthead turns the whole apparatus off, lockout
     included, and the choice persists across reloads.
   - prefers-reduced-motion defaults it off, so nobody is ambushed.
------------------------------------------------------------------- */
(function () {
  var wrap = document.querySelector('.wrap');
  var gl = document.getElementById('gl');
  var slate = document.getElementById('slate');
  var btn = document.getElementById('sig');
  if (!wrap || !gl) return;

  // How long a reader gets before the transmission is withdrawn.
  var WINDOW_MS = 5 * 60 * 1000;

  var POOL = 10;
  var pool = [];
  var dirty = true;
  var running = false;
  var dead = false;              // terminal: the slate is up for good
  var burstTimer = null, slateTimer = null, churnTimer = null,
      endTimer = null, deadTimer = null;

  var offR = document.getElementById('hv-off-r');
  var offB = document.getElementById('hv-off-b');

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.round(rnd(a, b)); }

  /* ------------------------------------------------------------------
     THE FOUR SEVERITIES

     Declared rather than derived. A single continuous intensity dial
     produces a lot of indistinguishable middle; four named tiers with
     gaps between them give the page a vocabulary — a twitch, a fault,
     a collapse, and the end of it — and the reader learns to tell them
     apart.

     churn is what makes the top tiers read as scrambled rather than as
     one frozen broken frame: the slabs are re-laid every few tens of
     milliseconds for the whole duration, so it boils.
  ------------------------------------------------------------------ */
  var TIERS = {
    light: {
      n: [1, 3], shift: [3, 26], band: [0.5, 4], dur: [150, 460],
      rgb: [1, 3], marks: [0, 1], blocks: 0.20,
      scan: 0.12, hard: 0, invert: 0.05, churn: 0,
      solid: 0, scale: 0, spin: 0
    },
    medium: {
      n: [3, 6], shift: [12, 95], band: [1, 11], dur: [400, 1050],
      rgb: [3, 9], marks: [0, 3], blocks: 0.30,
      scan: 0.85, hard: 0.2, invert: 0.15, churn: [60, 130],
      solid: 0.06, scale: 0, spin: 0
    },
    heavy: {
      n: [7, POOL], shift: [40, 300], band: [2, 30], dur: [850, 2100],
      rgb: [9, 22], marks: [2, 7], blocks: 0.42,
      scan: 1, hard: 1, invert: 0.34, churn: [40, 90],
      solid: 0.14, scale: 0.20, spin: 0
    },
    // Beyond heavy. Heavy is a page coming apart; this is a page that
    // has stopped being one. Slabs are stretched and rotated, a third
    // drop out to flat colour with no image left in them at all, the
    // document itself is thrown off its axis, and the whole thing
    // re-lays every couple of frames so nothing holds still long
    // enough to be read.
    total: {
      n: [POOL, POOL], shift: [90, 620], band: [3, 46], dur: [1300, 3000],
      rgb: [22, 46], marks: [4, 11], blocks: 0.46,
      scan: 1, hard: 1, invert: 0.46, churn: [22, 52],
      solid: 0.32, scale: 0.62, spin: 0.30
    }
  };

  // Weighted, not uniform: a page that collapses as often as it twitches
  // stops reading as damage and starts reading as decoration.
  function roll() {
    var r = Math.random();
    return r < 0.46 ? 'light' : r < 0.76 ? 'medium'
      : r < 0.93 ? 'heavy' : 'total';
  }

  var DROPOUT = ['var(--ink)', 'var(--paper)', '#C2201A', '#F2F0EA',
    'var(--panel)'];

  // ------------------------------------------------------------------
  // the ghost pool
  // ------------------------------------------------------------------
  function build() {
    gl.querySelectorAll('.gl-slab').forEach(function (n) { n.remove(); });
    pool = [];
    for (var i = 0; i < POOL; i++) {
      var slab = document.createElement('div');
      slab.className = 'gl-slab';
      var ghost = wrap.cloneNode(true);
      ghost.classList.add('gl-ghost');
      ghost.removeAttribute('id');
      // a clone must never be reachable: no duplicate ids, no tab stops,
      // nothing a screen reader can find
      ghost.querySelectorAll('[id]').forEach(function (n) {
        n.removeAttribute('id');
      });
      ghost.querySelectorAll('select,button,a,input').forEach(function (n) {
        n.setAttribute('tabindex', '-1');
        n.setAttribute('aria-hidden', 'true');
        n.disabled = true;
      });
      slab.appendChild(ghost);
      gl.appendChild(slab);
      pool.push({ slab: slab, ghost: ghost });
    }
    dirty = false;
  }

  function align() {
    // The overlay is fixed to the viewport, so the ghost is hung at
    // minus the scroll offset and each clone sits exactly on top of the
    // element it was cloned from.
    var top = -window.scrollY;
    var box = wrap.getBoundingClientRect();
    for (var i = 0; i < pool.length; i++) {
      var g = pool[i].ghost;
      g.style.top = top + 'px';
      g.style.left = box.left + 'px';
      g.style.width = box.width + 'px';
    }
  }

  // ------------------------------------------------------------------
  // laying the slabs — once for light, repeatedly while churning
  // ------------------------------------------------------------------
  function lay(t) {
    var n = ri(t.n[0], t.n[1]);
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (i >= n) { p.slab.style.display = 'none'; continue; }
      p.slab.style.display = 'block';

      var sx = (Math.random() < 0.5 ? -1 : 1) * rnd(t.shift[0], t.shift[1]);
      var sy = Math.random() < 0.25 ? rnd(-6, 6) : 0;

      if (Math.random() < t.blocks) {
        // a macroblock rather than a scanline: clipped on all four sides
        var y = rnd(0, 88), h = rnd(t.band[0], t.band[1]);
        var x = rnd(0, 66), w = rnd(6, 36);
        p.slab.style.clipPath = 'inset(' + y + '% ' + (100 - x - w) +
          '% ' + Math.max(0, 100 - y - h) + '% ' + x + '%)';
      } else if (t === TIERS.heavy && Math.random() < 0.22) {
        // heavy also tears vertically, which nothing else does — it is
        // the tell that the whole raster has gone rather than a line
        var cx = rnd(0, 78), cw = rnd(4, 22);
        p.slab.style.clipPath = 'inset(0 ' + (100 - cx - cw) + '% 0 ' +
          cx + '%)';
        sy = rnd(-90, 90); sx *= 0.3;
      } else {
        var by = rnd(0, 94), bh = rnd(t.band[0], t.band[1]);
        p.slab.style.clipPath = 'inset(' + by + '% 0 ' +
          Math.max(0, 100 - by - bh) + '% 0)';
      }

      var tf = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) +
        'px,0)';
      // stretching a clipped band is what turns a displaced line into a
      // smear — the pixels are pulled, not just moved
      if (t.scale && Math.random() < t.scale) {
        tf += ' scale(' + rnd(0.82, 2.4).toFixed(2) + ',' +
          rnd(0.7, 3.2).toFixed(2) + ')';
      }
      if (t.spin && Math.random() < t.spin) {
        tf += ' rotate(' + rnd(-6, 6).toFixed(2) + 'deg)';
      }
      p.slab.style.transform = tf;
      p.slab.style.opacity = Math.random() < 0.16 ? rnd(0.4, 0.75) : 1;
      p.slab.style.filter = Math.random() < t.invert ?
        'invert(1) hue-rotate(180deg)' : 'none';

      // total dropout: the band loses its content entirely and comes
      // back as flat ink, flat stock or flat red. Displacement still
      // says "there is a document under here"; a dropout does not.
      var solid = t.solid && Math.random() < t.solid;
      p.slab.classList.toggle('gl-solid', !!solid);
      p.slab.style.background = solid ?
        DROPOUT[(Math.random() * DROPOUT.length) | 0] : '';
    }

    var dx = rnd(t.rgb[0], t.rgb[1]);
    if (offR) offR.setAttribute('dx', dx.toFixed(2));
    if (offB) {
      offB.setAttribute('dx', (-dx * rnd(0.5, 0.9)).toFixed(2));
      offB.setAttribute('dy', Math.random() < 0.3 ? '1' : '0');
    }

    if (t === TIERS.total) {
      var rs = document.documentElement.style;
      rs.setProperty('--gt-x', rnd(-26, 26).toFixed(1) + 'px');
      rs.setProperty('--gt-y', rnd(-14, 14).toFixed(1) + 'px');
      rs.setProperty('--gt-k', rnd(-1.8, 1.8).toFixed(2) + 'deg');
      rs.setProperty('--gt-s', rnd(0.985, 1.03).toFixed(3));
    }

    gl.querySelectorAll('.gl-mark').forEach(function (m) { m.remove(); });
    var nm = ri(t.marks[0], t.marks[1]);
    for (var j = 0; j < nm; j++) {
      var m = document.createElement('div');
      m.className = 'gl-mark';
      m.style.top = rnd(1, 97) + '%';
      m.style.left = rnd(0, 72) + '%';
      m.style.width = rnd(4, 46) + '%';
      m.style.height = rnd(2, t === TIERS.heavy || t === TIERS.total ?
        18 : 8) + 'px';
      gl.appendChild(m);
    }
  }

  function stop() {
    clearInterval(churnTimer);
    clearTimeout(endTimer);
    document.documentElement.classList.remove('gl-on', 'gl-scan', 'gl-hard',
      'gl-total');
    for (var i = 0; i < pool.length; i++) {
      pool[i].slab.style.display = 'none';
      pool[i].slab.classList.remove('gl-solid');
    }
    gl.querySelectorAll('.gl-mark').forEach(function (m) { m.remove(); });
  }

  function burst(tier, force) {
    if ((!running || dead) && !force) return;
    var t = TIERS[tier] || TIERS[roll()];
    if (dirty || !pool.length) build();
    align();
    stop();

    document.documentElement.classList.add('gl-on');
    if (Math.random() < t.scan) document.documentElement.classList.add('gl-scan');
    if (Math.random() < t.hard) document.documentElement.classList.add('gl-hard');
    if (t === TIERS.total) document.documentElement.classList.add('gl-total');

    lay(t);
    if (t.churn) {
      churnTimer = setInterval(function () { align(); lay(t); },
        ri(t.churn[0], t.churn[1]));
    }
    endTimer = setTimeout(stop, rnd(t.dur[0], t.dur[1]));
  }

  // ------------------------------------------------------------------
  // THE INTERRUPTION
  //
  // Bracketed by bursts on both sides rather than faded in and out: a
  // transmission does not cut cleanly to a slate, it comes apart first
  // and comes apart again on the way back. While it is up, nothing
  // tears — the slate holds still and drifts.
  // ------------------------------------------------------------------
  var slateBusy = false, slateOff = null;

  function interrupt(ms, final) {
    if (!slate || (slateBusy && !final)) return;
    slateBusy = true;
    burst('heavy', true);
    setTimeout(function () { burst('heavy', true); }, 90);
    setTimeout(function () {
      stop();
      document.documentElement.classList.add('slate-on');
      if (final) document.documentElement.classList.add('slate-final');
    }, 170);
    if (final) return;
    slateOff = setTimeout(function () {
      document.documentElement.classList.remove('slate-on');
      slateBusy = false;
      burst('heavy', true);
      setTimeout(function () { burst(roll(), true); }, 120);
    }, 170 + ms);
  }

  // ------------------------------------------------------------------
  // scheduling
  // ------------------------------------------------------------------
  function nextBurst() {
    clearTimeout(burstTimer);
    if (!running || dead) return;
    burstTimer = setTimeout(function () {
      // nothing tears behind the slate: the page is not on screen and
      // the work would be invisible
      if (!slateBusy) burst(roll());
      nextBurst();
    }, rnd(600, 4200));
  }

  function nextSlate() {
    clearTimeout(slateTimer);
    if (!running || dead) return;
    slateTimer = setTimeout(function () {
      // never interrupt a tab nobody is looking at — it would be sitting
      // there black when the reader came back to it
      if (!document.hidden) interrupt(rnd(1000, 8000), false);
      nextSlate();
    }, rnd(11000, 32000));
  }

  function terminal() {
    dead = true;
    clearTimeout(burstTimer);
    clearTimeout(slateTimer);
    clearTimeout(slateOff);
    interrupt(0, true);
  }

  // ------------------------------------------------------------------
  // state
  // ------------------------------------------------------------------
  function set(on) {
    running = on;
    if (btn) {
      btn.textContent = 'SIGNAL: ' + (on ? 'DEGRADED' : 'NOMINAL');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    try { localStorage.setItem('hv-signal', on ? '1' : '0'); } catch (e) {}
    clearTimeout(deadTimer);
    if (on) {
      nextBurst();
      nextSlate();
      deadTimer = setTimeout(terminal, WINDOW_MS);
    } else {
      dead = false;
      slateBusy = false;
      clearTimeout(burstTimer);
      clearTimeout(slateTimer);
      clearTimeout(slateOff);
      stop();
      document.documentElement.classList.remove('slate-on', 'slate-final');
    }
  }

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saved = null;
  try { saved = localStorage.getItem('hv-signal'); } catch (e) {}
  set(saved === null ? !reduce : saved === '1');

  if (btn) btn.addEventListener('click', function () { set(!running); });

  // a handle, so a burst or a slate can be fired deliberately rather
  // than waited for
  window.HV_SIGNAL = {
    burst: function (tier) { burst(tier || roll(), true); },
    slate: function (ms) { interrupt(ms || 4000, false); },
    end: terminal,
    set: set,
    on: function () { return running; },
    dead: function () { return dead; }
  };

  // the ghost is only as current as the page it was cloned from
  var rt;
  window.addEventListener('resize', function () {
    dirty = true;
    clearTimeout(rt);
    rt = setTimeout(align, 120);
  });
  window.addEventListener('scroll', function () {
    if (document.documentElement.classList.contains('gl-on')) align();
  }, { passive: true });

  var selEl = document.getElementById('sel');
  if (selEl) {
    selEl.addEventListener('change', function () {
      dirty = true;
      setTimeout(function () { burst('medium'); }, 40);
    });
  }
})();
