/**
 * Observed Low series for one Printing's price-history chart.
 * Golden cases: packages/contracts/price_history_series.json
 *
 * Snapshot rows stay snapshots. This helper names the marketplace Low, the
 * clipped window, and the derived delta. Null Low is a gap, never 0.
 */

export const PRICE_HISTORY_WINDOW = {
    last30: 'last30',
    full: 'full',
};

/** Calendar day only — never UTC midnight of a YYYY-MM-DD string. */
export function dateOnly(value) {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const s = String(value ?? '').slice(0, 10);
    const [year, month, day] = s.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function formatDateOnly(value) {
    const d = dateOnly(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Inclusive start of the 30-calendar-day window (today minus 29 days). */
export function windowStartFor(now = new Date()) {
    const today = dateOnly(now);
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
}

const lowFor = (snap, source) => {
    const raw = source === 'cardmarket' ? snap?.cm_low : snap?.tcg_low;
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
};

export function observations(snapshots, source) {
    const out = [];
    for (const snap of snapshots || []) {
        const low = lowFor(snap, source);
        if (low === null) continue;
        out.push({ date: formatDateOnly(snap.captured_on), low });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out;
}

/**
 * Visible Low series for the history chart.
 *
 * @param {object} opts
 * @param {object[]} opts.snapshots rows with captured_on + nullable tcg_low / cm_low
 * @param {'tcgplayer'|'cardmarket'} opts.source
 * @param {boolean} [opts.isPro]
 * @param {'last30'|'full'} [opts.window]
 * @param {Date|string} [opts.now]
 */
export function priceHistorySeries({
    snapshots,
    source,
    isPro = false,
    window = PRICE_HISTORY_WINDOW.last30,
    now = new Date(),
} = {}) {
    const windowStart = windowStartFor(now);
    const windowStartKey = formatDateOnly(windowStart);
    const all = observations(snapshots, source);
    const hasOlder = all.some((o) => o.date < windowStartKey);
    const points = window === PRICE_HISTORY_WINDOW.full
        ? all
        : all.filter((o) => o.date >= windowStartKey);
    const chartable = points.length >= 2;
    const delta = chartable ? points[points.length - 1].low - points[0].low : null;
    return {
        window,
        windowStart: windowStartKey,
        points,
        hasOlder,
        isPro: Boolean(isPro),
        chartable,
        delta,
        showSpanControl: Boolean(isPro) && hasOlder && chartable,
    };
}

export function formatObservedLow(value, source) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (source === 'cardmarket') return `€${n.toFixed(2)}`;
    return `$${n.toFixed(2)}`;
}

export function changeLabel(series, source) {
    if (!series?.chartable || series.delta == null) return null;
    if (series.delta === 0) return 'Low unchanged';
    const amount = formatObservedLow(Math.abs(series.delta), source);
    return series.delta > 0 ? `Low up ${amount}` : `Low down ${amount}`;
}

export function emptyHistoryCopy(snapshots, source) {
    const other = source === 'cardmarket' ? 'tcgplayer' : 'cardmarket';
    const otherChartable = priceHistorySeries({
        snapshots,
        source: other,
        isPro: true,
        window: PRICE_HISTORY_WINDOW.full,
    }).chartable;
    if (otherChartable) {
        const label = source === 'cardmarket' ? 'CardMarket' : 'TCGplayer';
        return `History isn't available for ${label} yet`;
    }
    return 'History not available yet';
}

export function formatHistoryDate(value) {
    return dateOnly(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}
