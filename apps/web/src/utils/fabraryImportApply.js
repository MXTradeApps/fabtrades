/**
 * Plan a Fabrary import:
 * Have → Collection, Want in trade / Want to buy → Want List,
 * Extra for trade / Extra to sell → Trade Binder. Add-on-top. No free-tier cap.
 */

import { parseFabraryCsv, hasFabraryHeaders } from './fabraryCsv.js';
import { buildSetCodeIndex, matchFabraryRow } from './fabraryMatch.js';

export const FABRARY_DESTINATION = {
    collection: 'collection',
    trade: 'trade',
    want: 'want',
};

export function parseQty(raw) {
    const text = String(raw ?? '').trim();
    if (text === '') return { kind: 'empty', quantity: 0 };
    const n = Number(text);
    if (!Number.isFinite(n)) return { kind: 'invalid', quantity: 0 };
    if (n <= 0) return { kind: 'empty', quantity: 0 };
    return { kind: 'owned', quantity: n };
}

/** @deprecated Use parseQty. Have-only alias kept for existing callers. */
export function parseHave(raw) {
    return parseQty(raw);
}

function qtyOf(row, ...keys) {
    let quantity = 0;
    let invalid = false;
    let seen = false;
    for (const key of keys) {
        const parsed = parseQty(row?.[key]);
        if (parsed.kind === 'invalid') invalid = true;
        if (parsed.kind === 'owned') {
            seen = true;
            quantity += parsed.quantity;
        }
    }
    return { quantity, invalid, seen };
}

function unmatchedFromRow(row) {
    return {
        name: String(row?.Name ?? ''),
        setNumber: String(row?.['Set number'] ?? ''),
        foiling: String(row?.Foiling ?? ''),
        treatment: String(row?.Treatment ?? ''),
        edition: String(row?.Edition ?? ''),
    };
}

function emptyPlan(refuseReason, extras = {}) {
    return {
        ok: false,
        refuseReason,
        ownedCount: 0,
        matchedCount: 0,
        copiesToAdd: 0,
        unmatched: [],
        adds: [],
        ...extras,
    };
}

function addQty(map, printingId, quantity) {
    map.set(printingId, (map.get(printingId) || 0) + quantity);
}

function addsFromMap(map, destination) {
    return [...map.entries()].map(([printingId, quantity]) => ({
        printingId,
        quantity,
        destination,
    }));
}

export function copiesForDestination(adds, destination) {
    return (adds || [])
        .filter((add) => add.destination === destination)
        .reduce((sum, add) => sum + add.quantity, 0);
}

/**
 * @param {Object} input
 * @param {string[]} [input.headers]
 * @param {Object[]} [input.rows]
 * @param {string} [input.csv]
 * @param {Object[]} input.catalog
 */
export function planFabraryImport(input = {}) {
    let headers = input.headers;
    let rows = input.rows;
    if (input.csv != null) {
        const parsed = parseFabraryCsv(input.csv);
        if (!parsed.ok) return emptyPlan('not_fabrary');
        headers = parsed.headers;
        rows = parsed.rows;
    }
    if (input.notFabrary || !hasFabraryHeaders(headers)) {
        return emptyPlan('not_fabrary');
    }

    const unmatched = [];
    const collectionById = new Map();
    const tradeById = new Map();
    const wantById = new Map();
    let ownedCount = 0;
    const catalogIndex = buildSetCodeIndex(input.catalog || []);

    for (const row of rows || []) {
        const have = qtyOf(row, 'Have');
        const want = qtyOf(row, 'Want in trade', 'Want to buy');
        const extra = qtyOf(row, 'Extra for trade', 'Extra to sell');
        const hasValid = have.quantity > 0 || want.quantity > 0 || extra.quantity > 0;
        const hasInvalidOnly = !hasValid && (have.invalid || want.invalid || extra.invalid);
        if (!hasValid && !hasInvalidOnly) continue;

        ownedCount += 1;
        if (hasInvalidOnly) {
            unmatched.push(unmatchedFromRow(row));
            continue;
        }

        const match = matchFabraryRow(row, catalogIndex);
        if (match.unmatched) {
            unmatched.push(match.unmatched);
            continue;
        }
        if (have.quantity > 0) addQty(collectionById, match.printingId, have.quantity);
        if (want.quantity > 0) addQty(wantById, match.printingId, want.quantity);
        if (extra.quantity > 0) addQty(tradeById, match.printingId, extra.quantity);
    }

    if (ownedCount === 0) {
        return emptyPlan('no_owned');
    }

    const adds = [
        ...addsFromMap(collectionById, FABRARY_DESTINATION.collection),
        ...addsFromMap(wantById, FABRARY_DESTINATION.want),
        ...addsFromMap(tradeById, FABRARY_DESTINATION.trade),
    ];
    const matchedCount = adds.length;
    const copiesToAdd = adds.reduce((sum, add) => sum + add.quantity, 0);

    if (matchedCount === 0) {
        return {
            ok: false,
            refuseReason: 'no_matched',
            ownedCount,
            matchedCount: 0,
            copiesToAdd: 0,
            unmatched,
            adds: [],
        };
    }

    return {
        ok: true,
        refuseReason: null,
        ownedCount,
        matchedCount,
        copiesToAdd,
        unmatched,
        adds,
        restoreCollection: collectionById.size > 0,
    };
}

function binderIdFor(destination, collectionBinderId, tradeBinderId) {
    if (destination === FABRARY_DESTINATION.trade) return tradeBinderId;
    if (destination === FABRARY_DESTINATION.want) return null;
    return collectionBinderId;
}

/**
 * Combine planned quantities onto existing NM rows (or Want List rows).
 *
 * @param {Object[]} existingEntries
 * @param {{ printingId: string, quantity: number, destination?: string }[]} adds
 * @param {{ collectionBinderId?: string, tradeBinderId?: string }} [ids]
 * @returns {Object[]}
 */
export function applyImportAddsToEntries(
    existingEntries,
    adds,
    ids = {},
) {
    const collectionBinderId = ids.collectionBinderId || 'system:collection';
    const tradeBinderId = ids.tradeBinderId || 'system:trade';
    const next = (existingEntries || []).map((entry) => ({ ...entry }));
    for (const add of adds || []) {
        const destination = add.destination || FABRARY_DESTINATION.collection;
        const wanted = destination === FABRARY_DESTINATION.want;
        const binderId = binderIdFor(destination, collectionBinderId, tradeBinderId);
        const idx = next.findIndex((entry) => {
            const id = entry.printingId || entry.cardId;
            if (id !== add.printingId) return false;
            if (wanted) return Boolean(entry.isWanted);
            if (entry.isWanted) return false;
            return (entry.binderId || 'system:trade') === binderId
                && (entry.condition || 'NM') === 'NM';
        });
        if (idx >= 0) {
            next[idx] = {
                ...next[idx],
                quantity: (Number(next[idx].quantity) || 0) + add.quantity,
            };
        } else {
            next.push({
                printingId: add.printingId,
                cardId: add.printingId,
                binderId: wanted ? null : binderId,
                isWanted: wanted,
                quantity: add.quantity,
                condition: 'NM',
            });
        }
    }
    return next;
}
