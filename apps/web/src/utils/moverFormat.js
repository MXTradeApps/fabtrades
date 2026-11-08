/**
 * Money and percent labels for mover rows and boxes. Always two decimals so
 * prices read as $4.20, never $4.2.
 */
export const formatMoverMoney = (amount, priceSource) => {
    if (priceSource === 'cardmarket') {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

/** Signed money change: +$8.40 / −$3.13 (true minus sign). */
export const formatMoverAmount = (amount, priceSource) =>
    `${amount >= 0 ? '+' : '−'}${formatMoverMoney(Math.abs(amount), priceSource)}`;

/** Ratio 0.5 → "+50%", -0.034 → "−3.4%". */
export const formatMoverPercent = (ratio) => {
    const pct = ratio * 100;
    const digits = Math.abs(pct) >= 10 ? 0 : 1;
    return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(digits)}%`;
};

/** Daily Lows for the sparkline, ending on the current Low. */
export const sparklineValues = (history, latestLow) => {
    const values = (Array.isArray(history) ? history : []).map(Number).filter(Number.isFinite);
    const latest = Number(latestLow);
    if (Number.isFinite(latest) && values[values.length - 1] !== latest) values.push(latest);
    return values;
};
