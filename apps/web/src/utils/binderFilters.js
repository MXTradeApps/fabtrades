// Sidebar filters for an open Binder: rarity, foiling, pitch and set. Options
// are built from the cards actually in the Binder. Within a group, picking
// several values matches any of them; across groups every active group must
// match. Counts are faceted: each group counts against search plus the other
// groups' picks, so a 0 warns before a click leads to an empty list.

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

export const PITCH_OPTIONS = [
    { id: '1', label: 'Red' },
    { id: '2', label: 'Yellow' },
    { id: '3', label: 'Blue' },
];

export const FILTER_GROUPS = ['rarities', 'foilings', 'pitches', 'sets'];

export const EMPTY_BINDER_FILTERS = Object.freeze({
    rarities: [],
    foilings: [],
    pitches: [],
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

/** '1' | '2' | '3' for red / yellow / blue; '' for cards without pitch. */
export function pitchOf(pitch) {
    const value = String(pitch ?? '').trim();
    return PITCH_OPTIONS.some((o) => o.id === value) ? value : '';
}

/** The value a resolved card has for each filter group ('' when it has none). */
const VALUE_OF = {
    rarities: (card) => {
        const rarity = (card.rarity || '').trim();
        return rarity === 'None' ? '' : rarity;
    },
    foilings: (card) => foilingOf(card.finish),
    pitches: (card) => pitchOf(card.pitch),
    sets: (card) => (card.setName || '').trim(),
};

function rarityRank(rarity) {
    const i = RARITY_ORDER.findIndex((r) => r.toLowerCase() === rarity.toLowerCase());
    return i === -1 ? RARITY_ORDER.length : i;
}

/** Newest release first; sets without a date go last, A–Z. */
function compareSetsNewestFirst(a, b) {
    const da = a.publishedOn ? new Date(a.publishedOn).getTime() || 0 : 0;
    const db = b.publishedOn ? new Date(b.publishedOn).getTime() || 0 : 0;
    return db - da || a.name.localeCompare(b.name);
}

function matchesGroups(card, filters, skipGroup) {
    for (const group of FILTER_GROUPS) {
        if (group === skipGroup) continue;
        const picked = filters?.[group] || [];
        if (picked.length && !picked.includes(VALUE_OF[group](card))) return false;
    }
    return true;
}

/**
 * Whether a resolved card passes the active filters.
 *
 * @param {{rarity: string, finish: string, pitch: *, setName: string}} card
 * @param {{rarities: string[], foilings: string[], pitches: string[], sets: string[]}} filters
 */
export function matchesBinderFilters(card, filters) {
    return matchesGroups(card, filters, null);
}

/**
 * Filter choices present in a Binder. `count` is copies that would show with
 * this value picked, given search and the other groups' picks.
 *
 * @param {object[]} entries Binder entries
 * @param {(entry: object) => {rarity: string, finish: string, pitch: *, setName: string, collectorNumber: string}} resolveCard
 * @param {object} [context]
 * @param {object[]} [context.sets] catalog set metadata ({ groupId, name, abbreviation, publishedOn })
 * @param {Record<string, {logoUrl: string|null, abbreviation: string}>} [context.logosByName] set logo file keyed by set name
 * @param {object} [context.filters] active filters, for faceted counts
 * @param {(entry: object, card: object) => boolean} [context.matchesSearch] search predicate, for faceted counts
 */
export function buildBinderFilterOptions(entries, resolveCard, {
    sets = [],
    logosByName = {},
    filters = EMPTY_BINDER_FILTERS,
    matchesSearch = () => true,
} = {}) {
    const present = Object.fromEntries(FILTER_GROUPS.map((g) => [g, new Set()]));
    const counts = Object.fromEntries(FILTER_GROUPS.map((g) => [g, new Map()]));
    const setPrefixes = new Map();

    for (const entry of entries || []) {
        const card = resolveCard(entry);
        const qty = entry.quantity || 1;
        const searched = matchesSearch(entry, card);
        for (const group of FILTER_GROUPS) {
            const value = VALUE_OF[group](card);
            if (!value) continue;
            present[group].add(value);
            if (searched && matchesGroups(card, filters, group)) {
                counts[group].set(value, (counts[group].get(value) || 0) + qty);
            }
        }
        const setName = VALUE_OF.sets(card);
        const prefix = collectorNumberPrefix(card.collectorNumber);
        if (setName && prefix && !setPrefixes.has(setName)) setPrefixes.set(setName, prefix);
    }

    const countOf = (group, id) => counts[group].get(id) || 0;

    const rarities = [...present.rarities]
        .map((id) => ({ id, label: id, count: countOf('rarities', id) }))
        .sort((a, b) => rarityRank(a.id) - rarityRank(b.id) || a.id.localeCompare(b.id));

    const fixed = (group, list) => list
        .filter((o) => present[group].has(o.id))
        .map((o) => ({ ...o, count: countOf(group, o.id) }));

    const setByName = new Map((sets || []).map((s) => [s.name, s]));
    const setOptions = [...present.sets]
        .map((name) => {
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
                count: countOf('sets', name),
            };
        })
        .sort(compareSetsNewestFirst);

    return {
        rarities,
        foilings: fixed('foilings', FOILING_OPTIONS),
        pitches: fixed('pitches', PITCH_OPTIONS),
        sets: setOptions,
    };
}

/** Number of values picked across all filter groups. */
export function activeFilterCount(filters) {
    if (!filters) return 0;
    return FILTER_GROUPS.reduce((sum, group) => sum + (filters[group]?.length || 0), 0);
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
const PARAM_KEYS = { rarities: 'rarity', foilings: 'foil', pitches: 'pitch', sets: 'set' };

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
        pitches: read(PARAM_KEYS.pitches).filter((id) => PITCH_OPTIONS.some((o) => o.id === id)),
        sets: read(PARAM_KEYS.sets),
    };
}

/**
 * Copy of `params` with the filter keys replaced by `filters`; other keys
 * (such as the open Binder) are kept.
 *
 * @param {URLSearchParams} params
 * @param {{rarities: string[], foilings: string[], pitches: string[], sets: string[]}} filters
 */
export function paramsWithFilters(params, filters) {
    const next = new URLSearchParams(params);
    for (const [group, key] of Object.entries(PARAM_KEYS)) {
        next.delete(key);
        for (const value of filters[group] || []) next.append(key, value);
    }
    return next;
}

/** Free-text Binder search over name, set, finish, collector number and type line. */
export function cardMatchesSearch(card, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    return [card.name, card.setName, card.finish, card.collectorNumber, card.typeLine]
        .some((field) => String(field || '').toLowerCase().includes(q));
}
