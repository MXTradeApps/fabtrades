/**
 * Binder tile cover pick. Golden cases: packages/contracts/binder_cover.json
 *
 * Same source/headline split as binderValueSnapshot.js. Web Binder tiles use
 * tcgMarketOnly by default.
 */
import { isPricedField } from './binderValueSnapshot.js';

const firstPriced = (values) => {
    for (const value of values) {
        if (isPricedField(value)) return Number(value);
    }
    return null;
};

const sourceValue = (row, source, headline) => {
    if (headline === 'tcgMarketOnly') return firstPriced([row.tcgMarket]);
    if (source === 'cardmarket') {
        if (row.isFoil) {
            return firstPriced([row.cmTrendFoil, row.cmTrend, row.cmAvg, row.cmLow]);
        }
        return firstPriced([row.cmTrend, row.cmAvg, row.cmLow]);
    }
    return firstPriced([row.tcgMarket, row.tcgLow, row.tcgMid, row.tcgHigh]);
};

const byNameIdCondition = (a, b) => {
    const byName = String(a.name || '').localeCompare(String(b.name || ''));
    if (byName !== 0) return byName;
    const byId = String(a.printingId || '').localeCompare(String(b.printingId || ''));
    if (byId !== 0) return byId;
    return String(a.condition || '').localeCompare(String(b.condition || ''));
};

/**
 * @param {Array<Object>} entries - catalog-shaped rows (quantity, prices, name, printingId)
 * @param {{ source?: string, headline?: string }} [opts]
 * @returns {{ printingId: string|null, condition: string|null }}
 */
export function pickBinderCover(entries, { source = 'tcgplayer', headline = 'tcgMarketOnly' } = {}) {
    const rows = (entries || []).filter((row) => (Number(row.quantity) || 0) >= 1);
    if (rows.length === 0) return { printingId: null, condition: null };

    const coverOf = (row) => ({
        printingId: row.printingId,
        condition: row.condition || null,
    });

    const priced = [];
    for (const row of rows) {
        const value = sourceValue(row, source, headline);
        if (!isPricedField(value)) continue;
        priced.push({ row, contribution: Number(value) * row.quantity });
    }
    if (priced.length === 0) {
        const ranked = [...rows].sort(byNameIdCondition);
        return coverOf(ranked[0]);
    }
    priced.sort((a, b) => {
        const byContrib = b.contribution - a.contribution;
        if (byContrib !== 0) return byContrib;
        return byNameIdCondition(a.row, b.row);
    });
    return coverOf(priced[0].row);
}

export const TRADE_BINDER_ID = 'system:trade';
export const COLLECTION_BINDER_ID = 'system:collection';
