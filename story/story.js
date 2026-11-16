/* The scrolling story: each <section class="step"> names a layout in data-step; as the
 * reader scrolls into a step, the bars move to their place in that layout. Numbers in
 * the prose are not typed in: a <b data-fact="..."> is computed here from story.json's
 * days, and test/story.test.mjs checks each against the `check` block build_story.py
 * computed in python. Modelled on when-works/site/story. */
import { layout, stats, STEPS } from './layout.js';

const fmt = (n) => n.toLocaleString('en-US');
const pct = (v) => `${Math.round(v * 100)}%`;
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/* "2026-03-10" -> "Tuesday 10 March" */
export const longDay = (s) => { const t = new Date(`${s}T00:00:00Z`); return `${WDL[t.getUTCDay()]} ${t.getUTCDate()} ${MON[t.getUTCMonth()]}`; };
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export const inWords = (n) => words[n] || fmt(n);

/* "zero:2027" -> "19". Unknown names throw: a typo must not render as blank */
export function fact(D, spec) {
  const [f, y = String(D.year)] = spec.split(':');
  const S = stats(D, y);
  switch (f) {
    case 'n_countries': return fmt(D.n_countries);
    case 'year': return String(D.year);
    case 'next_year': return String(D.year + 1);
    case 'billion': return `${(D.people / 1e9).toFixed(1)} billion`;
    case 'zero': case 'zero_weekdays': case 'zero_any': case 'zero_sure': case 'median_nat': case 'one': case 'max_nat': return fmt(S[f]);
    case 'zero_words': return inWords(S.zero);
    case 'max_day': case 'top_day': return longDay(S[f]);
    case 'median_people': return `${(S[f] * 100).toFixed(1)}%`;
    case 'top_people': case 'may1': case 'jan1': case 'may1_exin': case 'jan1_exin': return pct(S[f]);
    case 'zero_list': return S.zero_days.filter((d) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return w > 0 && w < 6; }).map(longDay).join(', ');
    default: throw new Error(`unknown fact ${spec}`);
  }
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

async function main() {
  const D = await (await fetch('story.json')).json();
  for (const e of document.querySelectorAll('[data-fact]')) e.textContent = fact(D, e.dataset.fact);
  const steps = [...document.querySelectorAll('.step')];
  for (const s of steps) if (!STEPS[s.dataset.step]) throw new Error(`unknown step ${s.dataset.step}`);
  const plot = document.getElementById('plot');
  const svg = el('svg', { id: 'chart' });
  const gAxis = el('g', { class: 'axis' }), gS = el('g');
  svg.append(gAxis, gS);
  plot.append(svg);
  const tick = (x, y, text, cls = 'tick') => { const t = el('text', { x, y, class: cls }); t.textContent = text; gAxis.append(t); };
  const grid = (x1, y1, x2, y2, cls = 'grid') => gAxis.append(el('line', { x1, x2, y1, y2, class: cls }));

  let shown = -1;
  const draw = (i) => {
    const name = steps[i].dataset.step;
    const box = plot.getBoundingClientRect(), W = box.width, H = box.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const L = layout(name, D, W, H);
    gS.replaceChildren();
    for (const b of L.bars) {
      const e = gS.appendChild(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, class: b.cls }));
      e.append(el('title'));
      e.firstChild.textContent = name === 'people'
        ? `${longDay(b.day)}: ${(b.n / 1e6).toFixed(0)} million people${b.cls === 'hit' ? ' in India' : ''}`
        : b.n ? `${longDay(b.day)}: ${fmt(b.n)} countries` : `${longDay(b.day)}: no country`;
    }
    gAxis.replaceChildren();
    const narrow = W < 420;
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    for (let m = 0; m < 12; m++) {
      const i0 = Math.round((Date.UTC(D.year, m, 1) - Date.UTC(D.year, 0, 1)) / 86400000);
      grid(L.X(i0), L.base - L.room, L.X(i0), L.base);
      tick(L.X(i0) + 2, L.base + (name === 'zero' ? 30 : 16), narrow ? months[m] : MON[m].slice(0, 3));
    }
    if (name === 'people') {
      for (const v of [0.5, 1]) { grid(L.X(0), L.Y(v), L.X(L.bars.length ? 365 : 0), L.Y(v), 'grid level'); tick(L.X(0) - 4, L.Y(v) + 4, pct(v), 'tick end'); }
      tick(L.X(0), L.base - L.room - 8, narrow ? 'share of people off (India red)' : `share of the world off on a working day, ${D.year} (India in red)`, 'tick cat');
    } else {
      for (const v of [100, 200]) if (v <= L.most) { grid(L.X(0), L.Y(v), L.X(365), L.Y(v), 'grid level'); tick(L.X(0) - 4, L.Y(v) + 4, String(v), 'tick end'); }
      tick(L.X(0), L.base - L.room - 8, name === 'zero'
        ? (narrow ? 'red: no country off' : `red: the days in ${D.year} no country has a public holiday`)
        : (narrow ? 'countries off, each day' : `countries with a nationwide public holiday, each day of ${D.year}`), 'tick cat');
    }
    document.body.dataset.step = i;
    window.__story = { step: i, name, shown: L.bars.length };
  };

  const pick = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    if (i !== shown) { shown = i; draw(i); }
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', () => { shown = -1; pick(); });
  pick();
}

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});
