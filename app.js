// Who's Off — the page. Pure logic lives in off-logic.js.
import * as L from './off-logic.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let D = null, IDX = null, TODAY = L.localToday();
const S = { date: TODAY, cc: null, year: null, showReg: false, shared: null };
let optIdx = -1, opts = [];
// Your countries live in this browser only, like everything else here.
const PINS_KEY = 'whos-off.pins';
let PINS = [];
const loadPins = () => { try { return localStorage.getItem(PINS_KEY); } catch { return null; } };
function savePins() { try { localStorage.setItem(PINS_KEY, JSON.stringify(PINS)); } catch { /* private mode: pins last this visit */ } }
// The list on show: one shared by link (?p=), else yours. A shared list never overwrites yours unasked.
const LIST = () => S.shared || PINS;

function setState(patch, push = true) {
  // a new country, or a date in another year, goes back to the date's year
  const moved = 'cc' in patch || ('date' in patch && patch.date.slice(0, 4) !== S.date.slice(0, 4));
  if (moved && !('year' in patch)) patch = { ...patch, year: null };
  Object.assign(S, patch);
  S.date = L.clampDate(D, S.date);
  const q = L.encodeState(S, TODAY, D);
  if (push && q !== location.search) history.replaceState(null, '', location.pathname + q);
  render();
}

function render() {
  $('date').value = S.date;
  drawStrip();
  drawMine();
  drawDay();
  drawCountry();
}

function drawStrip() {
  const { first, last } = L.range(D);
  let start = L.addDays(S.date, -3);
  if (start < first) start = first;
  if (L.addDays(start, 13) > last) start = L.addDays(last, -13);
  const days = Array.from({ length: 14 }, (_, k) => L.addDays(start, k));
  const counts = days.map((d) => L.nationalCount(D, IDX, d));
  const max = Math.max(1, ...counts);
  $('strip').replaceChildren(...days.map((d, k) => {
    const li = h('li'), b = h('button');
    b.type = 'button';
    const { wd, d: dn } = L.fmtShortDay(d);
    if (L.weekday(d) >= 5) b.classList.add('we');
    if (d === S.date) b.setAttribute('aria-current', 'date');
    const mine = LIST().length ? L.pinsOff(D, IDX, LIST(), d) : 0;
    b.setAttribute('aria-label', `${L.fmtDate(d)}: ${counts[k]} ${counts[k] === 1 ? 'country' : 'countries'} off` + (mine ? `, ${mine} of ${S.shared ? 'the list' : 'yours'}` : ''));
    const bar = h('span', 'bar'); bar.style.height = `${Math.round(2 + 22 * counts[k] / max)}px`;
    const slot = h('span', 'slot'); slot.append(bar);
    b.append(h('span', null, wd), h('b', null, String(dn)), slot, h('span', 'n', String(counts[k])));
    if (LIST().length) b.append(h('span', 'pin', mine ? '★'.repeat(Math.min(mine, 3)) : ''));
    b.addEventListener('click', () => setState({ date: d }));
    li.append(b);
    return li;
  }));
}

const STATUS = {
  holiday: ['off', 'Off'], weekend: ['off', 'Weekend'], makeup: ['on', 'Working (make-up day)'],
  regional: ['part', 'Off in some regions'], working: ['on', 'Working day'],
};
function drawMine() {
  const box = $('mine');
  const list = LIST();
  $('pinhint').hidden = list.length > 0;
  if (!list.length) { box.hidden = true; return; }
  box.hidden = false;
  box.classList.toggle('shared', !!S.shared);
  const days = list.map((cc) => L.dayFor(D, IDX, cc, S.date));
  const offN = days.filter((x) => x.kind === 'holiday' || x.kind === 'weekend').length;
  $('minehead').textContent = `${S.shared ? 'Shared list' : 'Your countries'} · ${L.fmtDate(S.date)} · ${offN ? `${offN} of ${list.length} off` : 'all working'}`;
  drawMineActions();
  $('minelist').replaceChildren(...days.map((x) => {
    const li = h('li'), b = h('button'); b.type = 'button';
    const [cls, label] = STATUS[x.kind];
    b.append(h('span', 'f', L.flag(x.cc)), h('span', 'c', L.countryName(D, x.cc)), h('span', 's ' + cls, label));
    let detail = x.kind === 'holiday' ? x.name : x.kind === 'regional' ? `${x.name}, in ${L.regionsLabel(x.subs)}` : '';
    const gap = x.next && L.daysBetween(S.date, x.next.date);
    const nx = x.next ? `next: ${x.next.name}, ${L.fmtDate(x.next.date)} (${S.date === TODAY ? L.inWords(gap) : `${gap} ${gap === 1 ? 'day' : 'days'} later`})` : '';
    if (L.NOTES[x.cc]) detail = L.NOTES[x.cc];
    b.append(h('span', 'nx', [detail, L.NOTES[x.cc] ? '' : nx].filter(Boolean).join(' · ')));
    b.addEventListener('click', () => { $('cq').value = L.countryName(D, x.cc); setState({ cc: x.cc }); $('cv').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    li.append(b);
    return li;
  }));
}

function drawMineActions() {
  const act = $('mineact'), msg = $('sharemsg');
  const btn = (id, text, fn) => { const b = h('button', null, text); b.type = 'button'; b.id = id; b.addEventListener('click', fn); return b; };
  if (S.shared) {
    msg.textContent = '';
    act.replaceChildren(h('span', 'tag', PINS.length ? 'Opened from a link — your own countries are kept.' : 'Opened from a link.'),
      btn('savelist', PINS.length ? 'Make these my countries' : 'Keep these as my countries', () => { PINS = [...S.shared]; savePins(); setState({ shared: null }); }),
      btn('droplist', PINS.length ? 'Back to mine' : 'Put away', () => setState({ shared: null })));
    return;
  }
  act.replaceChildren(btn('sharelist', 'Share this list', async () => {
    const url = location.origin + location.pathname + L.shareQuery(PINS);
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch { /* no clipboard: show the link to copy by hand */ }
    msg.textContent = ok ? 'Link copied — whoever opens it sees these countries, without losing their own.' : 'Copy this link: ';
    if (!ok) { const a = h('a', null, url); a.href = url; msg.append(a); }
  }));
}

function countryButton(cc, holiday, regions) {
  const li = h('li'), b = h('button');
  b.type = 'button';
  b.append(h('span', 'f', L.flag(cc)), h('span', 'c', L.countryName(D, cc)), h('span', 'h', holiday));
  if (regions) b.append(h('span', 'r', 'in ' + L.regionsLabel(regions)));
  b.addEventListener('click', () => { setState({ cc }); $('cv').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  li.append(b);
  return li;
}

function names(list, max = 30) {
  const n = list.map((cc) => L.countryName(D, cc));
  return n.length <= max ? L.regionsLabel(n, max) : `${n.slice(0, max).join(', ')} and ${n.length - max} more`;
}

function drawDay() {
  const o = L.on(D, IDX, S.date);
  const away = L.daysBetween(TODAY, S.date);
  const when = Math.abs(away) <= 1 ? `${L.inWords(away)[0].toUpperCase()}${L.inWords(away).slice(1)}, ` : '';
  const n = o.national.length;
  $('head').textContent = '';
  $('head').append(`${when}${L.fmtDate(S.date, true)} `,
    h('small', null, n ? `· a public holiday in ${n} ${n === 1 ? 'country' : 'countries'}` : '· no nationwide public holiday anywhere'));
  $('national').replaceChildren(...o.national.map((x) => countryButton(x.cc, x.name)));
  $('nonat').hidden = n > 0;
  $('nonat').textContent = o.regional.length ? 'No country is off nationwide — but some regions are:' : 'Nowhere is off, nationally or regionally. A good day for the call.';
  $('regwrap').hidden = !o.regional.length;
  $('reghead').textContent = `Regional only (${o.regional.length})`;
  $('regional').replaceChildren(...o.regional.map((x) => countryButton(x.cc, x.name, x.subs)));
  const wn = $('wenote');
  wn.textContent = '';
  const wd = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][L.weekday(S.date)];
  if (o.weekend.length) wn.append('Weekend on a ', h('b', null, wd), ` in ${o.weekend.length}: ${names(o.weekend)}.`);
  else if (o.working.length) wn.append('A ', h('b', null, `working ${wd}`), ` in ${o.working.length}: ${names(o.working)}.`);
  if (o.makeup.length) wn.append(' ', h('b', null, names(o.makeup)), ` ${o.makeup.length === 1 ? 'works' : 'work'} this ${wd}: an official make-up day, traded for a day off next to a holiday.`);
}

function drawCountry() {
  const cv = $('cv');
  if (!S.cc) { cv.hidden = true; return; }
  cv.hidden = false;
  const cc = S.cc, year = L.cardYear(D, S.date, S.year, S.cc);
  const all = L.yearHolidays(D, cc, year);
  const regN = all.filter((x) => x.subs).length;
  const close = h('button', 'x', 'close'); close.type = 'button';
  close.addEventListener('click', () => { setState({ cc: null }); $('cq').value = ''; });
  const pinned = PINS.includes(cc);
  const pin = h('button', 'pinb', pinned ? '★ Pinned' : '☆ Pin'); pin.type = 'button'; pin.id = 'pin';
  pin.setAttribute('aria-pressed', String(pinned));
  pin.title = pinned ? 'Remove from your countries' : 'Keep at the top of the page, in this browser';
  pin.addEventListener('click', () => { PINS = L.togglePin(PINS, cc); savePins(); render(); });
  const head = h('h2'); head.append(h('span', null, L.flag(cc)), `${L.countryName(D, cc)} in ${year}`, pin, close);
  const yrs = h('div', 'yrs'); yrs.setAttribute('role', 'group'); yrs.setAttribute('aria-label', 'Year');
  for (const y of D.years.map(String)) {
    const b = h('button', null, y); b.type = 'button'; b.setAttribute('aria-pressed', String(y === year));
    b.addEventListener('click', () => setState({ year: y }));
    yrs.append(b);
  }
  const parts = [head, yrs];
  const nx = L.nextNational(D, cc, S.date);
  const p = h('p', 'next');
  if (L.NOTES[cc]) p.textContent = L.NOTES[cc];
  else if (nx) {
    const rel = S.date === TODAY ? L.inWords(nx.away) : nx.away === 0 ? 'that day' : `${nx.away} days after ${L.fmtDate(S.date)}`;
    p.append('Next nationwide: ', h('b', null, nx.name), `, ${L.fmtDate(nx.date, true)} — ${rel}.`);
  } else p.textContent = `No more nationwide public holidays listed through ${D.years[D.years.length - 1]}.`;
  parts.push(p);
  const wk = D.countries[cc][1].map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join('–');
  parts.push(h('p', 'tag', `Weekend: ${wk}. ${all.length - regN} nationwide and ${regN} regional holidays in ${year}.`));
  const mk = ((D.work || {})[cc] || []).filter((d) => d.startsWith(year));
  if (mk.length) parts.push(h('p', 'tag', `Make-up working ${mk.length === 1 ? 'day' : 'days'} (weekend days worked to bridge a holiday): ${mk.map((d) => L.fmtDate(d)).join(', ')}.`));
  const br = L.breaks(D, cc, S.date).slice(0, 4);
  if (br.length && !L.NOTES[cc]) {
    const span = (x) => `${L.fmtDate(x.start)} – ${L.fmtDate(x.end)}${x.end.slice(0, 4) === year ? "" : " " + x.end.slice(0, 4)}`;
    const ul = h('ul', 'breaks');
    for (const x of br) {
      const li = h('li');
      li.append(h('b', null, `${x.days} days`), ` ${span(x)}`);
      if (x.leave) li.append(h('span', 'tag', ` · take ${L.fmtDate(x.leave)} off`));
      ul.append(li);
    }
    parts.push(h('h3', null, `Next long weekends${S.date === TODAY ? '' : ` after ${L.fmtDate(S.date)}`}`), ul,
      h('p', 'tag', 'Weekend plus nationwide holidays. "Take … off" means one day of leave joins them.'));
  }
  if (regN) {
    const lab = h('label', 'tag'); const cb = h('input'); cb.type = 'checkbox'; cb.checked = S.showReg; cb.id = 'showreg';
    cb.addEventListener('change', () => setState({ showReg: cb.checked }, false));
    lab.append(cb, ' show regional holidays');
    parts.push(lab);
  }
  const t = h('table'); const tb = h('tbody');
  for (const x of all) {
    if (x.subs && !S.showReg) continue;
    const tr = h('tr', x.subs ? 'reg' : '');
    if (x.date === S.date) tr.classList.add('sel');
    const nm = h('td', null, x.name);
    if (x.subs) nm.append(h('div', 'tag', 'in ' + L.regionsLabel(x.subs, 4)));
    const ad = L.daysBetween(TODAY, x.date);
    tr.append(h('td', 'd', L.fmtDate(x.date)), nm, h('td', 'a', ad < 0 ? 'past' : L.inWords(ad)));
    tr.style.opacity = ad < 0 ? '.75' : '';
    tb.append(tr);
  }
  t.append(tb);
  parts.push(all.length ? t : h('p', 'none', 'No public holidays listed.'));
  cv.replaceChildren(...parts);
}

// --- country combobox ----------------------------------------------------------------
function showOpts() {
  opts = L.findCountries(D, $('cq').value);
  optIdx = opts.length ? 0 : -1;
  drawOpts();
}
function drawOpts() {
  const box = $('copts');
  box.hidden = !opts.length;
  $('cq').setAttribute('aria-expanded', String(!box.hidden));
  box.replaceChildren(...opts.map((o, i) => {
    const li = h('li', null, `${L.flag(o.cc)} ${o.name}`);
    li.id = 'opt-' + o.cc; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === optIdx));
    li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(o); });
    return li;
  }));
  if (opts[optIdx]) $('cq').setAttribute('aria-activedescendant', 'opt-' + opts[optIdx].cc); else $('cq').removeAttribute('aria-activedescendant');
}
function choose(o) {
  $('cq').value = o.name;
  opts = []; optIdx = -1; drawOpts();
  setState({ cc: o.cc });
}
$('cq').addEventListener('input', showOpts);
$('cq').addEventListener('blur', () => { opts = []; drawOpts(); });
$('cq').addEventListener('keydown', (e) => {
  if (!opts.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); optIdx = (optIdx + 1) % opts.length; drawOpts(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); optIdx = (optIdx - 1 + opts.length) % opts.length; drawOpts(); }
  else if (e.key === 'Escape') { opts = []; drawOpts(); }
  else if (e.key === 'Enter' && opts[optIdx]) { e.preventDefault(); choose(opts[optIdx]); }
});
$('cform').addEventListener('submit', (e) => {
  e.preventDefault();
  const pick = opts[optIdx] || L.findCountries(D, $('cq').value)[0];
  if (pick) choose(pick);
});

// --- date controls -------------------------------------------------------------------
$('prev').addEventListener('click', () => setState({ date: L.addDays(S.date, -1) }));
$('nextd').addEventListener('click', () => setState({ date: L.addDays(S.date, 1) }));
$('today').addEventListener('click', () => setState({ date: TODAY }));
$('date').addEventListener('change', () => { if (L.isDate($('date').value)) setState({ date: $('date').value }); });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); setState({ date: L.addDays(S.date, -1) }); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); setState({ date: L.addDays(S.date, 1) }); }
});

fetch('data/holidays.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
  D = d; IDX = L.index(d);
  PINS = L.parsePins(loadPins(), d);
  const { first, last } = L.range(d);
  $('date').min = first; $('date').max = last;
  $('years').textContent = `${d.years[0]}–${d.years[d.years.length - 1]}`;
  $('ver').textContent = d.version;
  const st = L.decodeState(location.search, d, TODAY);
  if (st.cc) $('cq').value = L.countryName(d, st.cc);
  if (!L.sharedDiffers(st.shared, PINS)) st.shared = null; // a link to your own list is just your list
  setState(st, false);
}).catch((e) => {
  $('head').textContent = `Could not load the holidays (${e.message}). Reload to try again.`;
});
