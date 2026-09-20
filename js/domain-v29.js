/* SEE YOU DOWN THERE
   Black stage after SAGA. On scroll the line fades in, then the build rail.
   Classic script (no modules), no dependencies. */
(function () {
  'use strict';

  var section = document.getElementById('beyond');
  if (!section) return;
  section.classList.remove('no-js');

  var track     = section.querySelector('.dx-track');
  var stage     = section.querySelector('.dx-stage');
  var finalEl   = section.querySelector('.dx-final');
  var leadEl    = section.querySelector('.dx-lead');
  var finalLn   = section.querySelector('.dx-final__line');
  var buildEl   = section.querySelector('.dx-build');
  var buildRail = section.querySelector('.dx-build__rail');
  var dust      = section.querySelector('.dx-dust');
  if (!track || !stage || !finalEl || !finalLn || !buildEl || !buildRail) return;

  /* Scroll bands (0..1 across the pinned stage)
     Lead-in almost immediately, then amber line, then rail. */
  var LEAD  = [0.02, 0.14];   /* framing lines appear almost immediately */
  var FINAL = [0.18, 0.36];   /* "See you down there." */
  var BUILD = [0.28, 0.48];   /* rail follows the final line */
  var PART  = [0.08, 0.48];   /* faint dust after lead-in */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function band(p, a, b) { return clamp((p - a) / ((b - a) || 1e-6), 0, 1); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function eOutC(t) { return 1 - Math.pow(1 - t, 3); }

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqSmall  = window.matchMedia('(max-width: 760px)');

  /* Build rail: hairline segments */
  var SEG_COUNT = mqSmall.matches ? 34 : 52;
  var segEls = [];
  (function () {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < SEG_COUNT; i++) {
      var s = document.createElement('i');
      frag.appendChild(s);
      segEls.push(s);
    }
    buildRail.appendChild(frag);
  }());

  /* Two light peaks at different speeds, wrapping around the rail. */
  function paintBuild(t) {
    var h1 = (t * 0.20) % 1;
    var h2 = (t * 0.135 + 0.47) % 1;

    for (var i = 0; i < segEls.length; i++) {
      var x = i / (segEls.length - 1);

      var d1 = Math.abs(x - h1); if (d1 > 0.5) d1 = 1 - d1;
      var d2 = Math.abs(x - h2); if (d2 > 0.5) d2 = 1 - d2;

      var v1 = Math.exp(-d1 * d1 * 320);
      var v2 = Math.exp(-d2 * d2 * 480) * 0.55;
      var v  = Math.min(1, v1 + v2);

      segEls[i].style.opacity = (0.06 + v * 0.90).toFixed(3);
      segEls[i].style.boxShadow = v > 0.35
        ? '0 0 ' + (4 + v * 8).toFixed(1) + 'px rgba(255, 154, 51, ' + (v * 0.55).toFixed(2) + ')'
        : 'none';
    }
  }

  /* Dust: a few dozen tiny motes drifting upward. Kept deliberately faint:
     the line and rail stay the subject. Tune COUNT / alpha (a) below. */
  var dctx = dust && dust.getContext ? dust.getContext('2d') : null;
  if (dust && !dctx) dust.style.display = 'none';
  var motes = [], dW = 0, dH = 0;

  function seedMotes() {
    var n = mqSmall.matches ? 30 : 56;
    motes.length = 0;
    for (var i = 0; i < n; i++) {
      var depth = Math.random();                  /* 0 far .. 1 near */
      motes.push({
        nx: Math.random(),
        py: Math.random() * (dH || 800),
        depth: depth,
        r: 0.5 + depth * 0.9,                     /* radius px */
        vy: 3 + depth * 9,                        /* drift px/s */
        sway: 4 + Math.random() * 10,
        freq: 0.15 + Math.random() * 0.25,
        ph: Math.random() * 6.283,
        a: 0.10 + depth * 0.20,                   /* peak opacity */
        tw: 0.4 + Math.random() * 0.8,
        warm: Math.random() < 0.12                /* a few amber motes */
      });
    }
  }

  function sizeDust() {
    if (!dctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, mqSmall.matches ? 1.5 : 2);
    var w = stage.clientWidth || window.innerWidth;
    var h = stage.clientHeight || window.innerHeight;
    if (dH) { var k = h / dH; for (var i = 0; i < motes.length; i++) motes[i].py *= k; }
    dW = w; dH = h;
    dust.width  = Math.max(1, Math.round(w * dpr));
    dust.height = Math.max(1, Math.round(h * dpr));
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function paintDust(p, time, dt) {
    if (!dctx) return;
    var vis = smooth(band(p, PART[0], PART[1]));
    dust.style.opacity = vis.toFixed(3);
    if (vis < 0.003) return;
    dctx.clearRect(0, 0, dW, dH);
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.py -= m.vy * dt;
      if (m.py < -12) { m.py = dH + 12; m.nx = Math.random(); }
      var x = m.nx * dW + Math.sin(time * m.freq + m.ph) * m.sway;
      var y = m.py + (p - 0.5) * 70 * m.depth;    /* slight depth parallax on scroll */
      var edge = clamp(y / (dH * 0.18), 0, 1) * clamp((dH - y) / (dH * 0.18), 0, 1);
      var a = m.a * (0.65 + 0.35 * Math.sin(time * m.tw + m.ph * 3)) * edge;
      if (a < 0.004) continue;
      var rgb = m.warm ? '255,154,51' : '150,180,230';
      dctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.16).toFixed(3) + ')';
      dctx.beginPath(); dctx.arc(x, y, m.r * 3.2, 0, 6.2832); dctx.fill();
      dctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
      dctx.beginPath(); dctx.arc(x, y, m.r, 0, 6.2832); dctx.fill();
    }
  }

  /* Reduced motion: static layout, rail drawn once, no dust. */
  if (mqReduce.matches) {
    section.classList.add('is-static');
    if (dust) dust.style.display = 'none';
    paintBuild(0.3);
    return;
  }

  /* Scroll geometry */
  var trackTop = 0, trackRange = 1;
  var target = 0, current = 0;

  function measure() {
    var r = track.getBoundingClientRect();
    trackTop = r.top + window.scrollY;
    trackRange = Math.max(1, track.offsetHeight - stage.offsetHeight);
  }
  function readScroll() {
    var y = window.scrollY || window.pageYOffset || 0;
    target = clamp((y - trackTop) / trackRange, 0, 1);
  }

  function paint(p, time, dt) {
    /* Container stays visible once lead starts so children can stagger */
    var la = band(p, LEAD[0], LEAD[1]);
    var fa = band(p, FINAL[0], FINAL[1]);
    var container = Math.max(la, fa);
    var ce = eOutC(container);
    finalEl.style.opacity = smooth(container).toFixed(3);
    finalEl.style.transform = 'translate3d(0,' + ((1 - ce) * 18).toFixed(2) + 'px,0)';

    if (leadEl) {
      var le = eOutC(la);
      leadEl.style.opacity = smooth(la).toFixed(3);
      leadEl.style.transform = 'translate3d(0,' + ((1 - le) * 14).toFixed(2) + 'px,0)';
    }

    var fe = eOutC(fa);
    finalLn.style.opacity = smooth(fa).toFixed(3);
    finalLn.style.transform = 'translate3d(0,' + ((1 - fe) * 12).toFixed(2) + 'px,0) rotateX(' + ((1 - fe) * 12).toFixed(2) + 'deg)';

    var ba = band(p, BUILD[0], BUILD[1]);
    buildEl.style.opacity = smooth(ba).toFixed(3);
    if (ba > 0.001) paintBuild(time);

    paintDust(p, time, dt || 0);
  }

  /* Loop runs only while the section is on screen */
  var rafId = 0, running = false, last = 0;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    var k = 1 - Math.pow(0.0016, dt);
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.0003) current = target;
    paint(current, now / 1000, dt);
  }
  function start() { if (running) return; running = true; last = 0; rafId = requestAnimationFrame(frame); }
  function stop()  { if (!running) return; running = false; cancelAnimationFrame(rafId); rafId = 0; }

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { measure(); readScroll(); sizeDust(); }, 140);
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) start(); else stop();
    }).observe(track);
  } else {
    start();
  }

  function boot() {
    measure();
    readScroll();
    current = target;
    sizeDust();
    if (!motes.length) seedMotes();
    paint(current, 0, 0);
  }
  boot();
  if (document.readyState !== 'complete') window.addEventListener('load', boot, { once: true });
}());
