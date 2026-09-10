/**
 * Plan a Fabrary Binder import: Have-only, add-on-top, refuse-all on cap.
 */

import { parseFabraryCsv, hasFabraryHeaders } from './fabraryCsv.js';
import { matchFabraryRow } from './fabraryMatch.js';
import { canImportDistinctPrintings } from './freeLimits.js';

export function parseHave(raw) {
    const text = String(raw ?? '').trim();
    if (text === '') return { kind: 'empty' };
    const n = Number(text);
    if (!Number.isFinite(n)) return { kind: 'invalid', raw: text };
    if (n <= 0) return { kind: 'empty' };
    return { kind: 'owned', quantity: n };
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

function ownedIdsFromEntries(entries) {
    const ids = new Set();
    for (const entry of entries || []) {
        if (entry?.isWanted) continue;
        const id = entry.printingId || entry.cardId;
        if (id) ids.add(id);
    }
    return [...ids];
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

/**
 * @param {Object} input
 * @param {string[]} [input.headers]
 * @param {Object[]} [input.rows]
 * @param {string} [input.csv]
 * @param {Object[]} input.catalog
 * @param {string} input.binderId
 * @param {Object[]} [input.existingEntries]
 * @param {string[]} [input.existingOwnedIds]
 * @param {boolean} [input.isPro]
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
    const qtyById = new Map();
    let ownedCount = 0;
    let matchedRows = 0;

    for (const row of rows || []) {
        const have = parseHave(row.Have);
        if (have.kind === 'empty') continue;
        if (have.kind === 'invalid') {
            ownedCount += 1;
            unmatched.push(unmatchedFromRow(row));
            continue;
        }
        ownedCount += 1;
        const match = matchFabraryRow(row, input.catalog || []);
        if (match.unmatched) {
            unmatched.push(match.unmatched);
            continue;
        }
        matchedRows += 1;
        qtyById.set(match.printingId, (qtyById.get(match.printingId) || 0) + have.quantity);
    }

    if (ownedCount === 0) {
        return emptyPlan('no_owned');
    }

    const adds = [...qtyById.entries()].map(([printingId, quantity]) => ({
        printingId,
        quantity,
    }));
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

    const existingOwnedIds = input.existingOwnedIds
        || ownedIdsFromEntries(input.existingEntries);
    const incomingIds = adds.map((add) => add.printingId);
    if (!canImportDistinctPrintings(existingOwnedIds, incomingIds, { isPro: Boolean(input.isPro) })) {
        return {
            ok: false,
            refuseReason: 'free_cap',
            ownedCount,
            matchedCount,
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
        matchedRows,
        binderId: input.binderId,
    };
}

/**
 * Combine Have quantities onto existing NM rows in this Binder only.
 *
 * @param {Object[]} existingEntries
 * @param {string} binderId
 * @param {{ printingId: string, quantity: number }[]} adds
 * @returns {Object[]}
 */
export function applyImportAddsToEntries(existingEntries, binderId, adds) {
    const next = (existingEntries || []).map((entry) => ({ ...entry }));
    for (const add of adds || []) {
        const idx = next.findIndex((entry) =>
            !entry.isWanted
            && (entry.binderId || 'system:trade') === binderId
            && (entry.condition || 'NM') === 'NM'
            && (entry.printingId || entry.cardId) === add.printingId,
        );
        if (idx >= 0) {
            next[idx] = {
                ...next[idx],
                quantity: (Number(next[idx].quantity) || 0) + add.quantity,
            };
        } else {
            next.push({
                printingId: add.printingId,
                cardId: add.printingId,
                binderId,
                isWanted: false,
                quantity: add.quantity,
                condition: 'NM',
            });
        }
    }
    return next;
}
