/* Общая логика внутренних страниц: слайдеры, лайтбокс, появление блоков. */
(function () {
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el));

  /* Слайдер мастер-классов: только автопрокрутка, без управления */
  const ws = document.getElementById('ws-slider');
  if (ws) {
    const track = ws.querySelector('.ws-track');
    const slides = Array.from(track.children);
    let i = 0;
    const draw = () => { track.style.transform = `translateX(${-i * ws.clientWidth}px)`; };
    draw();
    setInterval(() => { i = (i + 1) % slides.length; draw(); }, 2000);
    window.addEventListener('resize', draw);
  }

  /* Слайдер Арт-Квартала: стрелки, точки, свайп, лайтбокс */
  const td = document.getElementById('td-slider');
  if (!td) return;
  const track = td.querySelector('.td-track');
  const slides = Array.from(track.children);
  const dotsWrap = td.querySelector('.td-dots');
  const AUTOPLAY_MS = 4000;
  let idx = 0, timer = null;

  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'td-dot';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', (dotsWrap.dataset.slideLabel || 'Slide') + ' ' + (i + 1));
    b.addEventListener('click', () => { go(i); restart(); });
    dotsWrap.appendChild(b);
  });
  const dots = Array.from(dotsWrap.children);

  function draw() {
    track.style.transform = `translateX(${-idx * td.clientWidth}px)`;
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === idx)));
  }
  function go(n) { idx = (n + slides.length) % slides.length; draw(); }
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);
  const start = () => { stop(); timer = setInterval(next, AUTOPLAY_MS); };
  const stop = () => { if (timer) clearInterval(timer); };
  const restart = () => { stop(); start(); };

  td.querySelector('.td-prev').addEventListener('click', () => { prev(); restart(); });
  td.querySelector('.td-next').addEventListener('click', () => { next(); restart(); });
  td.addEventListener('pointerdown', stop);
  td.addEventListener('pointerup', start);
  td.addEventListener('pointercancel', start);

  let startX = 0;
  td.addEventListener('touchstart', (e) => { startX = e.changedTouches[0].clientX; }, { passive: true });
  td.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); restart(); }
  }, { passive: true });

  draw();
  start();
  window.addEventListener('resize', draw);

  /* Лайтбокс */
  const lb = document.getElementById('lb');
  const lbImg = document.getElementById('lbImg');
  const links = Array.from(td.querySelectorAll('.td-photo a'));
  let lbIdx = 0, lastFocus = null;

  function open(i) {
    lbIdx = i;
    lastFocus = document.activeElement;
    lbImg.src = links[lbIdx].href;
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    stop();
    document.getElementById('lbClose').focus();
  }
  function close() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    start();
    lastFocus?.focus();
  }
  const lbGo = (n) => { lbIdx = (n + links.length) % links.length; lbImg.src = links[lbIdx].href; };

  links.forEach((link, i) => link.addEventListener('click', (e) => { e.preventDefault(); open(i); }));
  document.getElementById('lbClose').addEventListener('click', close);
  document.getElementById('lbPrev').addEventListener('click', () => lbGo(lbIdx - 1));
  document.getElementById('lbNext').addEventListener('click', () => lbGo(lbIdx + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  window.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') lbGo(lbIdx - 1);
    if (e.key === 'ArrowRight') lbGo(lbIdx + 1);
  });
})();
