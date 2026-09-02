/**
 * Recent movers ranking helpers. Production lists come from SQL
 * `fab_recent_movers`; this module exists so `packages/contracts/recent_movers.json`
 * can fail a build when JS drifts from Dart / SQL.
 *
 * Names distinguish observed start Low, observed latest Low, and derived
 * percent/amount. Null Lows are omitted, never treated as 0.
 */

const START_LOW_FLOOR = 1;
const MAX_OBSERVED_LOW = 10000;
const MAX_ABS_PERCENT_CHANGE = 10;
const MAX_MOVERS_PER_DIRECTION = 10;

const lowColumnForSource = {
    tcgplayer: 'tcg_low',
    cardmarket: 'cm_low',
};

function assertSource(source) {
    if (source !== 'tcgplayer' && source !== 'cardmarket') {
        throw new Error(`recent movers source must be tcgplayer or cardmarket, got ${source}`);
    }
}

function asNumber(value) {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

function lowForSource(source, row) {
    assertSource(source);
    return asNumber(row?.[lowColumnForSource[source]]);
}

function shiftDate(ymd, days) {
    const [year, month, day] = ymd.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

/** Inclusive start-Low window: `[today - 5 days, today - 3 days]`. */
export function startLowWindow(today) {
    return {
        from: shiftDate(today, -5),
        to: shiftDate(today, -3),
    };
}

function compareCardId(a, b) {
    if (a.card_id < b.card_id) return -1;
    if (a.card_id > b.card_id) return 1;
    return 0;
}

/**
 * Observed start Low vs latest Low for one Printing. No floor, no sealed
 * filter, no rank cut — those belong to [rankRecentMovers] only.
 */
function observedPrintingRecentChange({ today, source, snapshots, current, cardId }) {
    if (current == null) return null;
    const latestLow = lowForSource(source, current);
    if (latestLow == null) return null;

    const { from, to } = startLowWindow(today);
    let startOn = null;
    let startLow = null;
    for (const snap of snapshots || []) {
        const capturedOn = snap?.captured_on;
        if (!capturedOn || capturedOn < from || capturedOn > to) continue;
        const low = lowForSource(source, snap);
        if (low == null) continue;
        if (startOn == null || capturedOn > startOn) {
            startOn = capturedOn;
            startLow = low;
        }
    }
    if (startOn == null || startLow == null) return null;
    if (startLow > MAX_OBSERVED_LOW || latestLow > MAX_OBSERVED_LOW) return null;
    if (latestLow === startLow) return null;

    const amountChange = latestLow - startLow;
    const percentChange = amountChange / startLow;
    if (Math.abs(percentChange) > MAX_ABS_PERCENT_CHANGE) return null;
    return {
        card_id: cardId,
        start_on: startOn,
        start_low: startLow,
        latest_low: latestLow,
        percent_change: percentChange,
        amount_change: amountChange,
    };
}

/**
 * Rank eligible Printings by percent change of observed Low.
 *
 * @param {object} params
 * @param {string} params.today YYYY-MM-DD
 * @param {'tcgplayer'|'cardmarket'} params.source
 * @param {Record<string, Array<object>>} params.snapshotsByCard
 * @param {Record<string, object>} params.currentLows `{ tcg_low, cm_low, is_sealed }`
 */
export function rankRecentMovers({ today, source, snapshotsByCard, currentLows }) {
    assertSource(source);
    const eligible = [];

    for (const [cardId, current] of Object.entries(currentLows || {})) {
        if (current?.is_sealed) continue;
        const change = observedPrintingRecentChange({
            today,
            source,
            snapshots: snapshotsByCard?.[cardId],
            current,
            cardId,
        });
        if (!change) continue;
        if (change.start_low < START_LOW_FLOOR) continue;
        eligible.push(change);
    }

    const gainers = eligible
        .filter((row) => row.percent_change > 0)
        .sort((a, b) => (b.percent_change - a.percent_change) || compareCardId(a, b))
        .slice(0, MAX_MOVERS_PER_DIRECTION);
    const losers = eligible
        .filter((row) => row.percent_change < 0)
        .sort((a, b) => (a.percent_change - b.percent_change) || compareCardId(a, b))
        .slice(0, MAX_MOVERS_PER_DIRECTION);

    return { gainers, losers };
}

/**
 * Displayable recent Low change for requested Printing ids. No floor, no
 * top-10, no sealed extra-filter. Ids not in [cardIds] are ignored.
 *
 * @param {object} params
 * @param {string} params.today YYYY-MM-DD
 * @param {'tcgplayer'|'cardmarket'} params.source
 * @param {Record<string, Array<object>>} params.snapshotsByCard
 * @param {Record<string, object>} params.currentLows
 * @param {string[]} params.cardIds
 */
export function lookupPrintingRecentChanges({
    today,
    source,
    snapshotsByCard,
    currentLows,
    cardIds,
}) {
    assertSource(source);
    if (cardIds == null) {
        throw new Error('lookupPrintingRecentChanges: cardIds must not be null');
    }
    const seen = new Set();
    const overlays = [];
    for (const cardId of cardIds) {
        if (seen.has(cardId)) continue;
        seen.add(cardId);
        const change = observedPrintingRecentChange({
            today,
            source,
            snapshots: snapshotsByCard?.[cardId],
            current: currentLows?.[cardId],
            cardId,
        });
        if (change) overlays.push(change);
    }
    return overlays;
}

function printingId(entry) {
    return entry?.cardId || entry?.card_id || entry?.card?.id || null;
}

/**
 * Sums quantity per Printing id for a **pre-filtered** Binder list.
 * Display only — not a rank key and not sent to SQL.
 *
 * Callers MUST filter to the open Binder first. Do not change
 * [ownedPrintingIds] to take a binder id.
 */
export function copiesByPrintingId(entries) {
    const copies = new Map();
    for (const entry of entries || []) {
        if (entry?.isWanted || entry?.is_wanted) continue;
        if (entry?.deletedAt || entry?.deleted_at) continue;
        const qty = Number(entry?.quantity) || 0;
        if (qty <= 0) continue;
        const id = printingId(entry);
        if (!id) continue;
        copies.set(id, (copies.get(id) || 0) + qty);
    }
    return Object.fromEntries(copies);
}

/**
 * Distinct owned Printing ids: qty > 0 in any Binder, not Want List, not
 * tombstoned. Same Printing in two Binders or two conditions is one id.
 */
export function ownedPrintingIds(entries) {
    const ids = new Set();
    for (const entry of entries || []) {
        if (entry?.isWanted || entry?.is_wanted) continue;
        if (entry?.deletedAt || entry?.deleted_at) continue;
        const qty = Number(entry?.quantity) || 0;
        if (qty <= 0) continue;
        const id = printingId(entry);
        if (id) ids.add(id);
    }
    return [...ids];
}

export function splitMoversByDirection(rows) {
    const gainers = [];
    const losers = [];
    for (const row of rows || []) {
        if (row?.direction === 'gainer') gainers.push(row);
        else if (row?.direction === 'loser') losers.push(row);
    }
    return { gainers, losers };
}
