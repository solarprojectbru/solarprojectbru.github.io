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

document.getElementById('yr').textContent = new Date().getFullYear();

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

// ---------- Enquiry form ----------
// Not connected to a backend yet: validates, then shows a message.
const form = $('form');
form.addEventListener('submit', e => {
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
