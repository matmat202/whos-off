// node site/off-logic.test.mjs — the page's pure logic, plus the shipped data checked
// against facts read straight out of the `holidays` library. Exit 1 on any failure.
//   test/plant.sh   # mutates a copy of the logic; each mutant must FAIL this suite
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const L = await import(process.env.LOGIC ? pathToFileURL(process.env.LOGIC).href : './off-logic.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${extra}`); } };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

// --- dates -----------------------------------------------------------------------------
eq('weekday, Monday = 0', ['2026-10-26', '2026-10-31', '2026-11-01'].map(L.weekday), [0, 5, 6]);
eq('add days across a month and a year', [L.addDays('2026-10-31', 1), L.addDays('2026-12-31', 1), L.addDays('2026-03-01', -1)],
  ['2026-11-01', '2027-01-01', '2026-02-28']);
eq('days between, both ways', [L.daysBetween('2026-10-26', '2026-12-25'), L.daysBetween('2026-12-25', '2026-10-26')], [60, -60]);
eq('across a DST change is still one day', L.addDays('2026-03-08', 1), '2026-03-09');
eq('a real date passes, a fake one fails', ['2026-02-28', '2026-02-29', '2026-13-01', '26-1-1', 'x'].map(L.isDate), [true, false, false, false, false]);
eq('local today', L.localToday(new Date(2026, 9, 26, 23, 30)), '2026-10-26');
eq('dates format', [L.fmtDate('2026-10-26'), L.fmtDate('2026-12-25', true)], ['Mon 26 Oct', 'Friday 25 December 2026']);
eq('in words', [0, 1, -1, 60, -3].map(L.inWords), ['today', 'tomorrow', 'yesterday', 'in 60 days', '3 days ago']);
eq('flags', [L.flag('DE'), L.flag('jp')], ['🇩🇪', '🇯🇵']);
eq('regions label', [L.regionsLabel(['A']), L.regionsLabel(['A', 'B']), L.regionsLabel(['A', 'B', 'C']), L.regionsLabel(['A', 'B', 'C', 'D', 'E'])],
  ['A', 'A and B', 'A, B and C', 'A, B, C and 2 more']);

// --- a made-up world -------------------------------------------------------------------
const fake = {
  years: [2026],
  countries: { AA: ['Alpha', [5, 6]], BB: ['Bravo', [4, 5]], CC: ['Charlie', [5, 6]], DD: ['Delta', [6]] },
  sub: { CC: { N: 'North', S: 'South' } },
  h: {
    AA: [['2026-05-01', 'Labour Day', null], ['2026-05-01', 'Saint Day', null], ['2026-06-01', 'June Day', null]],
    BB: [['2026-05-01', 'Workers Day', null]],
    CC: [['2026-05-01', 'Northern Day', ['N', 'S']], ['2026-05-02', 'South Day', ['S']], ['2026-07-01', 'Charlie Day', null]],
    DD: [],
  },
  work: { AA: ['2026-05-02'], BB: ['2026-05-08'] },
};
const fi = L.index(fake);
{
  const o = L.on(fake, fi, '2026-05-01'); // a Friday
  eq('national holidays, by country name', o.national.map((x) => x.cc), ['AA', 'BB']);
  eq('two on one day become one entry', o.national[0].name, 'Labour Day · Saint Day');
  eq('regional names its subdivisions', o.regional, [{ cc: 'CC', name: 'Northern Day', subs: ['North', 'South'] }]);
  eq('on a Friday, the Friday-weekend countries', o.weekend, ['BB']);
  eq('no working-weekend list on a weekday', o.working, []);
  const sat = L.on(fake, fi, '2026-05-02');
  eq('no weekend list on a Saturday', sat.weekend, []);
  eq('a Sunday is a working day where the weekend is Fri–Sat', L.on(fake, fi, '2026-05-03').working, ['BB']);
  eq('a Saturday is a working day where the weekend is Sunday only, or it is a make-up day', sat.working, ['AA', 'DD']);
  eq('the make-up day is named as one', sat.makeup, ['AA']);
  eq('a make-up Friday drops out of the weekend list', L.on(fake, fi, '2026-05-08').weekend, []);
  eq('a make-up day counts only on its date', [L.on(fake, fi, '2026-05-09').working, L.on(fake, fi, '2026-05-09').makeup, L.on(fake, fi, '2026-05-15').weekend], [['DD'], [], ['BB']]);
  eq('no make-up data, no make-up days', L.on({ ...fake, work: undefined }, fi, '2026-05-02').working, ['DD']);
  eq('an empty day is empty', L.on(fake, fi, '2026-05-05').national, []);
}
eq('upcoming from a date, with distance', L.upcoming(fake, 'CC', '2026-05-02'),
  [{ date: '2026-05-02', name: 'South Day', subs: ['South'], away: 0 }, { date: '2026-07-01', name: 'Charlie Day', subs: null, away: 60 }]);
eq('next national skips regional ones', L.nextNational(fake, 'CC', '2026-04-01').date, '2026-07-01');
eq('no next for a country with none', L.nextNational(fake, 'DD', '2026-01-01'), null);
eq('search: code, prefix, word, substring', L.findCountries(fake, 'bb').map((c) => c.cc), ['BB']);
eq('search by name prefix', L.findCountries(fake, 'char').map((c) => c.cc), ['CC']);
eq('search by substring', L.findCountries(fake, 'lt').map((c) => c.cc), ['DD']);
eq('upcoming stops at n', L.upcoming(fake, 'AA', '2026-01-01', 2).map((x) => x.name), ['Labour Day', 'Saint Day']);
{ // A country off nationwide is not listed again as regional for a local holiday that day.
  const both = { ...fake, h: { ...fake.h, AA: [...fake.h.AA, ['2026-05-01', 'Local Fair', ['N']]] } };
  eq('national beats regional on the same day', L.on(both, L.index(both), '2026-05-01').regional.map((r) => r.cc), ['CC']);
}
eq('search for nothing', L.findCountries(fake, '  '), []);
eq('range', L.range(fake), { first: '2026-01-01', last: '2026-12-31' });
eq('state: today is not written', L.encodeState({ date: '2026-05-01', cc: null }, '2026-05-01'), '');
eq('state round-trips', L.decodeState(L.encodeState({ date: '2026-05-02', cc: 'CC' }, '2026-05-01'), fake, '2026-05-01'), { date: '2026-05-02', cc: 'CC' });
eq('state: an unknown country and a bad date fall back', L.decodeState('?d=2026-02-30&c=ZZ', fake, '2026-05-01'), { date: '2026-05-01', cc: null });
eq('state: a today outside the data clamps into it', L.decodeState('', fake, '2030-01-01').date, '2026-12-31');

// --- long weekends (breaks) -------------------------------------------------------------
{
  const bw = {
    years: [2026], countries: { ZZ: ['Zulu', [5, 6]] }, sub: { ZZ: { N: 'North' } },
    h: { ZZ: [
      ['2026-01-01', 'New Year', null],      // Thu on the first day of data: its bridge touches the edge, dropped
      ['2026-05-01', 'May Day', null],       // Fri: Fri-Sun, 3 days
      ['2026-05-14', 'Ascension', null],     // Thu: take Fri off, 4 days
      ['2026-05-27', 'Midweek', null],       // Wed: nothing joins it
      ['2026-06-01', 'June Mon', null],      // Mon, but Sat 30 May is a make-up day: only 2 days
      ['2026-06-12', 'North Day', ['N']],    // regional Fri: not nationwide, not a long weekend
      ['2026-06-23', 'Midsummer', null],     // Tue: take Mon off, Sat-Tue
      ['2026-07-03', 'Founding', null],      // Fri: a 3-day weekend, and with Tue too, take Mon off for 5
      ['2026-07-07', 'Second', null],
    ] },
    work: { ZZ: ['2026-05-30'] },
  };
  const got = L.breaks(bw, 'ZZ', '2026-01-01').map((x) => [x.start, x.end, x.days, x.leave]);
  eq('long weekends and one-leave-day bridges, in order', got, [
    ['2026-05-01', '2026-05-03', 3, null], ['2026-05-14', '2026-05-17', 4, '2026-05-15'],
    ['2026-06-20', '2026-06-23', 4, '2026-06-22'], ['2026-07-03', '2026-07-05', 3, null],
    ['2026-07-03', '2026-07-07', 5, '2026-07-06']]);
  eq('a break still running on the date is kept, an ended one is not', L.breaks(bw, 'ZZ', '2026-05-16').map((x) => x.start)[0], '2026-05-14');
  eq('an unknown country has none', L.breaks(bw, 'QQ', '2026-01-01'), []);
  // no country ships a 3-day weekend today; one that did must not list every weekend
  eq('a Fri-Sun weekend with no holiday is not a long weekend', L.breaks({ ...bw, countries: { YY: ['Yankee', [4, 5, 6]] }, h: { YY: [] }, work: {} }, 'YY', '2026-01-01'), []);
}

// --- the shipped data, against the library ---------------------------------------------
const here = fileURLToPath(new URL('.', import.meta.url));
const D = JSON.parse(readFileSync(here + 'data/holidays.json', 'utf8'));
// The search's tiers, written out again from its comment: exact code, name prefix, word
// prefix, substring, then by name — checked for every two-letter query over the shipped
// countries, so a tie between tiers shows wherever names happen to sort across it.
{
  const tier = (cc, name, t) => { const l = name.toLowerCase(); return cc.toLowerCase() === t ? 0 : l.startsWith(t) ? 1 : l.split(/[\s-]+/).some((w) => w.startsWith(t)) ? 2 : l.includes(t) ? 3 : 9; };
  const bad = [];
  for (const a of 'abcdefghijklmnopqrstuvwxyz') for (const b of 'abcdefghijklmnopqrstuvwxyz') {
    const t = a + b, got = L.findCountries(D, t);
    const want = Object.entries(D.countries).map(([cc, [name]]) => ({ cc, name, s: tier(cc, name, t) })).filter((c) => c.s < 9)
      .sort((x, y) => x.s - y.s || x.name.localeCompare(y.name, 'en')).slice(0, 8).map((c) => c.cc);
    if (JSON.stringify(got.map((c) => c.cc)) !== JSON.stringify(want)) bad.push(t);
  }
  eq('shipped: search ranks code, prefix, word, substring, then name (676 queries)', bad.slice(0, 5), []);
  eq('shipped: eight results at most', L.findCountries(D, 'a').length, 8);
}
const idx = L.index(D);
const natOn = (cc, d) => (L.on(D, idx, d).national.find((x) => x.cc === cc) || {}).name;
// Each read from holidays 0.107 with country_holidays(cc, years=...).get(date):
eq('China, National Day', natOn('CN', '2026-10-01'), 'National Day');
eq('China, the week runs on: a substituted day off', natOn('CN', '2026-10-07'), 'Day off (substituted from 10/10/2026)');
eq('India, Republic Day', natOn('IN', '2026-01-26'), 'Republic Day');
eq('US, Thanksgiving', natOn('US', '2026-11-26'), 'Thanksgiving Day');
eq('Japan 2027, Constitution Day', natOn('JP', '2027-05-03'), 'Constitution Day');
eq('Saudi Arabia, National Day', natOn('SA', '2026-09-23'), 'National Day Holiday');
eq('Germany, Unity Day', natOn('DE', '2026-10-03'), 'German Unity Day');
eq('Christmas Day 2026 is national in 201 countries', L.on(D, idx, '2026-12-25').national.length, 201);
{
  const tx = L.on(D, idx, '2026-03-02').regional.find((x) => x.cc === 'US' && /Texas/.test(x.name));
  ok('Texas Independence Day is regional, in Texas, not national', tx && /Texas Independence/.test(tx.name) && tx.subs.includes('Texas')
    && !natOn('US', '2026-03-02'), JSON.stringify(tx));
  const ep = L.on(D, idx, '2026-01-06').regional.find((x) => x.cc === 'DE');
  eq('Epiphany in Germany: three states and Augsburg', ep && ep.subs, ['Augsburg', 'Baden-Württemberg', 'Bayern', 'Sachsen-Anhalt']);
}
eq('weekends: Iran Friday, Saudi Fri–Sat, US Sat–Sun', ['IR', 'SA', 'US'].map((c) => D.countries[c][1]), [[4], [4, 5], [5, 6]]);
ok('a Friday names Saudi Arabia and Iran as weekend', ['SA', 'IR'].every((c) => L.on(D, idx, '2026-10-30').weekend.includes(c)));
ok('a Sunday names Saudi Arabia and Iran as working', ['SA', 'IR'].every((c) => L.on(D, idx, '2026-11-01').working.includes(c)));
// make-up days, against the State Council's 2026 notice (国办发明电〔2025〕7号), not the library
ok('China works Sat 10 Oct and Sun 4 Jan 2026 (make-up days)', ['2026-10-10', '2026-01-04'].every((d) => L.on(D, idx, d).working.includes('CN') && L.on(D, idx, d).makeup.includes('CN')));
ok('China is off on an ordinary Saturday', !L.on(D, idx, '2026-10-17').working.includes('CN'));
ok('China is off on its National Day break, Sat 3 Oct', natOn('CN', '2026-10-03') && !L.on(D, idx, '2026-10-03').working.includes('CN'));
ok('every make-up day is on that country\'s weekend and in range', Object.entries(D.work).every(([cc, ds]) => ds.every((d) => L.inRange(D, d) && D.countries[cc][1].includes(L.weekday(d)))));
ok('Ukraine is kept, with nothing listed and a note', D.countries.UA && D.h.UA.length === 0 && L.NOTES.UA);
ok('two years, about 250 places', D.years.join() === '2026,2027' && Object.keys(D.countries).length > 200);
ok('every country has a name and a weekend', Object.values(D.countries).every(([n, w]) => n.length > 2 && w.length && w.every((x) => x >= 0 && x <= 6)));
ok('every row: a real date in range, a name, null or known subdivisions', Object.entries(D.h).every(([cc, rows]) => rows.every(([d, n, s]) =>
  L.inRange(D, d) && n && (s === null || s.every((x) => D.sub[cc] && D.sub[cc][x])))));
ok('rows are sorted by date', Object.values(D.h).every((rows) => rows.every((r, i) => !i || rows[i - 1][0] <= r[0])));

// long weekends, against the calendars themselves (not the library)
{
  const has = (cc, from, want) => L.breaks(D, cc, from).some((x) => x.start === want[0] && x.end === want[1] && x.leave === want[2]);
  ok('US: take the Friday after Thanksgiving off, Thu 26 - Sun 29 Nov 2026', has('US', '2026-10-28', ['2026-11-26', '2026-11-29', '2026-11-27']));
  ok('Japan: Golden Week 2027 is 7 days with Fri 30 Apr off', has('JP', '2026-10-28', ['2027-04-29', '2027-05-05', '2027-04-30']));
  ok('Germany: Ascension Thu 6 May 2027, take Fri off', has('DE', '2026-10-28', ['2027-05-06', '2027-05-09', '2027-05-07']));
  ok('Italy: Immacolata Tue 8 Dec 2026, take Mon off', has('IT', '2026-10-28', ['2026-12-05', '2026-12-08', '2026-12-07']));
  ok('UK: Christmas 2026 runs Fri 25 - Mon 28 Dec (Boxing Day observed)', has('GB', '2026-10-28', ['2026-12-25', '2026-12-28', null]));
  const bad = [];
  for (const cc of Object.keys(D.countries)) for (const x of L.breaks(D, cc, '2026-01-01')) {
    if (x.leave && (D.countries[cc][1].includes(L.weekday(x.leave)) || D.h[cc].some((r) => r[0] === x.leave && !r[2]))) bad.push(cc + x.leave);
    if (x.days !== L.daysBetween(x.start, x.end) + 1 || x.days < 3) bad.push(cc + x.start);
  }
  eq('every leave day is a working weekday, every span adds up', bad, []);
}

console.log(`${fail ? 'FAIL' : 'ok'} off-logic: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
