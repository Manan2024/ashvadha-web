// ASHVADHA — site interactions
// Nav, reveals, hero parallax, Join grid, page particle fields.
// (The Saga 3D scene lives in js/saga-brain-v29.js, Beyond Visible in js/domain-v29.js.)

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Nav ----------
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  // Header: compact bar that slides away while scrolling down and returns on scroll up,
  // when the pointer touches the top edge, when the mobile menu is open, or on keyboard focus.
  let lastY = window.scrollY;
  const onScroll = () => {
    if (!nav) return;
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);
    const menuOpen = links && links.classList.contains('open');
    if (y < 80 || menuOpen) { nav.classList.remove('nav--hidden'); lastY = y; return; }
    if (Math.abs(y - lastY) < 6) return;
    nav.classList.toggle('nav--hidden', y > lastY);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', (e) => {
    if (nav && e.pointerType === 'mouse' && e.clientY < 10) nav.classList.remove('nav--hidden');
  }, { passive: true });
  onScroll();

  if (toggle && links) {
    const setOpen = (open) => {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('open')) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (links.classList.contains('open') && !nav.contains(e.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }

  // ---------- Active section in nav (home page) ----------
  const sections = [...document.querySelectorAll('section[id]')];
  const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  if (sections.length && sectionLinks.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        sectionLinks.forEach((link) => {
          const on = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('active', on);
          if (on) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-38% 0px -55% 0px', threshold: 0 });
    sections.forEach((section) => observer.observe(section));
  }

  // ---------- Team cards ----------
  const cards = document.querySelectorAll('.team-card');
  if (cards.length) {
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
      }, { threshold: 0.2 });
      cards.forEach((c) => obs.observe(c));
    } else {
      cards.forEach((c) => c.classList.add('visible'));
    }
  }

  // ---------- Motion-only extras ----------
  if (!reduceMotion) {
    const hero = document.querySelector('.hero');
    const heroImage = document.querySelector('.hero-img');
    if (hero && heroImage) {
      hero.addEventListener('pointermove', (event) => {
        const x = (event.clientX / window.innerWidth - .5) * 2;
        const y = (event.clientY / window.innerHeight - .5) * 2;
        heroImage.style.transform = `scale(1.03) translate(${x * -1.5}px, ${y * -1.2}px)`;
      });
      hero.addEventListener('pointerleave', () => { heroImage.style.transform = 'scale(1.02)'; });
    }

    document.querySelectorAll('.contact-item').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        card.style.transform = `perspective(900px) rotateX(${y * -3}deg) rotateY(${x * 3}deg) translateY(-5px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  // ---------- Join us: restrained 3D particle grid with cursor interaction ----------
  (function joinGrid() {
    const canvas = document.getElementById('joinGridCanvas');
    const section = document.getElementById('join');
    if (!canvas || !section) return;
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, dpr = 1, time = 0, raf = 0;
    const pointer = { x: .5, y: .45, active: false };
    const points = [];
    const cols = 22, rows = 11;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth = section.clientWidth;
      height = canvas.clientHeight = section.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      points.length = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) points.push({ x, y });
      if (!raf) draw(); // keep the still frame correct after a resize while paused
    }

    function draw() {
      time += .008;
      ctx.clearRect(0, 0, width, height);
      const gapX = width / (cols - 1), gapY = height / (rows - 1);
      const cursorX = pointer.x * width, cursorY = pointer.y * height;
      const projected = points.map((p) => {
        const baseX = p.x * gapX, baseY = p.y * gapY;
        const dx = baseX - cursorX, dy = baseY - cursorY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = pointer.active ? Math.max(0, 1 - distance / 260) : 0;
        const wave = reduceMotion ? 0 : Math.sin(time * 2 + p.x * .32 + p.y * .25) * 4;
        return { x: baseX + dx * influence * .045, y: baseY + wave + dy * influence * .045 - influence * 18, influence };
      });
      ctx.lineWidth = .7;
      for (let y = 0; y < rows; y++) {
        ctx.beginPath();
        for (let x = 0; x < cols; x++) { const p = projected[y * cols + x]; x === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
        ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
      }
      for (let x = 0; x < cols; x++) {
        ctx.beginPath();
        for (let y = 0; y < rows; y++) { const p = projected[y * cols + x]; y === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
        ctx.strokeStyle = 'rgba(0,0,0,.52)'; ctx.stroke();
      }
      projected.forEach((p) => { ctx.beginPath(); ctx.fillStyle = `rgba(0,0,0,${.48 + p.influence * .35})`; ctx.arc(p.x, p.y, 1.2 + p.influence * 1.1, 0, Math.PI * 2); ctx.fill(); });
    }

    // Only animate while the section is on screen — the page already runs two WebGL scenes above it.
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    const start = () => { if (!raf && !reduceMotion) raf = requestAnimationFrame(loop); };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    section.addEventListener('pointermove', (event) => {
      const rect = section.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width;
      pointer.y = (event.clientY - rect.top) / rect.height;
      pointer.active = true;
      if (reduceMotion) draw();
    });
    section.addEventListener('pointerleave', () => { pointer.active = false; if (reduceMotion) draw(); });
    window.addEventListener('resize', resize);
    resize();
    draw();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { entries[0].isIntersecting ? start() : stop(); }).observe(section);
    } else {
      start();
    }
  })();

  // ---------- Team and Journal: quiet side particle fields ----------
  document.querySelectorAll('.page-particle-surface').forEach((surface) => {
    const canvas = surface.querySelector('.page-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const particles = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), r: .5 + Math.random() * 1.4, s: .0008 + Math.random() * .0018, p: Math.random() * Math.PI * 2 }));
    const pointer = { x: .5, y: .5, active: false };
    let w = 0, h = 0, dpr = 1, t = 0;
    const resize = () => { dpr = Math.min(devicePixelRatio || 1, 2); w = canvas.clientWidth = surface.clientWidth; h = canvas.clientHeight = surface.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const draw = () => {
      t += 1; ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.y -= reduceMotion ? 0 : p.s; if (p.y < -.02) p.y = 1.02;
        const x = p.x * w + (pointer.active ? (p.x - pointer.x) * -18 : 0);
        const y = p.y * h + (pointer.active ? (p.y - pointer.y) * -12 : 0) + (reduceMotion ? 0 : Math.sin(t * .008 + p.p) * 5);
        ctx.beginPath(); ctx.fillStyle = `rgba(116,212,220,${.12 + (pointer.active ? .1 : 0)})`; ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      if (!reduceMotion) requestAnimationFrame(draw);
    };
    surface.addEventListener('pointermove', (e) => { const r = surface.getBoundingClientRect(); pointer.x = (e.clientX - r.left) / r.width; pointer.y = (e.clientY - r.top) / r.height; pointer.active = true; });
    surface.addEventListener('pointerleave', () => { pointer.active = false; });
    window.addEventListener('resize', resize); resize(); draw();
  });
});

// ---------- Boot-veil failsafe ----------
// The 3D module is deferred, so by the `load` event it has either started
// (html[data-saga="ready"]) or failed. If it failed, drop the veil and show the static SAGA title.
window.addEventListener('load', () => {
  setTimeout(() => {
    const root = document.documentElement;
    if (document.getElementById('boot') && root.dataset.saga !== 'ready') root.classList.add('saga-failed');
  }, 0);
});
