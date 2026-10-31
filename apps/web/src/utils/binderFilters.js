// Sidebar filters for an open Binder: rarity, foiling and set. Options are
// built from the cards actually in the Binder so every choice matches
// something. Within a group, picking several values matches any of them;
// across groups every active group must match.

import { compareSetsByBrowseOrder } from './setSort.js';
import { collectorNumberPrefix } from './setAbbreviation.js';

/** Highest rarity first, the order FAB players scan for. Unknown values sort after. */
const RARITY_ORDER = [
    'Fabled',
    'Marvel',
    'Legendary',
    'Majestic',
    'Promo',
    'Super Rare',
    'Rare',
    'Common',
    'Basic',
    'Token',
];

export const FOILING_OPTIONS = [
    { id: 'rainbow', label: 'Rainbow Foil' },
    { id: 'cold', label: 'Cold Foil' },
    { id: 'gold', label: 'Gold Foil' },
    { id: 'foil', label: 'Other Foil' },
    { id: 'nonfoil', label: 'Non-foil' },
];

export const EMPTY_BINDER_FILTERS = Object.freeze({
    rarities: [],
    foilings: [],
    sets: [],
});

/**
 * Foiling bucket for a printing's finish. Gold wins over cold so
 * "Gold Cold Foil" lands under Gold Foil.
 *
 * @param {string} finish e.g. "Rainbow Foil", "Normal"
 * @returns {'rainbow'|'cold'|'gold'|'foil'|'nonfoil'}
 */
export function foilingOf(finish) {
    const f = String(finish || '').toLowerCase();
    if (f.includes('rainbow')) return 'rainbow';
    if (f.includes('gold')) return 'gold';
    if (f.includes('cold')) return 'cold';
    if (f.includes('foil') || f.includes('holo')) return 'foil';
    return 'nonfoil';
}

function rarityRank(rarity) {
    const i = RARITY_ORDER.findIndex((r) => r.toLowerCase() === rarity.toLowerCase());
    return i === -1 ? RARITY_ORDER.length : i;
}

/**
 * Filter choices present in a Binder, each with a card count.
 *
 * @param {object[]} entries Binder entries
 * @param {(entry: object) => {rarity: string, finish: string, setName: string, collectorNumber: string}} resolveCard
 * @param {object[]} [sets] catalog set metadata ({ groupId, name, abbreviation, publishedOn })
 * @param {Record<string, {logoUrl: string|null, abbreviation: string}>} [logosByName] set logo file keyed by set name
 * @returns {{ rarities: {id, label, count}[], foilings: {id, label, count}[], sets: {id, label, code, groupId, logoUrl, count}[] }}
 */
export function buildBinderFilterOptions(entries, resolveCard, sets = [], logosByName = {}) {
    const rarityCounts = new Map();
    const foilingCounts = new Map();
    const setCounts = new Map();
    const setPrefixes = new Map();

    for (const entry of entries || []) {
        const card = resolveCard(entry);
        const qty = entry.quantity || 1;
        const rarity = (card.rarity || '').trim();
        if (rarity && rarity !== 'None') {
            rarityCounts.set(rarity, (rarityCounts.get(rarity) || 0) + qty);
        }
        const foiling = foilingOf(card.finish);
        foilingCounts.set(foiling, (foilingCounts.get(foiling) || 0) + qty);
        const setName = (card.setName || '').trim();
        if (setName) {
            setCounts.set(setName, (setCounts.get(setName) || 0) + qty);
            const prefix = collectorNumberPrefix(card.collectorNumber);
            if (prefix && !setPrefixes.has(setName)) setPrefixes.set(setName, prefix);
        }
    }

    const rarities = [...rarityCounts.entries()]
        .map(([id, count]) => ({ id, label: id, count }))
        .sort((a, b) => rarityRank(a.id) - rarityRank(b.id) || a.id.localeCompare(b.id));

    const foilings = FOILING_OPTIONS
        .filter((o) => foilingCounts.has(o.id))
        .map((o) => ({ ...o, count: foilingCounts.get(o.id) }));

    const setByName = new Map((sets || []).map((s) => [s.name, s]));
    const setOptions = [...setCounts.entries()]
        .map(([name, count]) => {
            const meta = setByName.get(name);
            const logo = logosByName[name];
            return {
                id: name,
                label: name,
                name,
                code: (meta?.abbreviation || '').trim()
                    || (logo?.abbreviation || '').trim()
                    || setPrefixes.get(name)
                    || '',
                groupId: meta?.groupId ?? null,
                logoUrl: logo?.logoUrl || null,
                publishedOn: meta?.publishedOn || null,
                count,
            };
        })
        .sort(compareSetsByBrowseOrder);

    return { rarities, foilings, sets: setOptions };
}

/** Number of values picked across all filter groups. */
export function activeFilterCount(filters) {
    if (!filters) return 0;
    return (filters.rarities?.length || 0)
        + (filters.foilings?.length || 0)
        + (filters.sets?.length || 0);
}

/**
 * Whether a resolved card passes the active filters.
 *
 * @param {{rarity: string, finish: string, setName: string}} card
 * @param {{rarities: string[], foilings: string[], sets: string[]}} filters
 */
export function matchesBinderFilters(card, filters) {
    if (!filters) return true;
    const { rarities = [], foilings = [], sets = [] } = filters;
    if (rarities.length && !rarities.includes((card.rarity || '').trim())) return false;
    if (foilings.length && !foilings.includes(foilingOf(card.finish))) return false;
    if (sets.length && !sets.includes((card.setName || '').trim())) return false;
    return true;
}

/** Add or remove one value from a filter group. */
export function toggleBinderFilter(filters, group, value) {
    const current = filters[group] || [];
    const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
    return { ...filters, [group]: next };
}

/** Query-string keys, repeated once per picked value (?rarity=Fabled&rarity=Marvel). */
const PARAM_KEYS = { rarities: 'rarity', foilings: 'foil', sets: 'set' };

/**
 * Filters stored in the URL so a filtered link (including a shared Binder
 * link) opens with the same filters.
 *
 * @param {URLSearchParams} params
 */
export function filtersFromParams(params) {
    const read = (key) => [...new Set(params.getAll(key).filter(Boolean))];
    return {
        rarities: read(PARAM_KEYS.rarities),
        foilings: read(PARAM_KEYS.foilings).filter((id) => FOILING_OPTIONS.some((o) => o.id === id)),
        sets: read(PARAM_KEYS.sets),
    };
}

/**
 * Copy of `params` with the filter keys replaced by `filters`; other keys
 * (such as the open Binder) are kept.
 *
 * @param {URLSearchParams} params
 * @param {{rarities: string[], foilings: string[], sets: string[]}} filters
 */
export function paramsWithFilters(params, filters) {
    const next = new URLSearchParams(params);
    for (const [group, key] of Object.entries(PARAM_KEYS)) {
        next.delete(key);
        for (const value of filters[group] || []) next.append(key, value);
    }
    return next;
}
