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

Built by Claude for [matmat202](https://matmat202.github.io/).
