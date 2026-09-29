// ---------- shared helpers ----------
const $ = id => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n, d = 0) => 'B$' + fmt(n, d);
const css = v => getComputedStyle(document.body).getPropertyValue(v).trim();
const SVGNS = 'http://www.w3.org/2000/svg';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Brunei residential tariff bands (check against the latest DES schedule)
const BANDS = [[600, 0.01], [2000, 0.08], [4000, 0.10], [Infinity, 0.12]];
function homeBill(kwh) {
  let bill = 0, prev = 0;
  for (const [cap, rate] of BANDS) {
    if (kwh <= prev) break;
    bill += (Math.min(kwh, cap) - prev) * rate;
    prev = cap;
  }
  return bill;
}
const marginalRate = kwh => BANDS.find(([cap]) => kwh <= cap)[1];
const CO2 = 0.6;          // kg CO2 per grid kWh (estimate)
const SELF_USE = 0.72;    // share of solar used at home
const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function h(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

// Tooltip (values lead, labels follow; built with textContent)
const tip = $('tip');
function showTip(evt, title, rows) {
  tip.replaceChildren(h('div', title, 't-title'));
  rows.forEach(r => {
    const row = h('div', undefined, 't-row');
    const key = h('i'); key.style.background = r.color || 'transparent';
    row.append(key, h('span', r.label), h('strong', r.value));
    tip.appendChild(row);
  });
  tip.hidden = false;
  const x = evt.clientX ?? evt.target.getBoundingClientRect().right;
  const y = evt.clientY ?? evt.target.getBoundingClientRect().top;
  const w = tip.offsetWidth, ht = tip.offsetHeight;
  tip.style.left = Math.min(x + 14, innerWidth - w - 8) + 'px';
  tip.style.top = Math.max(8, y - ht - 12) + 'px';
}
const hideTip = () => { tip.hidden = true; };

function table(container, head, rows) {
  const wrap = h('div', undefined, 'dtable-wrap');
  const t = h('table', undefined, 'dtable');
  const tr = h('tr'); head.forEach(c => tr.appendChild(h('th', c)));
  t.appendChild(h('thead')).appendChild(tr);
  const tb = h('tbody');
  rows.forEach(r => {
    const row = h('tr');
    r.forEach(c => c instanceof Node ? row.appendChild(h('td')).appendChild(c) : row.appendChild(h('td', c)));
    tb.appendChild(row);
  });
  t.appendChild(tb); wrap.appendChild(t);
  container.replaceChildren(wrap);
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// ---------- charts ----------
// Line chart with crosshair + one tooltip listing every series
function lineChart(box, labels, series, unit, height = 240) {
  const W = Math.max(box.clientWidth, 280), H = height, m = { t: 10, r: 12, b: 26, l: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = niceMax(Math.max(...series.flatMap(s => s.values)));
  const x = i => m.l + (i / (labels.length - 1)) * iw;
  const y = v => m.t + ih - (v / max) * ih;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': series.map(s => s.name).join(' and ') + ' by hour' });
  for (let k = 0; k <= 4; k++) {
    const v = max * k / 4;
    el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: css('--grid-line') }, svg);
    el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = fmt(v, v % 1 ? 1 : 0);
  }
  const step = W < 520 ? 6 : 3;
  labels.forEach((l, i) => { if (i % step === 0) el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, svg).textContent = l; });
  series.forEach(s => {
    const pts = s.values.map((v, i) => `${x(i)},${y(v)}`);
    if (s.area) el('path', { d: `M${x(0)},${y(0)} L${pts.join(' L')} L${x(labels.length - 1)},${y(0)} Z`, fill: s.color, opacity: .1 }, svg);
    el('polyline', { points: pts.join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  });
  const cross = el('line', { y1: m.t, y2: m.t + ih, stroke: css('--muted'), 'stroke-width': 1, opacity: 0 }, svg);
  const dots = series.map(s => el('circle', { r: 4, fill: s.color, stroke: '#fff', 'stroke-width': 2, opacity: 0 }, svg));
  const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, class: 'hit', tabindex: 0, 'aria-label': 'Hover or use arrow keys to read values' }, svg);
  let cur = -1;
  const show = (i, evt) => {
    cur = i;
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', .5);
    dots.forEach((d, k) => { d.setAttribute('cx', x(i)); d.setAttribute('cy', y(series[k].values[i])); d.setAttribute('opacity', 1); });
    showTip(evt, labels[i], series.map(s => ({ color: s.color, label: s.name, value: fmt(s.values[i], 1) + ' ' + unit })));
  };
  const hide = () => { cross.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); hideTip(); };
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
    show(Math.max(0, Math.min(labels.length - 1, Math.round((px - m.l) / iw * (labels.length - 1)))), e);
  });
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('blur', hide);
  hit.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = Math.max(0, Math.min(labels.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)));
    const r = svg.getBoundingClientRect();
    show(i, { clientX: r.left + x(i) * r.width / W, clientY: r.top + m.t * r.height / H + 40 });
  });
  box.replaceChildren(svg);
}

// Stacked column chart: 4px rounded top on the stack, 2px surface gap between segments
function columnChart(box, labels, stacks, unit, extra = () => [], height = 260) {
  const W = Math.max(box.clientWidth, 280), H = height, m = { t: 22, r: 8, b: 26, l: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const totals = labels.map((_, i) => stacks.reduce((a, s) => a + s.values[i], 0));
  const max = niceMax(Math.max(...totals));
  const band = iw / labels.length, bw = Math.min(24, band * .6);
  const y = v => m.t + ih - (v / max) * ih;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': stacks.map(s => s.name).join(' and ') + ' by month' });
  for (let k = 0; k <= 4; k++) {
    const v = max * k / 4;
    el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: css('--grid-line') }, svg);
    el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = fmt(v);
  }
  const maxI = totals.indexOf(Math.max(...totals));
  labels.forEach((l, i) => {
    const cx = m.l + band * i + band / 2, x0 = cx - bw / 2;
    const g = el('g', { class: 'bar-g', tabindex: 0, role: 'img', 'aria-label': `${l}: ${fmt(totals[i])} ${unit}` }, svg);
    let base = 0;
    stacks.forEach((s, k) => {
      const v = s.values[i], top = base + v;
      const y1 = y(top), y0 = y(base) - (k > 0 ? 2 : 0);   // 2px gap under upper segments
      const hgt = Math.max(0, y0 - y1);
      if (k === stacks.length - 1) {
        const r = Math.min(4, hgt);
        el('path', { class: 'mark', fill: s.color, d: `M${x0},${y0} V${y1 + r} Q${x0},${y1} ${x0 + r},${y1} H${x0 + bw - r} Q${x0 + bw},${y1} ${x0 + bw},${y1 + r} V${y0} Z` }, g);
      } else {
        el('rect', { class: 'mark', x: x0, y: y1, width: bw, height: hgt, fill: s.color }, g);
      }
      base = top;
    });
    el('rect', { class: 'hit', x: m.l + band * i, y: m.t, width: band, height: ih }, g);
    el('text', { x: cx, y: H - 6, 'text-anchor': 'middle' }, svg).textContent = l;
    if (i === maxI || i === labels.length - 1) el('text', { class: 'val', x: cx, y: y(totals[i]) - 7, 'text-anchor': 'middle' }, svg).textContent = fmt(totals[i]);
    const tipRows = () => [...stacks.slice().reverse().map(s => ({ color: s.color, label: s.name, value: fmt(s.values[i]) + ' ' + unit })), ...extra(i)];
    g.addEventListener('pointermove', e => showTip(e, l, tipRows()));
    g.addEventListener('pointerleave', hideTip);
    g.addEventListener('focus', e => showTip(e, l, tipRows()));
    g.addEventListener('blur', hideTip);
  });
  box.replaceChildren(svg);
}

// Horizontal bars, single series, value at the tip
function hbarChart(box, items, color, unit) {
  const W = Math.max(box.clientWidth, 280), row = 34, labelW = 150, m = { t: 4, r: 70 };
  const H = items.length * row + m.t;
  const max = Math.max(...items.map(d => d.v));
  const iw = W - labelW - m.r;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Estimated energy use by appliance group' });
  items.forEach((d, i) => {
    const yy = m.t + i * row, bh = 18, bw = Math.max(2, d.v / max * iw), yb = yy + (row - bh) / 2;
    const g = el('g', { class: 'bar-g', tabindex: 0, role: 'img', 'aria-label': `${d.name}: ${fmt(d.v)} ${unit}` }, svg);
    el('text', { x: 0, y: yb + 13 }, g).textContent = d.name;
    const r = Math.min(4, bw);
    el('path', { class: 'mark', fill: color, d: `M${labelW},${yb} H${labelW + bw - r} Q${labelW + bw},${yb} ${labelW + bw},${yb + r} V${yb + bh - r} Q${labelW + bw},${yb + bh} ${labelW + bw - r},${yb + bh} H${labelW} Z` }, g);
    el('text', { class: 'val', x: labelW + bw + 8, y: yb + 13 }, g).textContent = d.pct + '%';
    el('rect', { class: 'hit', x: 0, y: yy, width: W, height: row }, g);
    const rows = () => [{ color, label: d.name, value: fmt(d.v) + ' ' + unit }, { label: 'Share of usage', value: d.pct + '%' }];
    g.addEventListener('pointermove', e => showTip(e, d.name, rows()));
    g.addEventListener('pointerleave', hideTip);
    g.addEventListener('focus', e => showTip(e, d.name, rows()));
    g.addEventListener('blur', hideTip);
  });
  box.replaceChildren(svg);
}

// ---------- sample home data ----------
const PEOPLE = 6;
const HIST = [   // Sep 2025 – Aug 2026: home usage and solar output, kWh
  ['2025-09', 2480, 930], ['2025-10', 2350, 880], ['2025-11', 2280, 780], ['2025-12', 2200, 760],
  ['2026-01', 2250, 830], ['2026-02', 2300, 900], ['2026-03', 2450, 960], ['2026-04', 2600, 950],
  ['2026-05', 2700, 930], ['2026-06', 2650, 940], ['2026-07', 2550, 950], ['2026-08', 2500, 940],
].map(([ym, use, prod]) => {
  const solarUsed = Math.round(prod * SELF_USE), grid = use - solarUsed;
  return { ym, label: MON[+ym.slice(5) - 1] + ' ' + ym.slice(2, 4), use, prod, solarUsed, grid, exported: prod - solarUsed, saved: homeBill(use) - homeBill(grid), days: daysIn(ym) };
});
const APPL = [['Air-conditioning', 52], ['Water heaters', 10], ['Fridges & freezer', 9], ['Lighting', 7], ['Cooking', 6], ['Washing & drying', 6], ['TV & electronics', 5], ['Other', 5]];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
const DAY_USE = [2.2, 2.1, 2.0, 2.0, 1.9, 1.9, 1.6, 1.4, 1.2, 1.3, 1.5, 1.7, 1.9, 2.0, 2.0, 2.1, 2.4, 2.9, 3.4, 3.8, 3.9, 3.6, 3.0, 2.6].map(v => +(v * 1.5).toFixed(2));
const DAY_SOLAR = [0, 0, 0, 0, 0, 0, .3, 1.2, 2.6, 3.9, 5.0, 5.8, 6.1, 5.9, 5.2, 4.0, 2.6, 1.2, .3, 0, 0, 0, 0, 0].map(v => +(v * .7).toFixed(2));
const MTD = { label: 'September 2026, 1–28 Sep', use: 2315, prod: 862 };

function renderDay() {
  $('dayLabel').textContent = 'Monday 28 September 2026 · kW, hour by hour';
  const G = css('--s-grid'), S = css('--s-solar');
  lineChart($('dayChart'), HOURS, [
    { name: 'Home usage', color: G, values: DAY_USE },
    { name: 'Solar output', color: S, values: DAY_SOLAR, area: true },
  ], 'kW');
  const use = DAY_USE.reduce((a, b) => a + b), prod = DAY_SOLAR.reduce((a, b) => a + b);
  const used = DAY_USE.reduce((a, u, i) => a + Math.min(u, DAY_SOLAR[i]), 0);
  const peak = HOURS[DAY_USE.indexOf(Math.max(...DAY_USE))];
  $('dayStats').replaceChildren(...[
    ['Home used', fmt(use, 1) + ' kWh'], ['Solar made', fmt(prod, 1) + ' kWh'],
    ['Solar used at home', Math.round(used / prod * 100) + '%'], ['Peak hour', peak],
  ].map(([a, b]) => { const d = h('div'); d.append(h('span', a), h('strong', b)); return d; }));
  table($('dayTable'), ['Hour', 'Home usage (kW)', 'Solar output (kW)'], HOURS.map((hr, i) => [hr, fmt(DAY_USE[i], 2), fmt(DAY_SOLAR[i], 2)]));
}

function renderBill() {
  const used = Math.round(MTD.prod * SELF_USE), grid = MTD.use - used;
  const bill = homeBill(grid), without = homeBill(MTD.use);
  $('billLabel').textContent = MTD.label;
  const f = (lab, val, cls) => { const d = h('div', undefined, cls); d.append(h('span', lab), h('strong', val)); return d; };
  $('billFigs').replaceChildren(f('Estimated bill', money(bill, 2)), f('Saved by solar', money(without - bill, 2), 'save'));
  // tariff band meter: widths proportional to band size, 4,000+ shown as a fixed stub
  const spans = [[0, 600], [600, 2000], [2000, 4000], [4000, 5000]];
  const total = 5000;
  $('bands').replaceChildren(...spans.map(([a, b], k) => {
    const d = h('div', undefined, 'b'); d.style.flex = (b - a) / total;
    const fill = h('div', undefined, 'fill'); fill.style.width = Math.max(0, Math.min(1, (grid - a) / (b - a))) * 100 + '%';
    d.append(fill, h('b', 'B$' + BANDS[k][1].toFixed(2)), h('label', k === 3 ? '4,000+' : fmt(a)));
    return d;
  }));
  const rate = marginalRate(grid);
  const next = BANDS.find(([cap]) => grid <= cap)[0];
  $('bandNote').textContent = `${fmt(grid)} kWh from the grid so far. Each extra kWh now costs B$${rate.toFixed(2)}` +
    (isFinite(next) ? `; ${fmt(next - grid)} kWh left before the next band.` : '.');
}

let range = 12;
function renderHistory() {
  const H = HIST.slice(-range);
  const sum = k => H.reduce((a, d) => a + d[k], 0);
  const use = sum('use'), prod = sum('prod'), grid = sum('grid'), solarUsed = sum('solarUsed'), saved = sum('saved'), days = sum('days');
  $('kSave').textContent = money(saved);
  $('kSaveSub').textContent = `${H[0].label} – ${H[H.length - 1].label} · about ${money(saved / H.length)} a month`;
  $('kProd').textContent = fmt(prod) + ' kWh';
  $('kProdSub').textContent = fmt(sum('exported')) + ' kWh sent to the grid';
  $('kSelf').textContent = Math.round(solarUsed / use * 100) + '%';
  $('kGrid').textContent = fmt(grid) + ' kWh';
  $('kGridSub').textContent = 'of ' + fmt(use) + ' kWh used';
  $('kCo2').textContent = fmt(solarUsed * CO2 / 1000, 1) + ' t';

  const G = css('--s-grid'), S = css('--s-solar'), X = css('--s-export');
  columnChart($('monthChart'), H.map(d => d.label), [
    { name: 'Solar used at home', color: S, values: H.map(d => d.solarUsed) },
    { name: 'From the grid', color: G, values: H.map(d => d.grid) },
  ], 'kWh', i => [{ color: X, label: 'Sent to grid', value: fmt(H[i].exported) + ' kWh' }, { label: 'Bill saved', value: money(H[i].saved, 2) }]);
  table($('monthTable'), ['Month', 'Home usage', 'Solar produced', 'Solar used at home', 'From grid', 'Sent to grid', 'Bill saved'],
    H.map(d => [d.label, fmt(d.use), fmt(d.prod), fmt(d.solarUsed), fmt(d.grid), fmt(d.exported), money(d.saved, 2)]));

  // efficiency rating
  const perDay = use / days / PEOPLE;
  const GR = [['A', 8, '#1F8A4C'], ['B', 11, '#5E9E3C'], ['C', 14, '#C99A1A'], ['D', 17, '#D9722B'], ['E', Infinity, '#C0392B']];
  const gi = GR.findIndex(([, cap]) => perDay < cap);
  const grade = h('div', GR[gi][0], 'grade'); grade.style.background = GR[gi][2];
  const txt = h('div'); txt.append(h('strong', fmt(perDay, 1) + ' kWh'), h('p', `per person per day · ${PEOPLE} people · rating ${GR[gi][0]}`));
  $('rating').replaceChildren(grade, txt);
  let lo = 0;
  $('scale').replaceChildren(...GR.map(([g, cap, c], k) => {
    const li = h('li', undefined, k === gi ? 'me' : ''); const b = h('b', g); b.style.background = c;
    li.append(b, h('span', isFinite(cap) ? `${lo} – ${cap} kWh` : `over ${lo} kWh`), h('span', k === gi ? 'This home' : ''));
    lo = cap; return li;
  }));

  // appliances
  const items = APPL.map(([name, pct]) => ({ name, pct, v: use * pct / 100 }));
  hbarChart($('applChart'), items, G, 'kWh');
  table($('applTable'), ['Appliance group', 'kWh', 'Share'], items.map(d => [d.name, fmt(d.v), d.pct + '%']));

  // tips, sized from this home's own figures
  const perMonth = use / H.length, gridMonth = grid / H.length, rate = marginalRate(gridMonth);
  const ac = perMonth * .52, acSave = ac * .06, exp = sum('exported') / H.length;
  const tips = [
    ['Set air-con to 25°C instead of 23°C', `Air-con is about half of this home's use. Each degree warmer typically cuts its energy by around 3%, so roughly <em>${fmt(acSave)} kWh (${money(acSave * rate)}) a month</em>.`],
    ['Run heavy appliances between 10:00 and 15:00', `About <em>${fmt(exp)} kWh a month</em> of solar goes to the grid. Washing, drying, ironing and water heating at midday use it at home instead.`],
    ['Add a home battery for the evening peak', `Usage peaks around 19:00–21:00 after the sun sets. A 10 kWh battery could shift much of the midday surplus into the evening.`],
    ['Check fridges older than 10 years', 'Fridges run all day. Replacing an old unit with an inverter model often halves its consumption.'],
  ];
  $('tips').replaceChildren(...tips.map(([t, body]) => { const li = h('li'); li.appendChild(h('strong', t)); const p = h('span'); p.innerHTML = body; li.appendChild(p); return li; }));
}

document.querySelectorAll('.filter-row button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.filter-row button').forEach(x => x.classList.toggle('on', x === b));
  range = +b.dataset.range;
  renderHistory();
}));

// ---------- my tracker (stored only in this browser) ----------
const KEY = 'bs-tracker-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = rows => { try { localStorage.setItem(KEY, JSON.stringify(rows)); return true; } catch { return false; } };
let entries = load();

function renderTracker() {
  const rows = entries.slice().sort((a, b) => a.month.localeCompare(b.month));
  const box = $('tChart'), tb = $('tTable'), kp = $('tKpis');
  if (!rows.length) {
    kp.replaceChildren(); tb.replaceChildren();
    box.replaceChildren(h('div', 'No months logged yet. Add your first month from your electricity bill or meter, or load the example data.', 'empty'));
    return;
  }
  const lab = r => MON[+r.month.slice(5) - 1] + ' ' + r.month.slice(2, 4);
  const perDay = r => (r.grid + (r.solar || 0) * SELF_USE) / daysIn(r.month) / r.people;
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const k = (a, b, delta, good) => { const d = h('div'); d.append(h('span', a), h('strong', b)); if (delta) d.appendChild(h('em', delta, good ? 'down-good' : 'up-bad')); return d; };
  const dPct = prev ? (last.grid - prev.grid) / prev.grid * 100 : null;
  kp.replaceChildren(
    k(`Grid use, ${lab(last)}`, fmt(last.grid) + ' kWh', dPct === null ? '' : `${dPct > 0 ? '▲' : '▼'} ${fmt(Math.abs(dPct), 0)}% vs ${lab(prev)}`, dPct <= 0),
    k('Estimated bill', money(homeBill(last.grid), 2)),
    k('Per person per day', fmt(perDay(last), 1) + ' kWh'),
  );
  const G = css('--s-grid');
  columnChart(box, rows.map(lab), [{ name: 'From the grid', color: G, values: rows.map(r => r.grid) }], 'kWh',
    i => [{ label: 'Estimated bill', value: money(homeBill(rows[i].grid), 2) }, { label: 'Per person per day', value: fmt(perDay(rows[i]), 1) + ' kWh' }]);
  table(tb, ['Month', 'Grid kWh', 'Solar kWh', 'People', 'Est. bill', 'kWh / person / day', ''], rows.map(r => {
    const del = h('button', '✕', 'row-del'); del.title = 'Remove ' + lab(r); del.setAttribute('aria-label', 'Remove ' + lab(r));
    del.addEventListener('click', () => { entries = entries.filter(e => e.month !== r.month); save(entries); renderTracker(); });
    return [lab(r), fmt(r.grid), r.solar ? fmt(r.solar) : '–', String(r.people), money(homeBill(r.grid), 2), fmt(perDay(r), 1), del];
  }));
}

$('tForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, note = $('tNote');
  let ok = true;
  ['month', 'grid', 'people'].forEach(n => { const bad = !f[n].value || +f[n].value < 0; f[n].classList.toggle('invalid', bad); if (bad) ok = false; });
  note.hidden = false;
  if (!ok) { note.textContent = 'Please fill in the month, grid kWh and number of people.'; return; }
  const row = { month: f.month.value, grid: +f.grid.value, solar: f.solar.value ? +f.solar.value : 0, people: +f.people.value };
  const existed = entries.some(x => x.month === row.month);
  entries = entries.filter(x => x.month !== row.month).concat(row);
  const stored = save(entries);
  note.textContent = (existed ? 'Updated ' : 'Saved ') + row.month + '.' + (stored ? '' : ' (This browser blocks storage, so it will be lost when you close the page.)');
  f.grid.value = ''; f.solar.value = '';
  renderTracker();
});
$('tExample').addEventListener('click', () => {
  entries = [['2026-03', 2380], ['2026-04', 2520], ['2026-05', 2610], ['2026-06', 2490], ['2026-07', 2350], ['2026-08', 2210]]
    .map(([month, grid]) => ({ month, grid, solar: 0, people: 5 }));
  save(entries); renderTracker();
});
$('tClear').addEventListener('click', e => {
  const b = e.target;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Click again to delete all'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Clear all'; }, 3000); return; }
  entries = []; save(entries); b.dataset.confirm = ''; b.textContent = 'Clear all'; renderTracker();
});

// ---------- tabs, menu, resize ----------
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
  $('tab-sample').hidden = b.dataset.tab !== 'sample';
  $('tab-tracker').hidden = b.dataset.tab !== 'tracker';
  renderAll();
}));
const burger = $('burger'), nav = $('nav');
burger.addEventListener('click', () => burger.setAttribute('aria-expanded', nav.classList.toggle('open')));

function renderAll() {
  if (!$('tab-sample').hidden) { renderDay(); renderBill(); renderHistory(); }
  if (!$('tab-tracker').hidden) renderTracker();
}
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderAll, 120); });
renderAll();
