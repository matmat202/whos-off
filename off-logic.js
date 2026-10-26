// Who's Off — the page's pure logic. No DOM; imported by app.js and the test.
// Dates are 'YYYY-MM-DD' strings throughout and arithmetic is done in UTC, so a day is
// a day in every timezone and across daylight-saving changes.

const DAY = 86400000;
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WD_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const NOTES = {
  UA: 'Ukraine has suspended public holidays under martial law, in force since February 2022.',
};

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(fromISO(s)) === s;
export const fromISO = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const toISO = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (s, k) => toISO(fromISO(s) + k * DAY);
export const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / DAY);
// Monday = 0, as Python's weekday() and the data's weekend lists
export const weekday = (s) => (new Date(fromISO(s)).getUTCDay() + 6) % 7;

export function localToday(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(s, long = false) {
  const t = new Date(fromISO(s));
  return long
    ? `${WD_LONG[weekday(s)]} ${t.getUTCDate()} ${MON_LONG[t.getUTCMonth()]} ${t.getUTCFullYear()}`
    : `${WD[weekday(s)]} ${t.getUTCDate()} ${MON[t.getUTCMonth()]}`;
}
export const fmtShortDay = (s) => ({ wd: WD[weekday(s)], d: new Date(fromISO(s)).getUTCDate() });

export function inWords(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

// Regional-indicator letters: 'DE' -> the German flag on systems that draw flags.
export const flag = (cc) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));

export function range(data) {
  return { first: `${data.years[0]}-01-01`, last: `${data.years[data.years.length - 1]}-12-31` };
}
export const inRange = (data, s) => isDate(s) && s >= range(data).first && s <= range(data).last;
export const clampDate = (data, s) => {
  const { first, last } = range(data);
  return s < first ? first : s > last ? last : s;
};

// date -> [{cc, name, subs}] — built once per page load
export function index(data) {
  const by = new Map();
  for (const [cc, rows] of Object.entries(data.h)) {
    for (const [d, name, subs] of rows) {
      if (!by.has(d)) by.set(d, []);
      by.get(d).push({ cc, name, subs });
    }
  }
  return by;
}

export const countryName = (data, cc) => (data.countries[cc] ? data.countries[cc][0] : cc);
export const subName = (data, cc, s) => (data.sub[cc] && data.sub[cc][s]) || s;

export function regionsLabel(names, max = 3) {
  if (names.length <= max) return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

const byCountry = (data) => (a, b) => countryName(data, a.cc).localeCompare(countryName(data, b.cc), 'en');

// Everything the day view shows.
export function on(data, idx, s) {
  const rows = idx.get(s) || [];
  const nat = new Map(), reg = [];
  for (const r of rows) {
    if (!r.subs) {
      // two national holidays on one day are one entry for the country
      if (nat.has(r.cc)) nat.get(r.cc).name += ` · ${r.name}`;
      else nat.set(r.cc, { cc: r.cc, name: r.name });
    }
  }
  for (const r of rows) {
    if (r.subs && !nat.has(r.cc)) reg.push({ cc: r.cc, name: r.name, subs: r.subs.map((x) => subName(data, r.cc, x)) });
  }
  const national = [...nat.values()].sort(byCountry(data));
  reg.sort(byCountry(data));
  const w = weekday(s), satSun = w >= 5;
  // Saturday and Sunday are the common weekend; name the exceptions either way.
  const odd = Object.entries(data.countries)
    .filter(([, [, wk]]) => wk.includes(w) !== satSun)
    .map(([cc]) => cc)
    .sort((a, b) => countryName(data, a).localeCompare(countryName(data, b), 'en'));
  return { national, regional: reg, weekend: satSun ? [] : odd, working: satSun ? odd : [] };
}

export const nationalCount = (data, idx, s) => on(data, idx, s).national.length;

// A country's holidays from `from` onward (national and regional), at most n.
export function upcoming(data, cc, from, n = Infinity) {
  const out = [];
  for (const [d, name, subs] of data.h[cc] || []) {
    if (d < from) continue;
    out.push({ date: d, name, subs: subs ? subs.map((x) => subName(data, cc, x)) : null, away: daysBetween(from, d) });
    if (out.length >= n) break;
  }
  return out;
}
export const nextNational = (data, cc, from) => upcoming(data, cc, from).find((x) => !x.subs) || null;

// Country search: exact code, then name prefix, then a word prefix, then substring.
export function findCountries(data, q, n = 8) {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const all = Object.entries(data.countries).map(([cc, [name]]) => ({ cc, name, l: name.toLowerCase() }));
  const score = (c) => (c.cc.toLowerCase() === t ? 0 : c.l.startsWith(t) ? 1
    : c.l.split(/[\s-]+/).some((w) => w.startsWith(t)) ? 2 : c.l.includes(t) ? 3 : 9);
  return all.map((c) => ({ ...c, s: score(c) })).filter((c) => c.s < 9)
    .sort((a, b) => a.s - b.s || a.name.localeCompare(b.name, 'en')).slice(0, n).map(({ cc, name }) => ({ cc, name }));
}

export function encodeState({ date, cc }, today) {
  const p = new URLSearchParams();
  if (date && date !== today) p.set('d', date);
  if (cc) p.set('c', cc);
  const q = p.toString();
  return q ? '?' + q : '';
}
export function decodeState(search, data, today) {
  const p = new URLSearchParams(search);
  const d = p.get('d'), c = (p.get('c') || '').toUpperCase();
  return {
    date: d && inRange(data, d) ? d : clampDate(data, today),
    cc: data.countries[c] ? c : null,
  };
}
