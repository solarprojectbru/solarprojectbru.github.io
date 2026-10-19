// Mobile menu
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', open);
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  burger.setAttribute('aria-expanded', false);
}));

const yr = document.getElementById('yr');
if (yr) yr.textContent = new Date().getFullYear();

// ---------- Savings estimator ----------
// Planning assumptions; check against the latest DES tariff schedule.
const YIELD = 1350;          // kWh per kWp per year
const SELF_USE = 0.7;        // share of solar used on site
const PRICE = { home: 1.10, biz: 1.00 };  // B$ per Wp installed
const CO2 = 0.6;             // kg CO2 per kWh of gas-fired grid power (estimate)
const HOME_BANDS = [[600, 0.01], [2000, 0.08], [4000, 0.10], [Infinity, 0.12]];

const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('en', { maximumFractionDigits: 0 });
const money = n => 'B$' + n.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
let mode = 'home';

function homeBill(kwh) {
  let bill = 0, prev = 0;
  for (const [cap, rate] of HOME_BANDS) {
    if (kwh <= prev) break;
    bill += (Math.min(kwh, cap) - prev) * rate;
    prev = cap;
  }
  return bill;
}

function calc() {
  const use = +$('use').value;
  const size = +$('size').value;
  const rate = Math.max(0.01, +$('rate').value || 0.15);
  $('useOut').textContent = fmt(use) + ' kWh';
  $('sizeOut').textContent = size + ' kWp';

  const prod = size * YIELD / 12;                 // kWh per month
  const offset = Math.min(use, prod * SELF_USE);  // grid kWh avoided
  const bill = mode === 'home' ? homeBill(use) : use * rate;
  const newBill = mode === 'home' ? homeBill(use - offset) : (use - offset) * rate;
  const save = bill - newBill;
  const cost = size * 1000 * PRICE[mode];
  const pay = save > 0 ? cost / (save * 12) : Infinity;

  $('rProd').textContent = fmt(prod) + ' kWh / month';
  $('rBill').textContent = money(bill) + ' / month';
  $('rNew').textContent = money(newBill) + ' / month';
  $('rSave').textContent = money(save);
  $('rSaveYr').textContent = 'per month · ' + money(save * 12) + ' a year';
  $('rCost').textContent = money(cost);
  $('rPay').textContent = isFinite(pay) && pay < 40 ? pay.toFixed(1) + ' years' : 'Not recommended';
  $('rCo2').textContent = (offset * 12 * CO2 / 1000).toFixed(1) + ' tonnes';
}

if ($('use')) {
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.seg button').forEach(x => {
    x.classList.toggle('on', x === b);
    x.setAttribute('aria-selected', x === b);
  });
  mode = b.dataset.mode;
  $('rateField').hidden = mode !== 'biz';
  if (mode === 'biz') { $('use').value = 8000; $('size').value = 40; }
  else { $('use').value = 2500; $('size').value = 8; }
  calc();
}));
['use', 'size', 'rate'].forEach(id => $(id).addEventListener('input', calc));
calc();
}

// ---------- Enquiry form ----------
// Not connected to a backend yet: validates, then shows a message.
const form = $('form');
if (form) form.addEventListener('submit', e => {
  e.preventDefault();
  let ok = true;
  form.querySelectorAll('[required]').forEach(f => {
    const bad = !f.value.trim();
    f.classList.toggle('invalid', bad);
    if (bad) ok = false;
  });
  const note = $('formNote');
  note.hidden = false;
  note.textContent = ok
    ? 'Thank you. Online enquiries are not connected yet — please email solar.project.bru@gmail.com with these details and we will reply within two working days.'
    : 'Please add your name and phone number.';
});

// ---------- Front-page slider ----------
const slider = document.querySelector('.slider');
if (slider) {
  const track = slider.querySelector('.slides');
  const slides = [...track.children];
  const dots = slider.querySelectorAll('.dots button');
  const count = slider.querySelector('.count b');
  let i = 0;
  const go = n => {
    i = (n + slides.length) % slides.length;
    track.style.transform = `translateX(${-i * 100}%)`;
    slides.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', k !== i); s.querySelectorAll('a').forEach(a => a.tabIndex = k === i ? 0 : -1); });
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    if (count) count.textContent = String(i + 1).padStart(2, '0');
  };
  slider.querySelector('.next')?.addEventListener('click', () => go(i + 1));
  // home page: only the logo shows at first; the first click reveals the menu with an animation
  const body = document.body;
  const reveal = () => body.classList.add('menu-open');
  const logo = document.querySelector('.site-header .brand');
  logo?.addEventListener('click', e => { if (!body.classList.contains('menu-open')) { e.preventDefault(); reveal(); } });
  // clicking the picture reveals the menu first, then moves to the next slide on later clicks
  track.addEventListener('click', e => {
    if (e.target.closest('a, button')) return;
    if (!body.classList.contains('menu-open')) { reveal(); return; }
    go(i + 1); restart();
  });
  // slides advance automatically
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = null;
  const restart = () => { if (reduce) return; clearInterval(timer); timer = setInterval(() => go(i + 1), 5000); };
  restart();
  slider.querySelector('.prev')?.addEventListener('click', () => go(i - 1));
  dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
  slider.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); });
  let x0 = null;
  track.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { go(i + (dx < 0 ? 1 : -1)); restart(); }
  });
  go(0);
}

// ---------- Why page: animate the fact diagrams when they scroll into view ----------
const facts = document.querySelector('.facts');
if (facts) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { facts.classList.add('in'); io.disconnect(); } }), { threshold: 0.3 });
    io.observe(facts);
  } else facts.classList.add('in');
}

// ---------- photo strip: tap to flip a card on touch screens ----------
document.querySelectorAll('.reel-item').forEach(card => card.addEventListener('click', e => {
  if (matchMedia('(hover: hover)').matches) return;          // mouse users flip on hover and click through
  if (!card.classList.contains('flipped')) {                  // first tap flips, second tap follows the link
    e.preventDefault();
    document.querySelectorAll('.reel-item.flipped').forEach(c => c.classList.remove('flipped'));
    card.classList.add('flipped');
  }
}));

// ---------- Why page: link cards rise in when scrolled into view ----------
const pgrid = document.querySelector('.person-grid');
if (pgrid) {
  if ('IntersectionObserver' in window) {
    const io2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { pgrid.classList.add('in'); io2.disconnect(); } }), { threshold: 0.2 });
    io2.observe(pgrid);
  } else pgrid.classList.add('in');
}
