// Pure selection logic for the weekly pack, kept separate so it can be tested without a database.

/** How many times the price changed day to day over the last `days` entries. */
export const changes = (series, days) => {
  const s = series.slice(-(days + 1));
  let n = 0;
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) n++;
  return n;
};

/**
 * rows: [{id, name, printing, img, series}] where series is daily market price, oldest first.
 * Keeps only real moves: at least `minPrice` a week ago and at least `minChanges` separate
 * price changes inside the week. A single sale on a thinly traded card moves once and is dropped.
 */
export function pickMovers(rows, {risers = 3, fallers = 2, minPrice = 5, minChanges = 2} = {}) {
  const scored = rows
    .map((r) => {
      const series = r.series.filter((v) => Number.isFinite(v));
      const old = series[series.length - 8];
      const now = series[series.length - 1];
      return {...r, series, old, new: now, pct: (now - old) / old};
    })
    .filter((r) => r.series.length >= 8 && r.old >= minPrice && changes(r.series, 7) >= minChanges);
  // One printing per card name, so a foil and non-foil of the same card don't both appear.
  const unique = (list) => list.filter((r, i) => list.findIndex((o) => o.name === r.name) === i);
  const up = unique(scored.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct)).slice(0, risers);
  const down = unique(scored.filter((r) => r.pct < 0).sort((a, b) => a.pct - b.pct)).slice(0, fallers).reverse();
  const card = (r, tag) => ({tag, name: r.name, printing: r.printing, img: r.img, old: r.old, new: r.new, series: r.series});
  return [
    ...up.map((r, i) => card(r, i === 0 ? 'BIGGEST RISER' : 'RISER')),
    ...down.map((r, i) => card(r, i === down.length - 1 ? 'BIGGEST FALLER' : 'FALLER')),
  ];
}
