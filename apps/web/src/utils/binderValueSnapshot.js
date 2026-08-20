/**
 * Quantity-weighted Binder totals for the value overlay.
 * Golden cases: packages/contracts/binder_value_snapshot.json
 */

export const isPricedField = (value) => {
    if (value === null || value === undefined || value === '') return false;
    const n = Number(value);
    return n !== 0 && !Number.isNaN(n);
};

const firstPriced = (values) => {
    for (const value of values) {
        if (isPricedField(value)) return Number(value);
    }
    return null;
};

const foilAware = (row, foilKey, baseKey) =>
    row.isFoil ? firstPriced([row[foilKey], row[baseKey]]) : firstPriced([row[baseKey]]);

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

const sumField = (rows, pick) => {
    let amount = 0;
    let pricedCopies = 0;
    let unpricedCopies = 0;
    let anyPriced = false;
    for (const row of rows) {
        const value = pick(row);
        if (isPricedField(value)) {
            amount += Number(value) * row.quantity;
            pricedCopies += row.quantity;
            anyPriced = true;
        } else {
            unpricedCopies += row.quantity;
        }
    }
    return {
        amount: anyPriced ? amount : null,
        pricedCopies,
        unpricedCopies,
    };
};

/**
 * Map a web Binder row + live catalog Printing into the contract entry shape.
 * Missing/zero catalog numbers stay nullish so the snapshot can treat them as unpriced.
 */
export function snapshotEntryFromBinder(entry, live) {
    const card = live || entry.card || {};
    const finish =
        card.subTypeName ||
        card.finish ||
        (card.isFoil ? 'Foil' : 'Normal');
    const isFoil = Boolean(card.isFoil) || /foil/i.test(String(finish));
    const numOrNull = (...keys) => {
        for (const key of keys) {
            if (card[key] === null || card[key] === undefined || card[key] === '') continue;
            const n = Number(card[key]);
            if (!Number.isNaN(n)) return n;
        }
        return null;
    };
    return {
        printingId: entry.cardId || card._uniqueId || card.id,
        name: card.name || 'Unknown card',
        finish,
        isFoil,
        quantity: entry.quantity || 1,
        tcgMarket: numOrNull('marketPrice', 'tcgMarket', 'tcg_market'),
        tcgLow: numOrNull('lowPrice', 'tcgLow', 'tcg_low'),
        tcgMid: numOrNull('midPrice', 'tcgMid', 'tcg_mid'),
        tcgHigh: numOrNull('highPrice', 'tcgHigh', 'tcg_high'),
        cmTrend: numOrNull('cardmarketTrend', 'cmTrend', 'cm_trend'),
        cmLow: numOrNull('cardmarketLow', 'cmLow', 'cm_low'),
        cmAvg: numOrNull('cardmarketAvg', 'cmAvg', 'cm_avg'),
        cmTrendFoil: numOrNull('cardmarketTrendFoil', 'cmTrendFoil', 'cm_trend_foil'),
        cmLowFoil: numOrNull('cardmarketLowFoil', 'cmLowFoil', 'cm_low_foil'),
        cmAvgFoil: numOrNull('cardmarketAvgFoil', 'cmAvgFoil', 'cm_avg_foil'),
    };
}

/**
 * @param {Array<object>} entries contract-shaped rows (or already mapped)
 * @param {{ source?: 'tcgplayer'|'cardmarket', headline?: 'pricingValue'|'tcgMarketOnly' }} [options]
 */
export function buildBinderValueSnapshot(
    entries,
    { source = 'tcgplayer', headline = 'tcgMarketOnly' } = {},
) {
    const rows = (entries || []).filter((row) => (row.quantity || 0) >= 1);

    let copies = 0;
    let foilCopies = 0;
    let tcgUnpricedCopies = 0;
    let cmUnpricedCopies = 0;
    for (const row of rows) {
        copies += row.quantity;
        if (row.isFoil) foilCopies += row.quantity;
        if (!isPricedField(row.tcgMarket) && !isPricedField(row.tcgLow)) {
            tcgUnpricedCopies += row.quantity;
        }
        const trend = foilAware(row, 'cmTrendFoil', 'cmTrend');
        const low = foilAware(row, 'cmLowFoil', 'cmLow');
        if (!isPricedField(trend) && !isPricedField(low)) {
            cmUnpricedCopies += row.quantity;
        }
    }

    const ranked = [];
    for (const row of rows) {
        const value = sourceValue(row, source, headline);
        if (!isPricedField(value)) continue;
        ranked.push({
            printingId: row.printingId,
            name: row.name,
            finish: row.finish,
            quantity: row.quantity,
            contribution: Number(value) * row.quantity,
        });
    }
    ranked.sort((a, b) => {
        if (b.contribution !== a.contribution) return b.contribution - a.contribution;
        const byName = a.name.localeCompare(b.name);
        if (byName !== 0) return byName;
        return a.printingId.localeCompare(b.printingId);
    });

    return {
        copies,
        distinctPrintings: rows.length,
        foilCopies,
        regularCopies: copies - foilCopies,
        tcgMarket: sumField(rows, (r) => r.tcgMarket),
        tcgLow: sumField(rows, (r) => r.tcgLow),
        cmTrend: sumField(rows, (r) => foilAware(r, 'cmTrendFoil', 'cmTrend')),
        cmLow: sumField(rows, (r) => foilAware(r, 'cmLowFoil', 'cmLow')),
        tcgUnpricedCopies,
        cmUnpricedCopies,
        topPrintings: ranked.slice(0, 5),
    };
}
