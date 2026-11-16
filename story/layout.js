/* Where every mark sits on each step of the story. Pure: no DOM, so test/story.test.mjs
 * runs every layout at several plot sizes. Modelled on when-works/site/story.
 *
 * Every step is the same chart: the days of the year, left to right, one bar each.
 *   "count":  grey bars, how many countries have a nationwide holiday that day
 *   "zero":   the same, with a red mark under every day no country is off
 *   "people": bars as a share of the world's people off on a working day, India's part red
 * A day: [nationwide, any, people off on a working day, of them India, sure].
 */
export const COL = { hit: '#b3261e', faint: '#cfcac3' };
export const STEPS = { count: 'count', zero: 'zero', people: 'people' };
const mid = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[(s.length - 1) >> 1] : 0; };
const DAY = 86400000;
export const ymd = (year, i) => new Date(Date.UTC(+year, 0, 1) + i * DAY).toISOString().slice(0, 10);
const wd = (year, i) => (new Date(Date.UTC(+year, 0, 1) + i * DAY).getUTCDay() + 6) % 7; // Monday = 0

const memo = new WeakMap();
/* -> the numbers the story quotes for one year; build_story.py's `check` holds the same */
export function stats(D, year = String(D.year)) {
  const rows = D.days[year];
  if (!rows) throw new Error(`no year ${year}`);
  if (!memo.has(D)) memo.set(D, {});
  const m = memo.get(D);
  if (m[year]) return m[year];
  const zero = rows.map((r, i) => (r[0] === 0 ? i : -1)).filter((i) => i >= 0);
  const by = (f) => rows.reduce((b, r, i) => (f(r) > f(rows[b]) ? i : b), 0); // first day of the most
  const at = (mmdd) => rows.findIndex((r, i) => ymd(year, i).endsWith(mmdd));
  const exin = D.people - D.pop.IN;
  const may = rows[at('-05-01')], jan = rows[0];
  const maxDay = by((r) => r[0]), topDay = by((r) => r[2]);
  m[year] = {
    zero: zero.length,
    zero_weekdays: zero.filter((i) => wd(year, i) < 5).length,
    zero_any: rows.filter((r) => r[1] === 0).length,
    zero_sure: rows.filter((r) => r[0] === 0 && r[4]).length,
    median_nat: mid(rows.map((r) => r[0])),
    one: rows.filter((r) => r[0] === 1).length,
    max_nat: rows[maxDay][0],
    max_day: ymd(year, maxDay),
    median_people: mid(rows.map((r) => r[2] / D.people)),
    top_day: ymd(year, topDay),
    top_people: rows[topDay][2] / D.people,
    may1: may[2] / D.people,
    jan1: jan[2] / D.people,
    may1_exin: (may[2] - may[3]) / exin,
    jan1_exin: (jan[2] - jan[3]) / exin,
    zero_days: zero.map((i) => ymd(year, i)),
  };
  return m[year];
}

/* -> {X, Y, base, room, bars: [{x,y,w,h,n,cls,day}]} in px of w x h */
export function layout(name, D, w, h) {
  if (!STEPS[name]) throw new Error(`unknown step ${name}`);
  const rows = D.days[String(D.year)], n = rows.length;
  const pad = 8, mark = 14;
  const X = (i) => pad + (i / n) * (w - 2 * pad);
  const base = h - pad - (name === 'zero' ? mark : 0), room = base - pad - 20;
  const most = Math.max(...rows.map((r) => r[0]));
  const Y = name === 'people' ? (v) => base - room * v : (v) => base - (room * v) / most;
  const bw = Math.max(1, (X(1) - X(0)) * 0.8);
  const bars = [];
  rows.forEach((r, i) => {
    const x = X(i) + (X(1) - X(0) - bw) / 2, day = ymd(D.year, i);
    if (name === 'people') {
      if (!r[2]) return;
      const v = r[2] / D.people, vi = r[3] / D.people;
      bars.push({ x, y: Y(v), w: bw, h: base - Y(v), n: r[2], cls: 'bar', day });
      if (r[3]) bars.push({ x, y: Y(vi), w: bw, h: base - Y(vi), n: r[3], cls: 'hit', day });
    } else if (r[0]) bars.push({ x, y: Y(r[0]), w: bw, h: base - Y(r[0]), n: r[0], cls: 'bar', day });
    else if (name === 'zero') bars.push({ x: X(i), y: base + 3, w: Math.max(2, X(1) - X(0)), h: mark - 4, n: 0, cls: 'hit', day });
  });
  return { kind: name, X, Y, base, room, most, bars };
}
