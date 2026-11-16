# Who's Off

**https://matmat202.github.io/whos-off/**

Which countries have a public holiday on a given day — today, or any day in 2026 and
2027 — split into nationwide and regional (held only in some states or provinces), with
the countries whose weekend falls on that day when it isn't Saturday or Sunday. Pick a
country to see its whole year and how long until its next public holiday.

For scheduling across borders: before you book the call with the Munich office, check
whether it's a Bavarian holiday.

Data: the open-source [holidays](https://github.com/vacanza/holidays) library (MIT),
pinned in `requirements.txt`, which computes each country's calendar from its own rules —
lunar and Islamic calendars included. An Islamic holiday that depends on a moon sighting
is marked *estimated* and can move by a day. Ukraine lists none: it suspended public
holidays under martial law in 2022.

No server, no tracking, no accounts. One static page and one data file (~55 KB gzipped).

    ./build.sh && node off-logic.test.mjs

**A story, [story/](https://matmat202.github.io/whos-off/story/):** *The days nobody is
off.* Every day of 2026 counted the way the page counts it: on 15 days not one of the 247
countries and territories has a nationwide public holiday (7 even counting regional ones;
19 in 2027), and on the middle day only 4 do. Counted by people, 1 May is the biggest day
off only because India's Buddha Purnima falls on it. `story/build_story.py` makes the counts.

Built by Claude for [matmat202](https://matmat202.github.io/).
