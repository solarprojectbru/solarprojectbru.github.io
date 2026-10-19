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
  const card = $('.ex-card');
  const CARDS = {
    1: ['Free site survey', 'We check your roof, shading, wiring and 12 months of electricity bills.'],
    2: ['Design & quote', 'A system sized to your usage, with a clear price, expected output and payback.'],
    3: ['Approvals', 'We prepare the net-metering application and engineering drawings for the authorities.'],
    4: ['Installation', 'Usually 1–3 days for a home. Tidy cabling, safe roof work, full testing.'],
    5: ['Monitor & care', 'Watch your output live on your phone. We check and clean the system on a schedule.'],
  };

  let i = 0, playing = false, lang = 'ms', muted = !synth, timer = null, startedAt = 0, sceneMs = 0, raf = 0;

  // English narration in the liveliest voice the device offers (Edge "Natural" voices first)
  let voice = null;
  const VOICE_RANK = [/Aria.*Natural/i, /Jenny.*Natural/i, /Ava.*Natural/i, /Emma.*Natural/i, /Natural/i,
    /Google US English/i, /Google UK English Female/i, /Samantha/i, /Zira/i];
  const pickVoice = () => {
    if (!synth) return;
    const en = synth.getVoices().filter(v => /^en/i.test(v.lang));
    voice = null;
    for (const re of VOICE_RANK) { voice = en.find(v => re.test(v.name)); if (voice) break; }
    voice = voice || en[0] || null;
  };
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  const words = s => s.split(/\s+/).length;
  const durationFor = s => Math.max(5500, words(s.en) * 400 + 1500);

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
    // step card pops in from the side
    if (card) {
      const c = CARDS[s.step];
      card.classList.remove('show');
      if (c) {
        card.querySelector('.num').textContent = s.step;
        card.querySelector('h4').textContent = c[0];
        card.querySelector('p').textContent = c[1];
        void card.offsetWidth; card.classList.add('show');
      }
    }
    sub.textContent = s[lang];
    sub.classList.remove('pop'); void sub.offsetWidth; sub.classList.add('pop');
    stepLabel.textContent = s.step ? (lang === 'ms' ? `Langkah ${s.step} / 5` : `Step ${s.step} of 5`) : '';
    chapters.forEach((c, k) => { c.classList.toggle('done', k + 1 < (s.step || (s.key === 'outro' ? 6 : 0))); c.classList.toggle('on', k + 1 === s.step); });
  }

  function speak(text, onEnd) {
    if (muted || !synth) { onEnd && onEnd(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice ? voice.lang : 'en-US';
    if (voice) u.voice = voice;
    // brighter and a little quicker for a friendly, upbeat tone
    u.rate = 1.05; u.pitch = 1.15;
    u.onstart = () => duck(true);
    u.onend = () => { duck(false); onEnd && onEnd(); };
    u.onerror = u.onend;
    synth.speak(u);
  }

  // ---------- upbeat background music, generated live (no audio file needed) ----------
  let ac = null, master = null, musicTimer = null, nextTime = 0, step16 = 0, musicOn = true;
  const BPM = 116, S16 = 60 / BPM / 4, MUSIC_VOL = 0.11;
  const CHORDS = [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]];   // C - G - Am - F
  const MELODY = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 81, 79, 76, 74, 72];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let noiseBuf = null;
  function tone(freq, t, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, type, freq) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.02);
  }
  function beat(st, t) {
    const s = st % 16, chord = CHORDS[Math.floor(st / 16) % 4];
    if (s === 0 || s === 8) tone(mtof(chord[0] - 24), t, 0.55, 'sine', 0.55);          // bass
    if (s === 6 || s === 14) tone(mtof(chord[0] - 12), t, 0.2, 'sine', 0.3);
    if (s % 2 === 0) tone(mtof(chord[[0, 1, 2, 1, 0, 2, 1, 2][s / 2]] + 12), t, 0.28, 'triangle', 0.16);   // plucky arpeggio
    if (s % 4 === 0 && Math.floor(st / 64) % 2 === 1) tone(mtof(MELODY[(st / 4) % 16]), t, 0.35, 'square', 0.035); // bell melody every other phrase
    if (s % 4 === 2) noise(t, 0.05, 0.12, 'highpass', 7000);                               // hi-hat
    if (s === 4 || s === 12) noise(t, 0.14, 0.35, 'bandpass', 1600);                       // clap
  }
  function musicStart() {
    if (!musicOn || musicTimer) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = ac || new AC();
    if (ac.state === 'suspended') ac.resume();
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1; }
    master = ac.createGain(); master.gain.value = 0.0001; master.connect(ac.destination);
    master.gain.exponentialRampToValueAtTime(MUSIC_VOL, ac.currentTime + 0.8);
    nextTime = ac.currentTime + 0.1;
    musicTimer = setInterval(() => { while (nextTime < ac.currentTime + 0.15) { beat(step16, nextTime); nextTime += S16; step16++; } }, 25);
  }
  function musicStop() {
    if (!musicTimer) return;
    clearInterval(musicTimer); musicTimer = null;
    const m = master; m.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15);
    setTimeout(() => m.disconnect(), 800);
  }
  function duck(down) { if (master && ac) master.gain.setTargetAtTime(down ? MUSIC_VOL * 0.45 : MUSIC_VOL, ac.currentTime, 0.25); }

  function run() {
    clearTimeout(timer); cancelAnimationFrame(raf);
    const s = SCENES[i];
    sceneMs = durationFor(s); startedAt = performance.now();
    let spoken = muted, timed = false;
    const next = () => { if (spoken && timed && playing) { if (i === SCENES.length - 1) stop(true); else { show(i + 1); run(); } } };
    speak(s.en, () => { spoken = true; next(); });
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
    musicStart();
    run();
  }
  function stop(ended) {
    playing = false; root.classList.remove('playing'); playBtn.setAttribute('aria-label', 'Play');
    clearTimeout(timer); cancelAnimationFrame(raf); synth && synth.cancel();
    musicStop();
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
  const musicBtn = $('.ex-music');
  musicBtn && musicBtn.addEventListener('click', () => {
    musicOn = !musicOn; root.classList.toggle('nomusic', !musicOn);
    musicBtn.setAttribute('aria-label', musicOn ? 'Turn music off' : 'Turn music on');
    if (!musicOn) musicStop(); else if (playing) musicStart();
  });

  // pause when scrolled out of view
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting && playing) stop(); }), { threshold: 0.2 }).observe(root);
  }
  show(0);
})();
