// Animated 5-step explainer with spoken narration (browser speech) and BM/EN subtitles.
(() => {
  const root = document.getElementById('explainer');
  if (!root) return;

  const SCENES = [
    { key: 'intro', ms: 'Bagaimana sistem solar dipasang di rumah anda, dalam lima langkah mudah.',
      en: 'How solar gets installed on your home, in five simple steps.' },
    { key: 's1', step: 1, ms: 'Langkah satu: tinjauan tapak percuma. Kami memeriksa bumbung, teduhan, pendawaian dan bil elektrik anda selama dua belas bulan.',
      en: 'Step one: a free site survey. We check your roof, shading, wiring and twelve months of electricity bills.' },
    { key: 's2', step: 2, ms: 'Langkah dua: reka bentuk dan sebut harga. Sistem disaiz mengikut penggunaan anda, dengan harga yang jelas, anggaran pengeluaran dan tempoh pulangan modal.',
      en: 'Step two: design and quote. A system sized to your usage, with a clear price, expected output and payback.' },
    { key: 's3', step: 3, ms: 'Langkah tiga: kelulusan. Kami menyediakan permohonan net-metering dan lukisan kejuruteraan untuk pihak berkuasa.',
      en: 'Step three: approvals. We prepare the net-metering application and engineering drawings for the authorities.' },
    { key: 's4', step: 4, ms: 'Langkah empat: pemasangan. Biasanya satu hingga tiga hari untuk sebuah rumah, dengan pendawaian yang kemas, kerja bumbung yang selamat dan ujian penuh.',
      en: 'Step four: installation. Usually one to three days for a home, with tidy cabling, safe roof work and full testing.' },
    { key: 's5', step: 5, ms: 'Langkah lima: pemantauan dan penjagaan. Pantau tenaga solar anda secara langsung di telefon. Kami memeriksa dan membersihkan sistem mengikut jadual.',
      en: 'Step five: monitor and care. Watch your solar output live on your phone. We check and clean the system on a schedule.' },
    { key: 'outro', ms: 'Sedia untuk bermula? Hubungi pasukan kami untuk tinjauan tapak percuma.',
      en: 'Ready to start? Talk to our team for a free site survey.' },
  ];

  const $ = sel => root.querySelector(sel);
  const stage = $('.ex-stage'), sub = $('.ex-sub'), playBtn = $('.ex-play'), bigPlay = $('.ex-bigplay');
  const chapters = [...root.querySelectorAll('.ex-chapters button')];
  const langBtn = $('.ex-lang'), muteBtn = $('.ex-mute'), stepLabel = $('.ex-step');
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;

  let i = 0, playing = false, lang = 'ms', muted = !synth, timer = null, startedAt = 0, sceneMs = 0, raf = 0;

  // pick a Malay voice if the device has one; Indonesian is the closest fallback
  let voice = null;
  const pickVoice = () => {
    if (!synth) return;
    const vs = synth.getVoices();
    voice = vs.find(v => /^ms/i.test(v.lang)) || vs.find(v => /^id/i.test(v.lang)) || null;
  };
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  const words = s => s.split(/\s+/).length;
  const durationFor = s => Math.max(6000, words(s[lang]) * 430 + 1600);

  function show(n) {
    i = (n + SCENES.length) % SCENES.length;
    const s = SCENES[i];
    stage.dataset.scene = s.key;
    // restart CSS animations for the active scene
    stage.querySelectorAll('.scene').forEach(el => {
      const on = el.dataset.key === s.key;
      el.classList.toggle('on', false);
      if (on) { void el.getBoundingClientRect(); el.classList.add('on'); }
    });
    sub.textContent = s[lang];
    sub.classList.remove('pop'); void sub.offsetWidth; sub.classList.add('pop');
    stepLabel.textContent = s.step ? (lang === 'ms' ? `Langkah ${s.step} / 5` : `Step ${s.step} of 5`) : '';
    chapters.forEach((c, k) => { c.classList.toggle('done', k + 1 < (s.step || (s.key === 'outro' ? 6 : 0))); c.classList.toggle('on', k + 1 === s.step); });
  }

  function speak(text, onEnd) {
    if (muted || !synth) { onEnd && onEnd(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ms' ? (voice ? voice.lang : 'ms-MY') : 'en-GB';
    if (lang === 'ms' && voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = onEnd; u.onerror = onEnd;
    synth.speak(u);
  }

  function run() {
    clearTimeout(timer); cancelAnimationFrame(raf);
    const s = SCENES[i];
    sceneMs = durationFor(s); startedAt = performance.now();
    let spoken = muted, timed = false;
    const next = () => { if (spoken && timed && playing) { if (i === SCENES.length - 1) stop(true); else { show(i + 1); run(); } } };
    speak(s[lang], () => { spoken = true; next(); });
    timer = setTimeout(() => { timed = true; next(); }, sceneMs);
    const tick = () => {
      const p = Math.min(1, (performance.now() - startedAt) / sceneMs);
      const c = chapters[(s.step || 1) - 1];
      if (s.step && c) c.style.setProperty('--p', p);
      if (playing) raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function play() {
    playing = true; root.classList.add('playing'); playBtn.setAttribute('aria-label', 'Pause');
    if (i === SCENES.length - 1) show(0);
    run();
  }
  function stop(ended) {
    playing = false; root.classList.remove('playing'); playBtn.setAttribute('aria-label', 'Play');
    clearTimeout(timer); cancelAnimationFrame(raf); synth && synth.cancel();
    if (ended) root.classList.add('ended');
  }

  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  bigPlay.addEventListener('click', () => { root.classList.add('started'); root.classList.remove('ended'); play(); });
  $('.ex-prev').addEventListener('click', () => { show(i - 1); if (playing) run(); });
  $('.ex-next').addEventListener('click', () => { show(i + 1); if (playing) run(); });
  chapters.forEach((c, k) => c.addEventListener('click', () => { root.classList.add('started'); show(k + 1); if (!playing) play(); else run(); }));
  langBtn.addEventListener('click', () => {
    lang = lang === 'ms' ? 'en' : 'ms';
    langBtn.textContent = lang === 'ms' ? 'BM' : 'EN';
    langBtn.setAttribute('aria-label', lang === 'ms' ? 'Subtitles: Bahasa Melayu (switch to English)' : 'Subtitles: English (switch to Bahasa Melayu)');
    show(i); if (playing) run();
  });
  muteBtn.addEventListener('click', () => {
    if (!synth) return;
    muted = !muted; root.classList.toggle('muted', muted);
    muteBtn.setAttribute('aria-label', muted ? 'Turn voice on' : 'Turn voice off');
    if (muted) synth.cancel(); else if (playing) run();
  });
  if (!synth) { root.classList.add('muted', 'novoice'); }

  // pause when scrolled out of view
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting && playing) stop(); }), { threshold: 0.2 }).observe(root);
  }
  show(0);
})();
