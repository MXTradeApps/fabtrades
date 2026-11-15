/**
 * Helpers for the Collection Stats "Value over time" chart. Rows come from
 * `fab_collection_value_history`: `{ captured_on, total_value }`, oldest first.
 */

/** Rows as `{ date, value }` points, oldest first, dropping unusable rows. */
export function valueHistoryPoints(rows) {
    const points = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        const date = String(row?.captured_on || '').slice(0, 10);
        const value = Number(row?.total_value);
        if (!date || row?.total_value == null || !Number.isFinite(value)) continue;
        points.push({ date, value });
    }
    return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The points from the last [days] days, counted back from the newest point. */
export function lastDays(points, days) {
    if (!points.length) return [];
    const newest = new Date(`${points[points.length - 1].date}T00:00:00Z`);
    const cutoff = new Date(newest.getTime() - days * 86400000).toISOString().slice(0, 10);
    return points.filter((p) => p.date >= cutoff);
}

/**
 * Change from the first to the last point: `{ start, latest, amount, ratio }`.
 * `ratio` is null when the start is 0. Null with fewer than two points.
 */
export function valueChange(points) {
    if (!points || points.length < 2) return null;
    const start = points[0].value;
    const latest = points[points.length - 1].value;
    const amount = latest - start;
    return { start, latest, amount, ratio: start > 0 ? amount / start : null };
}

/** How many days the points span, first to last. */
export function spanDays(points) {
    if (!points || points.length < 2) return 0;
    const first = new Date(`${points[0].date}T00:00:00Z`).getTime();
    const last = new Date(`${points[points.length - 1].date}T00:00:00Z`).getTime();
    return Math.round((last - first) / 86400000);
}
