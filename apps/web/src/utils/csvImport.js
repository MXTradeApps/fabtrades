/**
 * General CSV → Binder import (spec 009).
 *
 * Accepts `Name, Set, Foiling, Quantity` (only Name required) and Fabrary
 * collection exports. Each row resolves to one Printing, to a short list the
 * player must pick from (Needs review), or to nothing (Couldn't match).
 */

import { parseCsvRecords, hasFabraryHeaders } from './fabraryCsv.js';
import {
    buildSetCodeIndex,
    collectorNumberKey,
    collectorNumberOf,
    matchFabraryRow,
    printingIdOf,
    setNameOf,
    subTypeOf,
} from './fabraryMatch.js';
import { parseQty } from './fabraryImportApply.js';
import { collectorNumberPrefix } from './setAbbreviation.js';
import { baseCardName } from './cardIdentity.js';

export { baseCardName };

/** Auto-pick the cheapest printing when every candidate is within this many dollars. */
export const PRICE_SPREAD_LIMIT = 5;

/** Minimum similarity (0–1) for a fuzzy set-name match. */
const FUZZY_THRESHOLD = 0.85;
/** Two different names this close to the best score make the row ambiguous. */
const FUZZY_TIE_MARGIN = 0.03;
/** Below this, a row's name does not belong to the card its code points at. */
const CODE_NAME_THRESHOLD = 0.6;

const HEADER_ALIASES = {
    name: ['name', 'card', 'cardname'],
    set: ['set', 'setcode', 'setname', 'edition'],
    foiling: ['foiling', 'foil', 'finish'],
    quantity: ['quantity', 'qty', 'count', 'have'],
};

const PITCHES = ['red', 'yellow', 'blue'];
const PITCH_BY_VALUE = { 1: 'red', 2: 'yellow', 3: 'blue' };

const TREATMENTS = [
    'extended art',
    'full art',
    'alternate art',
    'alt art',
    'alternate text',
    'alternate border',
    'marvel',
    'treasure',
];
const TREATMENT_ALIASES = {
    'alt art': ['alternate art', 'alt art'],
    'alternate art': ['alternate art', 'alt art'],
    'full art': ['full art', 'marvel', 'treasure'],
};

// FAB collector numbers: 2–4 letters + 3 digits (WTR167, ROS111, FAB123),
// optionally followed by a foil suffix such as RF/CF/GF.
const CARD_CODE_RE = /\b([A-Za-z]{2,4}\d{3})(?:[A-Za-z]{1,2})?\b/;

export function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[''`]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function normalizeHeader(value) {
    return String(value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Damerau-Levenshtein (optimal string alignment) distance. With `limit`, only a
 * band of width `limit` is computed and anything over it returns `limit + 1`.
 */
function editDistance(a, b, limit = Infinity) {
    const m = a.length;
    const n = b.length;
    if (Math.abs(m - n) > limit) return limit + 1;
    if (m === 0) return n;
    if (n === 0) return m;
    const big = m + n + 1;
    let prevPrev = new Array(n + 1).fill(big);
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    let curr = new Array(n + 1).fill(big);
    for (let i = 1; i <= m; i += 1) {
        const from = Number.isFinite(limit) ? Math.max(1, i - limit) : 1;
        const to = Number.isFinite(limit) ? Math.min(n, i + limit) : n;
        curr.fill(big);
        curr[0] = i;
        let rowMin = from === 1 ? i : big;
        for (let j = from; j <= to; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let best = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                best = Math.min(best, prevPrev[j - 2] + 1);
            }
            curr[j] = best;
            if (best < rowMin) rowMin = best;
        }
        if (rowMin > limit) return limit + 1;
        [prevPrev, prev, curr] = [prev, curr, prevPrev];
    }
    return Math.min(prev[n], big);
}

/** Letter/digit counts, so names too different to be a typo are skipped cheaply. */
function charCounts(text) {
    const counts = new Int16Array(37);
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        if (code >= 97 && code <= 122) counts[code - 97] += 1;
        else if (code >= 48 && code <= 57) counts[26 + code - 48] += 1;
        else counts[36] += 1;
    }
    return counts;
}

function countsDiff(a, b, stopAbove) {
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
        diff += Math.abs(a[i] - b[i]);
        if (diff > stopAbove) return diff;
    }
    return diff;
}

/** 1 for identical normalized strings, 0 for nothing in common. */
export function nameSimilarity(a, b) {
    const x = normalizeText(a);
    const y = normalizeText(b);
    if (!x || !y) return 0;
    if (x === y) return 1;
    return 1 - editDistance(x, y) / Math.max(x.length, y.length);
}

function parentheticals(name) {
    return [...String(name ?? '').matchAll(/[([]([^)\]]*)[)\]]/g)].map((m) => m[1].trim().toLowerCase());
}

function pitchOfName(name) {
    const tokens = parentheticals(name);
    const found = PITCHES.find((pitch) => tokens.includes(pitch));
    if (found) return found;
    const suffix = /\s-\s*(red|yellow|blue)\s*$/i.exec(String(name ?? ''));
    return suffix ? suffix[1].toLowerCase() : '';
}

function treatmentOfName(name) {
    const tokens = parentheticals(name);
    return TREATMENTS.find((t) => tokens.some((token) => token.includes(t))) || '';
}

/**
 * Split a CSV Name into card code, base name, pitch, and treatment.
 *
 * @param {string} raw
 */
export function parseNameField(raw) {
    let text = String(raw ?? '').trim();
    const codeMatch = CARD_CODE_RE.exec(text);
    const code = codeMatch ? codeMatch[1].toUpperCase() : '';
    if (codeMatch) {
        text = (text.slice(0, codeMatch.index) + text.slice(codeMatch.index + codeMatch[0].length))
            .replace(/[([]\s*[)\]]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^[-–:|,\s]+|[-–:|,\s]+$/g, '');
    }
    const pitch = pitchOfName(text);
    const treatment = treatmentOfName(text);
    const cleaned = text.replace(/\s-\s*(red|yellow|blue)\s*$/i, '');
    return { code, name: baseCardName(cleaned), pitch, treatment };
}

/** @returns {'normal'|'rainbow'|'cold'|'gold'|'foil'|''} */
export function parseFoiling(raw) {
    const text = normalizeText(raw);
    if (!text) return '';
    if (/^(normal|non ?foil|nonfoil|regular|standard|nf|none|no)$/.test(text)) return 'normal';
    if (/\b(rainbow|rf)\b/.test(text)) return 'rainbow';
    if (/\b(cold|cf)\b/.test(text)) return 'cold';
    if (/\b(gold|gf)\b/.test(text)) return 'gold';
    if (/\b(foil|foiled|yes)\b/.test(text)) return 'foil';
    return '';
}

function finishOf(card) {
    const sub = subTypeOf(card).toLowerCase();
    if (sub.includes('rainbow')) return 'rainbow';
    if (sub.includes('cold')) return 'cold';
    if (sub.includes('gold')) return 'gold';
    return 'normal';
}

function cardPitch(card) {
    const fromName = pitchOfName(card?.name);
    if (fromName) return fromName;
    const value = card?.extPitchValue ?? card?.pitch;
    return PITCH_BY_VALUE[value] || '';
}

function cardHasTreatment(card, treatment) {
    const needles = TREATMENT_ALIASES[treatment] || [treatment];
    const tokens = parentheticals(card?.name);
    return needles.some((needle) => tokens.some((token) => token.includes(needle)));
}

export function priceOf(card) {
    const raw = card?.marketPrice ?? card?.market ?? card?.tcgMarket;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function matchesSet(card, wanted) {
    const want = normalizeText(wanted);
    if (!want) return true;
    const code = collectorNumberPrefix(collectorNumberOf(card)).toLowerCase();
    if (code && want.replace(/\s+/g, '') === code) return true;
    const setName = normalizeText(setNameOf(card));
    if (!setName) return false;
    if (setName === want || setName.includes(want)) return true;
    return nameSimilarity(setName, want) >= FUZZY_THRESHOLD;
}

/** Build lookup tables once per catalog. */
export function buildImportIndex(catalog) {
    const byName = new Map();
    for (const card of catalog || []) {
        const key = normalizeText(baseCardName(card?.name));
        if (!key) continue;
        const list = byName.get(key);
        if (list) list.push(card);
        else byName.set(key, [card]);
    }
    return {
        catalog: catalog || [],
        byCode: buildSetCodeIndex(catalog || []),
        byName,
        names: [...byName.keys()].map((name) => ({ name, counts: charCounts(name) })),
        byId: new Map((catalog || []).map((card) => [printingIdOf(card), card])),
    };
}

/** Typos allowed in a card name: 1 for short names, ~15% of the length for long ones. */
function allowedTypos(length) {
    if (length < 4) return 0;
    return Math.max(1, Math.round(length * 0.15));
}

function fuzzyNames(index, wanted) {
    const want = normalizeText(wanted);
    if (!want) return [];
    const maxDistance = allowedTypos(want.length);
    if (maxDistance === 0) return [];
    const wantCounts = charCounts(want);
    const scored = [];
    for (const { name, counts } of index.names) {
        if (Math.abs(name.length - want.length) > maxDistance) continue;
        // One edit changes the character counts by at most 2.
        if (countsDiff(wantCounts, counts, 2 * maxDistance) > 2 * maxDistance) continue;
        const distance = editDistance(want, name, maxDistance);
        if (distance > maxDistance) continue;
        scored.push({ name, score: 1 - distance / Math.max(want.length, name.length) });
    }
    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return scored;
}

function stableOrder(a, b) {
    return String(setNameOf(a)).localeCompare(String(setNameOf(b)))
        || String(collectorNumberOf(a)).localeCompare(String(collectorNumberOf(b)))
        || String(subTypeOf(a)).localeCompare(String(subTypeOf(b)))
        || String(printingIdOf(a)).localeCompare(String(printingIdOf(b)));
}

function review(candidates, reason) {
    const ids = [...new Set([...candidates].sort(stableOrder).map(printingIdOf))];
    return { status: 'review', reason, candidates: ids };
}

/**
 * Narrow a pool with one filter. A filter that removes everything sends the
 * row to review over the unfiltered pool rather than guessing.
 */
function narrow(pool, keep, reason) {
    const next = pool.filter(keep);
    if (next.length > 0) return { pool: next };
    return { result: review(pool, reason) };
}

function preferWhenAny(pool, keep) {
    const next = pool.filter(keep);
    return next.length > 0 ? next : pool;
}

/**
 * Resolve one generic CSV row.
 *
 * @param {{ name?: string, set?: string, foiling?: string }} row
 * @param {ReturnType<typeof buildImportIndex>} index
 * @returns {{ status: 'matched', printingId: string }
 *   | { status: 'review', reason: string, candidates: string[] }
 *   | { status: 'unmatched' }}
 */
export function matchImportRow(row, index) {
    const parsed = parseNameField(row?.name);
    let pool = [];

    if (parsed.code) {
        const key = collectorNumberKey(parsed.code);
        pool = (index.byCode.get(key) || []).slice();
        if (pool.length > 0 && parsed.name) {
            const best = Math.max(...pool.map((card) => nameSimilarity(parsed.name, baseCardName(card.name))));
            if (best < CODE_NAME_THRESHOLD) return review(pool, 'name_code_mismatch');
        }
    }

    if (pool.length === 0) {
        if (!parsed.name) return { status: 'unmatched' };
        const exact = index.byName.get(normalizeText(parsed.name));
        if (exact) {
            pool = exact.slice();
        } else {
            const fuzzy = fuzzyNames(index, parsed.name);
            if (fuzzy.length === 0) return { status: 'unmatched' };
            const close = fuzzy.filter((hit) => fuzzy[0].score - hit.score <= FUZZY_TIE_MARGIN);
            pool = close.flatMap((hit) => index.byName.get(hit.name));
            if (close.length > 1) return review(pool, 'similar_names');
        }
    }

    if (parsed.pitch) {
        const step = narrow(pool, (card) => cardPitch(card) === parsed.pitch, 'pitch');
        if (step.result) return step.result;
        pool = step.pool;
    }

    if (row?.set) {
        const step = narrow(pool, (card) => matchesSet(card, row.set), 'set');
        if (step.result) return step.result;
        pool = step.pool;
    }

    // Explicit details first; the blank-Foiling preference only applies after,
    // so `(Extended Art)` with no Foiling can still land on a foil-only art.
    // No treatment in the name keeps every version (Marvel, Extended Art, …)
    // in play: the price spread decides whether the player must pick.
    const foil = parseFoiling(row?.foiling);
    if (foil) {
        const keep = foil === 'foil'
            ? (card) => finishOf(card) !== 'normal'
            : (card) => finishOf(card) === foil;
        const step = narrow(pool, keep, 'foiling');
        if (step.result) return step.result;
        pool = step.pool;
    }

    if (parsed.treatment) {
        const step = narrow(pool, (card) => cardHasTreatment(card, parsed.treatment), 'treatment');
        if (step.result) return step.result;
        pool = step.pool;
    }

    if (!foil) pool = preferWhenAny(pool, (card) => finishOf(card) === 'normal');

    return pickByPrice(pool);
}

/**
 * One candidate → it. Several → the cheapest when all priced candidates are
 * within PRICE_SPREAD_LIMIT; otherwise review. No prices at all → review.
 */
export function pickByPrice(pool) {
    const unique = [...new Map(pool.map((card) => [printingIdOf(card), card])).values()];
    if (unique.length === 0) return { status: 'unmatched' };
    if (unique.length === 1) return { status: 'matched', printingId: printingIdOf(unique[0]) };
    const priced = unique.filter((card) => priceOf(card) != null);
    if (priced.length === 0) return review(unique, 'unpriced');
    const prices = priced.map(priceOf);
    const spread = Math.max(...prices) - Math.min(...prices);
    if (spread > PRICE_SPREAD_LIMIT + 1e-9) return review(unique, 'price_spread');
    const cheapest = [...priced].sort((a, b) => priceOf(a) - priceOf(b) || stableOrder(a, b))[0];
    return { status: 'matched', printingId: printingIdOf(cheapest) };
}

function mapHeaders(headers) {
    const normalized = headers.map(normalizeHeader);
    const columns = {};
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        const idx = normalized.findIndex((h) => aliases.includes(h));
        if (idx >= 0) columns[field] = idx;
    }
    return columns;
}

function emptyPlan(refuseReason, kind = 'generic') {
    return { ok: false, refuseReason, kind, rowCount: 0, matched: [], review: [], unmatched: [] };
}

function planFabrary(records) {
    const headers = records[0];
    const rows = records.slice(1).map((cells) => {
        const row = {};
        headers.forEach((header, i) => { row[header] = cells[i] ?? ''; });
        return row;
    });
    return { headers, rows };
}

/**
 * Read a CSV and resolve each row against the catalog.
 *
 * @param {{ csv: string, catalog: Object[] }} input
 * @returns {{
 *   ok: boolean,
 *   refuseReason: null|'no_name'|'no_rows'|'no_matched',
 *   kind: 'generic'|'fabrary',
 *   rowCount: number,
 *   matched: { printingId: string, quantity: number }[],
 *   review: { key: string, row: Object, quantity: number, reason: string, candidates: string[] }[],
 *   unmatched: Object[],
 * }}
 */
export function planCsvImport({ csv, catalog }) {
    const records = parseCsvRecords(csv);
    if (records.length === 0) return emptyPlan('no_name');
    const headers = records[0].map((h) => String(h ?? '').trim());

    const matched = [];
    const reviewRows = [];
    const unmatched = [];
    let rowCount = 0;
    let kind = 'generic';

    if (hasFabraryHeaders(headers)) {
        kind = 'fabrary';
        const index = buildSetCodeIndex(catalog || []);
        const { rows } = planFabrary([headers, ...records.slice(1)]);
        for (const row of rows) {
            const have = parseQty(row.Have);
            if (have.kind === 'empty') continue;
            rowCount += 1;
            const label = {
                name: String(row.Name ?? ''),
                set: String(row['Set number'] ?? ''),
                foiling: String(row.Foiling ?? ''),
                treatment: String(row.Treatment ?? ''),
                edition: String(row.Edition ?? ''),
            };
            if (have.kind === 'invalid') {
                unmatched.push(label);
                continue;
            }
            const result = matchFabraryRow(row, index);
            if (result.unmatched) unmatched.push({ ...label, quantity: have.quantity });
            else matched.push({ printingId: result.printingId, quantity: have.quantity });
        }
    } else {
        const columns = mapHeaders(headers);
        if (columns.name == null) return emptyPlan('no_name');
        const index = buildImportIndex(catalog);
        records.slice(1).forEach((cells, i) => {
            const cell = (field) => (columns[field] == null ? '' : String(cells[columns[field]] ?? '').trim());
            const row = {
                name: cell('name'),
                set: cell('set'),
                foiling: cell('foiling'),
                quantity: cell('quantity'),
            };
            if (!row.name && !row.set && !row.foiling && !row.quantity) return;
            const qty = row.quantity === '' ? { kind: 'owned', quantity: 1 } : parseQty(row.quantity);
            if (qty.kind === 'empty') return;
            rowCount += 1;
            if (qty.kind === 'invalid' || !Number.isInteger(qty.quantity) || !row.name) {
                unmatched.push(row);
                return;
            }
            const result = matchImportRow(row, index);
            if (result.status === 'matched') {
                matched.push({ printingId: result.printingId, quantity: qty.quantity });
            } else if (result.status === 'review') {
                reviewRows.push({
                    key: `row-${i + 2}`,
                    row,
                    quantity: qty.quantity,
                    reason: result.reason,
                    candidates: result.candidates,
                });
            } else {
                unmatched.push(row);
            }
        });
    }

    if (rowCount === 0) return { ...emptyPlan('no_rows', kind) };
    if (matched.length === 0 && reviewRows.length === 0) {
        return { ok: false, refuseReason: 'no_matched', kind, rowCount, matched, review: reviewRows, unmatched };
    }
    return { ok: true, refuseReason: null, kind, rowCount, matched, review: reviewRows, unmatched };
}

/**
 * Sum matched rows and the player's review picks into per-Printing adds.
 *
 * @param {ReturnType<typeof planCsvImport>} plan
 * @param {Record<string, string|null>} picks review key → printingId (null/absent = skip)
 * @returns {{ printingId: string, quantity: number }[]}
 */
export function resolveImportAdds(plan, picks = {}) {
    const totals = new Map();
    const add = (printingId, quantity) => {
        totals.set(printingId, (totals.get(printingId) || 0) + quantity);
    };
    for (const row of plan?.matched || []) add(row.printingId, row.quantity);
    for (const row of plan?.review || []) {
        const pick = picks[row.key];
        if (pick && row.candidates.includes(pick)) add(pick, row.quantity);
    }
    return [...totals.entries()].map(([printingId, quantity]) => ({ printingId, quantity }));
}
