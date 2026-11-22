'use strict';
// Percy Pennies: monthly spending tracker. Everything is stored on this device in localStorage.

const KEY = 'percy-pennies:v1';

// Starting categories for a fresh install. A backup file replaces these with your own.
const DEFAULT_GROUPS = [
  ['income', 'Income', 'income', [['salary', 'Salary', 1], ['bonuses', 'Bonuses', 0], ['other-income', 'Other income', 0]]],
  ['savings', 'Savings', 'savings', [['savings-account', 'Savings account', 1], ['cash-isa', 'Cash ISA', 0], ['stocks-isa', 'Stocks & Shares ISA', 0]]],
  ['home', 'Home', 'expense', [['rent', 'Rent', 1], ['council-tax', 'Council Tax', 1], ['electricity', 'Electricity', 1], ['gas', 'Gas', 1], ['water', 'Water', 1], ['internet', 'Internet', 1]]],
  ['financial', 'Financial obligations', 'expense', [['credit-cards', 'Credit card payments', 0]]],
  ['subscriptions', 'Subscriptions', 'expense', [['phones', 'Phones', 1], ['spotify', 'Spotify', 1], ['apps', 'Apps & software', 0]]],
  ['pets', 'Pets', 'expense', [['pet-insurance', 'Insurance', 1], ['pet-food', 'Food', 0], ['vet', 'Vet', 0]]],
  ['fitness', 'Fitness & sports', 'expense', [['gym', 'Gym fees', 1], ['sports-kit', 'Sports equipment', 0], ['supplements', 'Supplements', 0]]],
  ['transport', 'Transport', 'expense', [['car-payments', 'Car payments', 1], ['car-insurance', 'Insurance', 1], ['mot', 'MOT / Service', 0], ['road-tax', 'Road tax', 0], ['petrol', 'Petrol', 0], ['parking', 'Parking', 0]]],
  ['daily', 'Daily living', 'expense', [['groceries', 'Groceries', 0], ['amazon', 'Amazon', 0], ['treats', 'Treats', 0]]],
  ['health', 'Health', 'expense', [['health-other', 'Health', 0], ['dentist', 'Dentist', 0]]],
  ['personal', 'Personal', 'expense', [['hair', 'Hair', 0], ['clothing', 'Clothing', 0]]],
  ['holidays', 'Holidays', 'expense', [['holiday', 'Holiday', 0]]],
  ['misc', 'Misc', 'expense', [['house', 'House things', 0], ['gifts', 'Gifts & occasions', 0], ['misc-other', 'Other', 0]]],
].map(([id, name, kind, items]) => ({ id, name, kind, items: items.map(([iid, iname, regular]) => ({ id: iid, name: iname, regular: !!regular })) }));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- Store ----------

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.groups) && Array.isArray(s.entries)) return s;
  } catch (e) { /* fall through to a fresh start */ }
  return { groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)), entries: [] };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Couldn’t save on this device'); }
  index = null;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// sums[month][itemId] -> total, rebuilt after every save
let index = null;
function idx() {
  if (index) return index;
  const sums = {};
  const items = {};
  for (const g of state.groups) for (const it of g.items) items[it.id] = { item: it, group: g };
  for (const e of state.entries) {
    const m = (sums[e.month] ||= {});
    m[e.item] = (m[e.item] || 0) + e.amount;
  }
  const months = Object.keys(sums).sort();
  index = { sums, items, months };
  return index;
}

const itemSum = (month, itemId) => (idx().sums[month] || {})[itemId] || 0;
const groupSum = (month, g) => g.items.reduce((t, it) => t + itemSum(month, it.id), 0);
const kindSum = (month, kind) => state.groups.filter((g) => g.kind === kind).reduce((t, g) => t + groupSum(month, g), 0);
const spent = (month) => kindSum(month, 'expense');
const groupById = (id) => state.groups.find((g) => g.id === id);
const expenseGroups = () => state.groups.filter((g) => g.kind === 'expense');

// A "target" is something we can chart: all spending, a group or an item.
function targetSum(month, target) {
  const [type, id] = target.split(':');
  if (type === 'all') return spent(month);
  if (type === 'group') { const g = groupById(id); return g ? groupSum(month, g) : 0; }
  return itemSum(month, id);
}
function targetName(target) {
  const [type, id] = target.split(':');
  if (type === 'all') return 'All spending';
  if (type === 'group') return groupById(id)?.name || 'Group';
  const hit = idx().items[id];
  return hit ? hit.item.name : 'Item';
}

// ---------- Months & money ----------

function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthName(key, style = 'long') {
  const [y, m] = key.split('-').map(Number);
  if (style === 'short') return MONTHS[m - 1].slice(0, 3);
  if (style === 'shortyear') return `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
  return `${MONTHS[m - 1]} ${y}`;
}
// Every month from the first with data up to the later of this month or the last with data
function monthRange() {
  const ms = idx().months;
  const now = thisMonth();
  const first = ms[0] || now;
  const last = ms.length && ms[ms.length - 1] > now ? ms[ms.length - 1] : now;
  const out = [];
  for (let k = first; k <= last; k = addMonths(k, 1)) out.push(k);
  return out;
}

const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
function money(v) {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? gbp0.format(r) : gbp2.format(r);
}
const moneyRound = (v) => gbp0.format(Math.round(v));

function parseAmount(s) {
  const v = parseFloat(String(s).replace(/[£,\s]/g, ''));
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : NaN;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Arrow + words, so the meaning never rests on colour. For money in, going up is the good direction.
function delta(cur, prev, { goodUp = false, words = false, vs = '' } = {}) {
  const d = Math.round((cur - prev) * 100) / 100;
  if (!cur && !prev) return '';
  if (Math.abs(d) < 0.5) return `<span class="delta same">same${vs ? ' as ' + esc(vs) : ''}</span>`;
  const up = d > 0;
  const good = up === goodUp;
  const word = words ? (up ? ' more' : ' less') + (vs ? ' than ' + esc(vs) : '') : '';
  return `<span class="delta ${good ? 'down' : 'up'}">${up ? '▲' : '▼'} ${moneyRound(Math.abs(d))}${word}</span>`;
}

// ---------- UI state ----------

const ui = {
  tab: 'month',
  month: thisMonth(),
  open: new Set(),
  trendMode: 'compare',
  a: null,
  b: null,
  cmpOpen: new Set(),
  target: 'all',
  pick: null,
  year: null,
  lastItem: null,
};
try { const saved = JSON.parse(localStorage.getItem(KEY + ':ui')); if (saved) Object.assign(ui, { tab: saved.tab || 'month', target: saved.target || 'all', lastItem: saved.lastItem || null }); } catch (e) { /* ignore */ }
function saveUi() { try { localStorage.setItem(KEY + ':ui', JSON.stringify({ tab: ui.tab, target: ui.target, lastItem: ui.lastItem })); } catch (e) { /* ignore */ } }

const $view = document.getElementById('view');
const icon = {
  prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
};

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  ({ month: renderMonth, trends: renderTrends, year: renderYear, more: renderMore })[ui.tab]();
}

// ---------- Month ----------

function renderMonth() {
  const m = ui.month;
  const prev = addMonths(m, -1);
  const now = thisMonth();
  const out = spent(m);
  const inc = kindSum(m, 'income');
  const sav = kindSum(m, 'savings');
  const left = inc - out - sav;
  const soFar = m === now ? ' so far' : '';
  const hasPrev = spent(prev) > 0;

  let html = `
    <div class="topbar">
      <button class="icon-btn" data-act="month" data-n="-1" aria-label="Previous month">${icon.prev}</button>
      <h1>${monthName(m)}${m === now ? '<small>This month</small>' : ''}</h1>
      <button class="icon-btn" data-act="month" data-n="1" aria-label="Next month">${icon.next}</button>
    </div>
    ${lastAddedBar()}
    <section class="card summary">
      <div class="label">Spent${soFar}</div>
      <div class="big">${money(out)}</div>
      <div>${hasPrev ? delta(out, spent(prev), { words: true, vs: MONTHS[+prev.slice(5) - 1] }) : '<span class="delta same">Nothing logged the month before</span>'}</div>
      <div class="trio">
        <div><span>Money in</span><b>${money(inc)}</b></div>
        <div><span>Saved</span><b>${money(sav)}</b></div>
        <div><span>Left over</span><b class="${left < 0 ? 'neg' : ''}">${left < 0 ? '−' : ''}${money(Math.abs(left))}</b></div>
      </div>
    </section>`;

  const regular = regularFrom(prev, m);
  if (regular.length) {
    const total = regular.reduce((t, r) => t + r.amount, 0);
    html += `<section class="card prompt">
      <p>Copy <b>${regular.length} regular bills</b> from ${MONTHS[+prev.slice(5) - 1]} (${money(total)})?</p>
      <button class="btn sm" data-act="copy-regular">Copy</button>
    </section>`;
  }

  html += '<h2 class="section-title">Spending</h2>';
  for (const g of expenseGroups()) html += groupCard(g, m, prev, false);
  html += '<h2 class="section-title">Money in &amp; savings</h2>';
  for (const g of state.groups.filter((x) => x.kind !== 'expense')) html += groupCard(g, m, prev, true);
  $view.innerHTML = html;
}

function groupCard(g, m, prev, goodUp) {
  const cur = groupSum(m, g);
  const before = groupSum(prev, g);
  const open = ui.open.has(g.id);
  let rows = '';
  if (open) {
    // Lines used this month or last; a quiet group shows all its lines so there's something to tap
    const used = g.items.filter((it) => itemSum(m, it.id) || itemSum(prev, it.id));
    for (const it of used.length ? used : g.items) {
      const v = itemSum(m, it.id);
      const p = itemSum(prev, it.id);
      const notes = state.entries.filter((e) => e.month === m && e.item === it.id && e.note).map((e) => e.note);
      rows += `<button class="item-row ${v ? '' : 'zero'}" data-act="item" data-id="${it.id}">
        <span class="name">${esc(it.name)}${notes.length ? `<small>${esc(notes.join(' · '))}</small>` : ''}</span>
        <span class="amt"><b>${v ? money(v) : '—'}</b>${delta(v, p, { goodUp })}</span>
      </button>`;
    }
    rows += `<button class="add-link" data-act="add" data-group="${g.id}">+ Add to ${esc(g.name)}</button>`;
  }
  return `<section class="card group ${open ? 'open' : ''}">
    <button class="group-head" data-act="toggle" data-id="${g.id}" aria-expanded="${open}">
      ${icon.chev}
      <span class="name">${esc(g.name)}</span>
      <span class="amt" style="text-align:right">${cur ? money(cur) : '<span class="muted">—</span>'}<span class="sub">${delta(cur, before, { goodUp })}</span></span>
    </button>
    ${open ? `<div class="items">${rows}</div>` : ''}
  </section>`;
}

// ---------- Last added ----------

// When an amount was added or last changed. Amounts imported from the spreadsheet have no date.
const stamp = (e) => e.updated || e.added || '';
const recent = () => state.entries.filter(stamp).sort((x, y) => stamp(y).localeCompare(stamp(x)));

function when(iso, withTime = true) {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const days = Math.round((today - day) / 864e5);
  const time = withTime ? ` at ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '';
  if (days === 0) return `Today${time}`;
  if (days === 1) return `Yesterday${time}`;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' });
}

function lastAddedBar() {
  const last = recent()[0];
  if (!last) {
    const ms = idx().months;
    if (!ms.length) return '';
    return `<section class="card last-added"><span class="dot" aria-hidden="true"></span><p><b>Nothing added in the app yet</b><span>Spreadsheet figures up to ${monthName(ms[ms.length - 1], 'short')} ${ms[ms.length - 1].slice(0, 4)}</span></p></section>`;
  }
  const hit = idx().items[last.item];
  const what = `${hit ? esc(hit.item.name) : 'Amount'} ${money(last.amount)}${last.note ? ` · ${esc(last.note)}` : ''}`;
  return `<button class="card last-added" data-act="recent">
    <span class="dot" aria-hidden="true"></span>
    <p><b>Last ${last.updated ? 'updated' : 'added'} ${when(stamp(last)).replace(/^[TY]/, (c) => c.toLowerCase()).replace(/^(\w{3}) /, 'on $1 ')}</b><span>${what}${last.month !== thisMonth() ? ` (${monthName(last.month)})` : ''}</span></p>
    ${icon.chev}
  </button>`;
}

function recentSheet() {
  const list = recent().slice(0, 15);
  openSheet(`
    <div class="sheet-head"><div><h2>Recently added</h2><p>Newest first. Tap one to change it.</p></div><button class="link" data-act="close">Done</button></div>
    <section class="card">
      ${list.map((e) => {
        const hit = idx().items[e.item];
        return `<button class="entry" data-act="edit-entry" data-id="${e.id}">
          <span class="name">${hit ? esc(hit.item.name) : 'Amount'}${e.note ? ` · ${esc(e.note)}` : ''}<small class="muted" style="display:block;font-size:13px">${when(stamp(e))}${e.updated ? ' (changed)' : ''} · for ${monthName(e.month)}</small></span>
          <b>${money(e.amount)}</b></button>`;
      }).join('')}
    </section>`);
}

// Regular bills paid last month that haven't been logged yet this month
function regularFrom(prev, m) {
  const out = [];
  for (const g of state.groups) for (const it of g.items) {
    if (!it.regular) continue;
    const p = itemSum(prev, it.id);
    if (p && !itemSum(m, it.id)) out.push({ item: it.id, amount: p });
  }
  return out;
}

// ---------- Compare ----------

function renderTrends() {
  const ms = idx().months;
  if (!ms.length) { $view.innerHTML = `<h1 class="page-title">Compare</h1>${emptyCard()}`; return; }
  let html = `<h1 class="page-title">Compare</h1>
    <div class="seg" role="group" aria-label="View">
      <button data-act="trend-mode" data-mode="compare" aria-pressed="${ui.trendMode === 'compare'}">Month vs month</button>
      <button data-act="trend-mode" data-mode="time" aria-pressed="${ui.trendMode === 'time'}">Over time</button>
    </div>`;
  html += ui.trendMode === 'compare' ? compareView(ms) : timeView();
  $view.innerHTML = html;
}

function compareView(ms) {
  if (!ui.b || !ms.includes(ui.b)) ui.b = ms.includes(ui.month) ? ui.month : ms[ms.length - 1];
  if (!ui.a || !ms.includes(ui.a)) ui.a = ms[Math.max(0, ms.indexOf(ui.b) - 1)];
  const { a, b } = ui;
  const opts = (sel) => ms.slice().reverse().map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${monthName(k)}</option>`).join('');

  let html = `<div class="pair">
      <label class="field"><span>From</span><select class="input" data-act="cmp-a">${opts(a)}</select></label>
      <label class="field"><span>To</span><select class="input" data-act="cmp-b">${opts(b)}</select></label>
    </div>`;

  const sa = spent(a), sb = spent(b);
  html += `<section class="card summary">
      <div class="label">Spent in ${monthName(b)}${b === thisMonth() ? ' so far' : ''}</div>
      <div class="big">${money(sb)}</div>
      <div>${delta(sb, sa, { words: true, vs: monthName(a) })}</div>
    </section>`;

  // Biggest movers between the two months
  const moves = [];
  for (const g of expenseGroups()) for (const it of g.items) {
    const d = itemSum(b, it.id) - itemSum(a, it.id);
    if (Math.abs(d) >= 1) moves.push({ it, g, d });
  }
  moves.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  if (moves.length) {
    html += `<h2 class="section-title">Biggest changes</h2><section class="card">` + moves.slice(0, 5).map(({ it, g }) => `
      <div class="mover"><span class="name">${esc(it.name)}<small>${esc(g.name)} · ${money(itemSum(a, it.id))} → ${money(itemSum(b, it.id))}</small></span>
      ${delta(itemSum(b, it.id), itemSum(a, it.id))}</div>`).join('') + '</section>';
  }

  html += `<h2 class="section-title">Every category</h2><section class="card group">
    <div class="cmp-head" style="padding-top:14px"><span></span><span>${monthName(a, 'shortyear')}</span><span>${monthName(b, 'shortyear')}</span><span>Change</span></div>`;
  for (const g of expenseGroups()) {
    const ga = groupSum(a, g), gb = groupSum(b, g);
    if (!ga && !gb) continue;
    const open = ui.cmpOpen.has(g.id);
    html += `<button class="cmp-row grp" data-act="cmp-toggle" data-id="${g.id}" aria-expanded="${open}"><span>${esc(g.name)}</span><span>${moneyRound(ga)}</span><span>${moneyRound(gb)}</span>${delta(gb, ga) || '<span></span>'}</button>`;
    if (open) for (const it of g.items) {
      const ia = itemSum(a, it.id), ib = itemSum(b, it.id);
      if (!ia && !ib) continue;
      html += `<button class="cmp-row sub" data-act="see-trend" data-target="item:${it.id}"><span>${esc(it.name)}</span><span>${moneyRound(ia)}</span><span>${moneyRound(ib)}</span>${delta(ib, ia) || '<span></span>'}</button>`;
    }
  }
  html += `<div class="cmp-row cmp-total"><span>Total</span><span>${moneyRound(sa)}</span><span>${moneyRound(sb)}</span>${delta(sb, sa) || '<span></span>'}</div></section>
    <p class="hint" style="margin-top:4px">Tap a category to see its items. Tap an item to see it over time.</p>`;
  return html;
}

function targetOptions(sel) {
  let o = `<option value="all" ${sel === 'all' ? 'selected' : ''}>All spending</option><optgroup label="Groups">`;
  for (const g of expenseGroups()) o += `<option value="group:${g.id}" ${sel === 'group:' + g.id ? 'selected' : ''}>${esc(g.name)}</option>`;
  o += '</optgroup>';
  for (const g of state.groups) {
    o += `<optgroup label="${esc(g.name)}">`;
    for (const it of g.items) o += `<option value="item:${it.id}" ${sel === 'item:' + it.id ? 'selected' : ''}>${esc(it.name)}</option>`;
    o += '</optgroup>';
  }
  return o;
}

function timeView() {
  const months = monthRange().slice(-24);
  const t = ui.target;
  const pts = months.map((k) => ({ key: k, value: targetSum(k, t) }));
  const now = thisMonth();
  // Averages leave out the month in progress so a half-finished month doesn't drag them down
  const done = pts.filter((p) => p.key !== now && p.value > 0);
  const avg = done.length ? done.reduce((s, p) => s + p.value, 0) / done.length : 0;
  const hi = done.reduce((m, p) => (p.value > (m?.value ?? -1) ? p : m), null);
  const lo = done.reduce((m, p) => (p.value < (m?.value ?? Infinity) ? p : m), null);
  const last = done[done.length - 1];

  let html = `<label class="field"><span>Show</span><select class="input" data-act="target">${targetOptions(t)}</select></label>`;
  html += `<section class="card">${barChart(pts, { avg, sel: ui.pick })}</section>`;
  if (done.length) {
    const vsAvg = last && avg ? Math.round(((last.value - avg) / avg) * 100) : 0;
    html += `<div class="stats">
      <div class="stat"><span>Monthly average</span><b>${moneyRound(avg)}</b><small>over ${done.length} month${done.length > 1 ? 's' : ''}</small></div>
      <div class="stat"><span>${monthName(last.key, 'short')} vs average</span><b>${vsAvg === 0 ? 'Level' : (vsAvg > 0 ? '▲ ' : '▼ ') + Math.abs(vsAvg) + '%'}</b><small>${money(last.value)}</small></div>
      <div class="stat"><span>Highest</span><b>${money(hi.value)}</b><small>${monthName(hi.key)}</small></div>
      <div class="stat"><span>Lowest</span><b>${money(lo.value)}</b><small>${monthName(lo.key)}</small></div>
    </div>`;
  }
  html += `<details class="table-view"><summary>Show as a table</summary><table>${pts.slice().reverse().map((p) => `<tr><td>${monthName(p.key)}</td><td>${p.value ? money(p.value) : '—'}</td></tr>`).join('')}</table></details>
    <p class="hint" style="margin-top:10px">Averages leave out the month you’re in until it’s over.</p>`;
  return html;
}

// Single-series bar chart. Tap a bar to read its value.
function barChart(pts, { avg = 0, sel = null, short = false } = {}) {
  const W = 340, H = 170, L = 38, R = 4, T = 10, B = 22;
  const max = niceMax(Math.max(avg, ...pts.map((p) => p.value), 1));
  const n = pts.length;
  const step = (W - L - R) / n;
  const bw = Math.max(3, Math.min(26, step - 3));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const selKey = sel && pts.some((p) => p.key === sel) ? sel : [...pts].reverse().find((p) => p.value)?.key || pts[n - 1]?.key;
  const selPt = pts.find((p) => p.key === selKey);

  let svg = '';
  for (const f of [0, 0.5, 1]) {
    const gy = y(max * f);
    svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${gy}" y2="${gy}"/><text class="axis" x="${L - 6}" y="${gy + 3.5}" text-anchor="end">${axisMoney(max * f)}</text>`;
  }
  const every = n > 13 ? 3 : n > 7 ? 2 : 1;
  pts.forEach((p, i) => {
    const x = L + step * i + (step - bw) / 2;
    const h = (H - T - B) - (y(p.value) - T);
    if (p.value > 0) svg += `<path class="bar ${p.key === selKey ? 'sel' : ''}" d="${barPath(x, y(p.value), bw, h, Math.min(4, bw / 2))}"/>`;
    const lab = monthName(p.key, 'short');
    const showLab = (n - 1 - i) % every === 0;
    if (showLab) svg += `<text class="axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${p.key.endsWith('-01') && !short ? `${lab} ${p.key.slice(2, 4)}` : lab}</text>`;
    svg += `<rect class="hit" data-act="pick" data-key="${p.key}" x="${L + step * i}" y="${T}" width="${step}" height="${H - T}"><title>${monthName(p.key)}: ${money(p.value)}</title></rect>`;
  });
  if (avg > 0) svg += `<line class="avg" x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}"/><text class="avg-label" x="${W - R}" y="${y(avg) - 4}" text-anchor="end">avg</text>`;

  return `<div class="chart">
    <div class="chart-read"><span class="muted small">${selPt ? monthName(selPt.key) : ''}</span><b>${selPt ? money(selPt.value) : ''}</b></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart by month">${svg}</svg>
  </div>`;
}
function barPath(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
const axisMoney = (v) => (v >= 1000 ? `£${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `£${Math.round(v)}`);

// ---------- Year ----------

function renderYear() {
  const years = [...new Set(idx().months.map((k) => k.slice(0, 4)))];
  const nowY = thisMonth().slice(0, 4);
  if (!years.includes(nowY)) years.push(nowY);
  years.sort();
  if (!ui.year || !years.includes(ui.year)) ui.year = nowY;
  const Y = ui.year;
  const months = Array.from({ length: 12 }, (_, i) => `${Y}-${String(i + 1).padStart(2, '0')}`);
  const active = months.filter((k) => spent(k) > 0);
  const sum = (fn) => months.reduce((t, k) => t + fn(k), 0);
  const out = sum(spent);
  const inc = sum((k) => kindSum(k, 'income'));
  const sav = sum((k) => kindSum(k, 'savings'));
  const prevY = String(+Y - 1);
  const prevMonths = months.map((k) => prevY + k.slice(4));
  const hasPrev = prevMonths.some((k) => spent(k) > 0);

  let html = `<div class="topbar">
      <button class="icon-btn" data-act="year" data-n="-1" aria-label="Previous year" ${years[0] === Y ? 'disabled' : ''}>${icon.prev}</button>
      <h1>${Y}<small>${active.length} month${active.length === 1 ? '' : 's'} logged</small></h1>
      <button class="icon-btn" data-act="year" data-n="1" aria-label="Next year" ${years[years.length - 1] === Y ? 'disabled' : ''}>${icon.next}</button>
    </div>
    <section class="card summary">
      <div class="label">Spent in ${Y}</div>
      <div class="big">${moneyRound(out)}</div>
      <div class="muted small">About ${moneyRound(active.length ? out / active.length : 0)} a month</div>
      <div class="trio">
        <div><span>Money in</span><b>${moneyRound(inc)}</b></div>
        <div><span>Saved</span><b>${moneyRound(sav)}</b></div>
        <div><span>Left over</span><b class="${inc - out - sav < 0 ? 'neg' : ''}">${inc - out - sav < 0 ? '−' : ''}${moneyRound(Math.abs(inc - out - sav))}</b></div>
      </div>
    </section>
    <section class="card">${barChart(months.map((k) => ({ key: k, value: spent(k) })), { sel: ui.pick, short: true })}
      <p class="hint" style="margin:8px 0 0">Spending each month. Tap a bar to read it.</p></section>
    <h2 class="section-title">Where it went</h2><section class="card group">`;

  const rows = expenseGroups().map((g) => ({ g, v: sum((k) => groupSum(k, g)), p: hasPrev ? prevMonths.reduce((t, k) => t + groupSum(k, g), 0) : 0 }))
    .filter((r) => r.v > 0).sort((x, y) => y.v - x.v);
  for (const r of rows) {
    const share = out ? Math.round((r.v / out) * 100) : 0;
    html += `<button class="list-row" data-act="see-trend" data-target="group:${r.g.id}" style="display:block">
      <span style="display:flex;gap:10px;align-items:baseline"><span class="name" style="font-weight:620">${esc(r.g.name)}</span><b>${moneyRound(r.v)}</b></span>
      <span style="display:flex;gap:10px;justify-content:space-between" class="small muted"><span>${share}% · about ${moneyRound(active.length ? r.v / active.length : 0)} a month</span>${hasPrev ? delta(r.v, r.p, { words: true, vs: prevY }) : ''}</span>
      <span class="share"><i style="width:${share}%"></i></span>
    </button>`;
  }
  if (!rows.length) html += '<div class="empty">Nothing logged this year yet.</div>';
  html += '</section>';
  $view.innerHTML = html;
}

// ---------- More ----------

function renderMore() {
  let html = '<h1 class="page-title">More</h1>';
  html += '<h2 class="section-title">Categories</h2>';
  for (const g of state.groups) {
    html += `<section class="card group"><button class="list-row" data-act="edit-group" data-id="${g.id}"><span class="name" style="font-weight:650">${esc(g.name)}</span><span class="link">Rename</span></button>`;
    for (const it of g.items) html += `<button class="list-row" data-act="edit-item" data-id="${it.id}" style="padding-left:28px"><span class="name">${esc(it.name)}</span>${it.regular ? '<span class="tag">Regular</span>' : ''}</button>`;
    html += `<button class="add-link" data-act="new-item" data-group="${g.id}" style="padding-left:28px">+ Add a line</button></section>`;
  }
  html += `<button class="btn ghost block" data-act="new-group">+ Add a group</button>
    <p class="hint" style="margin-top:10px"><b>Regular</b> lines are bills that are the same most months. At the start of a month you can copy them over in one tap.</p>

    <h2 class="section-title">Your data</h2>
    <section class="card">
      <p class="small" style="margin-top:0">Everything is saved on this phone only. Save a backup now and then, and use it to move to a new phone.</p>
      <div class="pair">
        <button class="btn ghost" data-act="export">Save backup</button>
        <label class="btn ghost" style="cursor:pointer">Load backup<input type="file" accept=".json,application/json" data-act="import" hidden></label>
      </div>
      <p class="hint" style="margin:12px 0 0">${state.entries.length} amounts logged across ${idx().months.length} months.</p>
    </section>

    <h2 class="section-title">Put it on your phone</h2>
    <section class="card small">
      <p style="margin-top:0"><b>iPhone:</b> open this page in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. Always open it from that icon.</p>
      <p style="margin-bottom:0"><b>Android:</b> open it in Chrome, tap <b>⋮</b>, then <b>Install app</b>.</p>
    </section>
    <button class="btn danger block" data-act="wipe" style="margin-top:8px">Erase everything on this phone</button>`;
  $view.innerHTML = html;
}

// ---------- Sheets ----------

const $wrap = document.getElementById('sheet');
const $sheet = $wrap.querySelector('.sheet');
function openSheet(html) { $sheet.innerHTML = html; $wrap.hidden = false; document.body.style.overflow = 'hidden'; }
function closeSheet() { $wrap.hidden = true; $sheet.innerHTML = ''; document.body.style.overflow = ''; }

function itemOptions(sel) {
  return state.groups.map((g) => `<optgroup label="${esc(g.name)}">${g.items.map((it) => `<option value="${it.id}" ${it.id === sel ? 'selected' : ''}>${esc(it.name)}</option>`).join('')}</optgroup>`).join('');
}
function monthOptions(sel) {
  const ks = new Set(monthRange().slice(-24));
  ks.add(addMonths(thisMonth(), 1));
  ks.add(sel);
  return [...ks].sort().reverse().map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${monthName(k)}</option>`).join('');
}

// Add a new amount, or edit an existing one (entry given)
function entrySheet({ entry = null, item = null, group = null } = {}) {
  const items = idx().items;
  let sel = entry?.item || item;
  if (!sel && group) sel = groupById(group)?.items[0]?.id;
  if (!sel || !items[sel]) sel = ui.lastItem && items[ui.lastItem] ? ui.lastItem : expenseGroups()[0]?.items[0]?.id;
  const month = entry?.month || ui.month;
  openSheet(`
    <div class="sheet-head"><h2>${entry ? 'Edit amount' : 'Add an amount'}</h2><button class="link" data-act="close">Cancel</button></div>
    <form data-form="entry" data-id="${entry?.id || ''}">
      <label class="amount-input"><span>£</span><input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${entry ? entry.amount : ''}" aria-label="Amount"></label>
      <label class="field"><span>Category</span><select class="input" name="item">${itemOptions(sel)}</select></label>
      <p class="hint" data-running></p>
      <label class="field"><span>Note (optional)</span><input class="input" name="note" maxlength="80" placeholder="e.g. Tesco, birthday present" value="${esc(entry?.note || '')}"></label>
      <label class="field"><span>Month</span><select class="input" name="month">${monthOptions(month)}</select></label>
      <button class="btn block" type="submit">${entry ? 'Save' : 'Add'}</button>
      ${entry ? '<button class="btn danger block" type="button" data-act="delete-entry" style="margin-top:6px">Delete this amount</button>' : ''}
    </form>`);
  updateRunning();
  if (!entry) setTimeout(() => $sheet.querySelector('[name=amount]').focus(), 250);
}

// Shows what the category comes to this month, so adding to petrol twice is obvious
function updateRunning() {
  const f = $sheet.querySelector('[data-form=entry]');
  if (!f) return;
  const id = f.dataset.id;
  const item = f.item.value, month = f.month.value;
  const already = state.entries.filter((e) => e.item === item && e.month === month && e.id !== id).reduce((t, e) => t + e.amount, 0);
  const v = parseAmount(f.amount.value);
  const p = f.querySelector('[data-running]');
  if (!already) { p.textContent = `Nothing logged for this in ${monthName(month)} yet.`; return; }
  p.textContent = `${monthName(month)} already has ${money(already)}${Number.isFinite(v) && v ? `, so the total will be ${money(already + v)}` : ''}.`;
}

function itemSheet(id) {
  const hit = idx().items[id];
  if (!hit) return;
  const { item, group } = hit;
  const m = ui.month;
  const list = state.entries.filter((e) => e.item === id && e.month === m);
  const months = monthRange().slice(-12);
  openSheet(`
    <div class="sheet-head"><div><h2>${esc(item.name)}</h2><p>${esc(group.name)} · ${monthName(m)}</p></div><button class="link" data-act="close">Done</button></div>
    <section class="card">
      ${list.length ? list.map((e) => `<button class="entry" data-act="edit-entry" data-id="${e.id}"><span class="name">${e.note ? esc(e.note) : '<span class="muted">No note</span>'}${stamp(e) ? `<small class="muted" style="display:block;font-size:13px">Added ${when(stamp(e), false)}</small>` : ''}</span><b>${money(e.amount)}</b></button>`).join('') : '<div class="muted small">Nothing logged this month.</div>'}
    </section>
    <button class="btn block" data-act="add" data-item="${id}">+ Add to ${esc(item.name)}</button>
    <h2 class="section-title">Last 12 months</h2>
    <section class="card">${barChart(months.map((k) => ({ key: k, value: itemSum(k, id) })), { sel: m })}</section>
    <button class="btn ghost block" data-act="see-trend" data-target="item:${id}">Compare over time</button>`);
}

function nameSheet({ title, value = '', form, data = {}, extra = '' }) {
  openSheet(`
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="link" data-act="close">Cancel</button></div>
    <form data-form="${form}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>
      <label class="field"><span>Name</span><input class="input" name="name" maxlength="40" required value="${esc(value)}"></label>
      ${extra}
      <button class="btn block" type="submit">Save</button>
    </form>`);
  setTimeout(() => $sheet.querySelector('[name=name]').focus(), 250);
}

function itemEditSheet(id) {
  const { item, group } = idx().items[id];
  const used = state.entries.filter((e) => e.item === id).length;
  const groupOpts = state.groups.map((g) => `<option value="${g.id}" ${g.id === group.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  nameSheet({
    title: 'Edit line', value: item.name, form: 'item', data: { id },
    extra: `<label class="field"><span>Group</span><select class="input" name="group">${groupOpts}</select></label>
      <label class="toggle"><input type="checkbox" name="regular" ${item.regular ? 'checked' : ''}><span>Regular bill <span class="muted small">(offer to copy it each month)</span></span></label>
      ${used ? `<p class="hint">Used ${used} time${used > 1 ? 's' : ''}. Renaming keeps its history.</p>` : ''}
      <button class="btn danger block" type="button" data-act="delete-item" data-id="${id}" style="margin-bottom:8px">Delete this line</button>`,
  });
}

// ---------- Toast with undo ----------

let toastTimer = null;
let undoSnapshot = null;
function toast(msg, undo = false) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-act="undo">Undo</button>' : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; undoSnapshot = null; }, 5000);
}
function snapshot() { undoSnapshot = JSON.stringify(state); }

// ---------- Events ----------

document.addEventListener('click', (ev) => {
  const tabBtn = ev.target.closest('.tabs button');
  if (tabBtn) { ui.tab = tabBtn.dataset.tab; ui.pick = null; saveUi(); render(); scrollTo(0, 0); return; }
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const d = el.dataset;
  switch (d.act) {
    case 'month': ui.month = addMonths(ui.month, +d.n); render(); break;
    case 'year': ui.year = String(+ui.year + +d.n); ui.pick = null; render(); break;
    case 'toggle': ui.open.has(d.id) ? ui.open.delete(d.id) : ui.open.add(d.id); render(); break;
    case 'cmp-toggle': ui.cmpOpen.has(d.id) ? ui.cmpOpen.delete(d.id) : ui.cmpOpen.add(d.id); render(); break;
    case 'trend-mode': ui.trendMode = d.mode; ui.pick = null; render(); break;
    case 'see-trend': closeSheet(); ui.tab = 'trends'; ui.trendMode = 'time'; ui.target = d.target; ui.pick = null; saveUi(); render(); scrollTo(0, 0); break;
    case 'pick': {
      ui.pick = d.key;
      if (!$wrap.hidden) { const id = $sheet.querySelector('[data-act=add][data-item]')?.dataset.item; if (id) { ui.month = d.key; itemSheet(id); render(); } }
      else render();
      break;
    }
    case 'add': entrySheet({ item: d.item, group: d.group }); break;
    case 'item': itemSheet(d.id); break;
    case 'recent': recentSheet(); break;
    case 'edit-entry': entrySheet({ entry: state.entries.find((e) => e.id === d.id) }); break;
    case 'delete-entry': {
      const id = $sheet.querySelector('[data-form=entry]').dataset.id;
      snapshot();
      state.entries = state.entries.filter((e) => e.id !== id);
      save(); closeSheet(); render(); toast('Deleted', true);
      break;
    }
    case 'copy-regular': {
      const prev = addMonths(ui.month, -1);
      const list = regularFrom(prev, ui.month);
      snapshot();
      const added = new Date().toISOString();
      for (const r of list) state.entries.push({ id: uid(), month: ui.month, item: r.item, amount: r.amount, added });
      save(); render(); toast(`Copied ${list.length} bills from ${MONTHS[+prev.slice(5) - 1]}`, true);
      break;
    }
    case 'undo':
      if (undoSnapshot) { state = JSON.parse(undoSnapshot); undoSnapshot = null; save(); render(); }
      document.getElementById('toast').hidden = true;
      break;
    case 'close': closeSheet(); break;
    case 'edit-group': { const g = groupById(d.id); nameSheet({ title: 'Rename group', value: g.name, form: 'group', data: { id: g.id } }); break; }
    case 'new-group': nameSheet({ title: 'New group', form: 'group', data: { id: '' } }); break;
    case 'new-item': nameSheet({ title: `New line in ${groupById(d.group).name}`, form: 'item', data: { id: '', group: d.group }, extra: '<label class="toggle"><input type="checkbox" name="regular"><span>Regular bill <span class="muted small">(offer to copy it each month)</span></span></label>' }); break;
    case 'edit-item': itemEditSheet(d.id); break;
    case 'delete-item': {
      const used = state.entries.filter((e) => e.item === d.id).length;
      if (used && !confirm(`Delete "${idx().items[d.id].item.name}" and its ${used} amount${used > 1 ? 's' : ''}? Your monthly totals will go down by those amounts.`)) break;
      snapshot();
      for (const g of state.groups) g.items = g.items.filter((it) => it.id !== d.id);
      state.entries = state.entries.filter((e) => e.item !== d.id);
      if (ui.target === 'item:' + d.id) { ui.target = 'all'; saveUi(); }
      save(); closeSheet(); render(); toast('Line deleted', true);
      break;
    }
    case 'export': exportBackup(); break;
    case 'wipe':
      if (confirm('Erase every amount and category on this phone? Save a backup first if you might want it back.')) {
        state = { groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)), entries: [] };
        save(); render(); toast('Everything erased');
      }
      break;
  }
});

document.addEventListener('change', (ev) => {
  const d = ev.target.dataset;
  if (d.act === 'cmp-a') { ui.a = ev.target.value; render(); }
  else if (d.act === 'cmp-b') { ui.b = ev.target.value; render(); }
  else if (d.act === 'target') { ui.target = ev.target.value; ui.pick = null; saveUi(); render(); }
  else if (d.act === 'import') importBackup(ev.target.files[0]);
  else if (ev.target.form?.dataset.form === 'entry') updateRunning();
});
document.addEventListener('input', (ev) => { if (ev.target.form?.dataset.form === 'entry') updateRunning(); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$wrap.hidden) closeSheet(); });

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const kind = f.dataset.form;
  if (kind === 'entry') {
    const amount = parseAmount(f.amount.value);
    if (!Number.isFinite(amount) || amount === 0) { f.amount.focus(); toast('Type an amount first'); return; }
    const data = { month: f.month.value, item: f.item.value, amount, note: f.note.value.trim() };
    if (!data.note) delete data.note;
    const existing = f.dataset.id && state.entries.find((e) => e.id === f.dataset.id);
    const nowIso = new Date().toISOString();
    if (existing) { delete existing.note; Object.assign(existing, data, { updated: nowIso }); } else state.entries.push({ id: uid(), ...data, added: nowIso });
    ui.lastItem = data.item; saveUi();
    save(); closeSheet();
    ui.month = data.month;
    if (!existing) ui.open.add(idx().items[data.item].group.id);
    render();
    toast(existing ? 'Saved' : `Added ${money(amount)} to ${idx().items[data.item].item.name}`);
  } else if (kind === 'group') {
    const name = f.name.value.trim();
    if (!name) return;
    if (f.dataset.id) groupById(f.dataset.id).name = name;
    else state.groups.push({ id: 'g-' + uid(), name, kind: 'expense', items: [] });
    save(); closeSheet(); render();
  } else if (kind === 'item') {
    const name = f.name.value.trim();
    if (!name) return;
    const regular = !!f.regular?.checked;
    if (f.dataset.id) {
      const { item, group } = idx().items[f.dataset.id];
      Object.assign(item, { name, regular });
      const to = f.group?.value;
      if (to && to !== group.id) { group.items = group.items.filter((it) => it !== item); groupById(to).items.push(item); }
    } else {
      groupById(f.dataset.group).items.push({ id: 'i-' + uid(), name, regular });
    }
    save(); closeSheet(); render();
  }
});

// ---------- Backup ----------

async function exportBackup() {
  const name = `percy-pennies-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify({ app: 'percy-pennies', version: 1, ...state }, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Percy Pennies backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'percy-pennies' || !Array.isArray(data.groups) || !Array.isArray(data.entries)) throw new Error('not ours');
    const months = new Set(data.entries.map((e) => e.month)).size;
    const msg = state.entries.length
      ? `Replace what’s on this phone (${state.entries.length} amounts) with this backup (${data.entries.length} amounts over ${months} months)?`
      : `Load ${data.entries.length} amounts over ${months} months?`;
    if (!confirm(msg)) return;
    snapshot();
    state = { groups: data.groups, entries: data.entries };
    save();
    const last = idx().months[idx().months.length - 1];
    if (last && last < thisMonth()) ui.month = last;
    ui.tab = 'month'; saveUi(); render(); toast('Backup loaded', true);
  } catch (e) {
    toast('That file isn’t a Percy Pennies backup');
  }
}

function emptyCard() {
  return `<section class="card empty"><b>Nothing logged yet</b>Tap <b>+</b> to add your first amount, or load a backup from <b>More</b>.</section>`;
}

// ---------- Start ----------

navigator.storage?.persist?.();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
