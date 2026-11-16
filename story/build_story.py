#!/usr/bin/env python3
"""site/data/holidays.json + data/countryInfo.txt -> site/story/story.json: the days nobody is off.

    python3 build_story.py          # BUILD_OUT=... writes elsewhere (publish.sh compares)

Every day of both years the page ships, counted the way the page counts a day:
site/off-logic.js's on(), a country off when it has a nationwide holiday (a row with no
subdivision list) that day. Per day:

  nat     countries with a nationwide holiday
  any     countries with any holiday, nationwide or only in some regions
  people  people (GeoNames population) whose country has a nationwide holiday that day
          AND it is a working day there: not the country's weekend, or a weekend the
          government made a working day (holidays.json "work")
  india   the part of `people` that is India
  sure    1 if no nationwide holiday is on that day or a day either side of it that the
          library marks "(estimated)": a day with nat 0 and sure 1 stays empty however the
          moon moves an estimated Islamic date by a day

test/story.test.mjs re-counts every day with the page's own on() and requires the same.
"""
import datetime as dt
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
HOLS = os.path.join(HERE, "site", "data", "holidays.json")
POPS = os.path.join(HERE, "data", "countryInfo.txt")
OUT = os.environ.get("BUILD_OUT", os.path.join(HERE, "site", "story", "story.json"))
YEAR = 2026


def populations(codes):
    pop = {}
    for line in open(POPS, encoding="utf-8"):
        if line.startswith("#"):
            continue
        f = line.rstrip("\n").split("\t")
        if f[0] in codes:
            pop[f[0]] = int(f[7] or 0)
    missing = sorted(set(codes) - set(pop))
    assert not missing, f"no GeoNames row for {missing}"
    return pop


def year_days(H, pop, year):
    first = dt.date(year, 1, 1)
    days = [first + dt.timedelta(i) for i in range((dt.date(year + 1, 1, 1) - first).days)]
    nat, anyh, est = {}, {}, set()
    for cc, rows in H["h"].items():
        for d, name, subs in rows:
            anyh.setdefault(d, set()).add(cc)
            if subs is None:
                nat.setdefault(d, set()).add(cc)
                if "(estimated)" in name:
                    t = dt.date.fromisoformat(d)
                    est.update((t + dt.timedelta(k)).isoformat() for k in (-1, 0, 1))
    out = []
    for t in days:
        s = t.isoformat()
        off = nat.get(s, set())
        working = [cc for cc in off if t.weekday() not in H["countries"][cc][1] or s in H["work"].get(cc, [])]
        out.append([len(off), len(anyh.get(s, ())), sum(pop[cc] for cc in working),
                    pop["IN"] if "IN" in working else 0, int(s not in est)])
    return out


def check(D):
    """layout.js stats(), done again here: the test requires the two to agree."""
    out = {}
    for y, rows in D["days"].items():
        first = dt.date(int(y), 1, 1)
        ymd = lambda i: (first + dt.timedelta(i)).isoformat()
        zero = [i for i, r in enumerate(rows) if r[0] == 0]
        nat = sorted(r[0] for r in rows)
        share = sorted(r[2] / D["people"] for r in rows)
        top = max(range(len(rows)), key=lambda i: (rows[i][2], -i))
        exin = D["people"] - D["pop"]["IN"]
        out[y] = {
            "zero": len(zero),
            "zero_weekdays": sum(1 for i in zero if (first + dt.timedelta(i)).weekday() < 5),
            "zero_any": sum(1 for r in rows if r[1] == 0),
            "zero_sure": sum(1 for r in rows if r[0] == 0 and r[4]),
            "median_nat": nat[(len(nat) - 1) // 2],
            "one": sum(1 for r in rows if r[0] == 1),
            "max_nat": nat[-1],
            "max_day": ymd(max(range(len(rows)), key=lambda i: (rows[i][0], -i))),
            "median_people": share[(len(share) - 1) // 2],
            "top_day": ymd(top),
            "top_people": rows[top][2] / D["people"],
            "may1": rows[(dt.date(int(y), 5, 1) - first).days][2] / D["people"],
            "jan1": rows[0][2] / D["people"],
            "may1_exin": (lambda r: (r[2] - r[3]) / exin)(rows[(dt.date(int(y), 5, 1) - first).days]),
            "jan1_exin": (rows[0][2] - rows[0][3]) / exin,
        }
    return out


def main():
    H = json.load(open(HOLS))
    pop = populations(H["countries"])
    D = {
        "source": f"holidays: python-holidays {H['version']}, as the page ships them in site/data/; "
                  "people: GeoNames countryInfo (CC BY 4.0), https://www.geonames.org/",
        "year": YEAR, "years": H["years"], "n_countries": len(H["countries"]),
        "people": sum(pop.values()), "pop": pop,
        "cols": ["nationwide", "any", "people off on a working day", "of them India", "sure"],
        "days": {str(y): year_days(H, pop, y) for y in H["years"]},
    }
    D["check"] = check(D)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(D, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    for y, c in D["check"].items():
        print(y, "  ".join(f"{k} {v:.4f}" if isinstance(v, float) else f"{k} {v}" for k, v in c.items()))


if __name__ == "__main__":
    main()
