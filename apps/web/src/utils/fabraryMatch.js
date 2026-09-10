/**
 * Fabrary owned row → catalog Printing. Identifier is not a match key.
 *
 * Filter order is pinned by packages/contracts/fabrary_printing_match.json.
 */

const ART_TREATMENTS = [
    'extended art',
    'full art',
    'alternate art',
    'alternate text',
    'alternate border',
    'alt art',
    'marvel',
    'treasure',
];

/** Fabrary Treatment labels → catalog name parentheticals. */
const TREATMENT_ALIASES = {
    'full art': ['full art', 'marvel', 'treasure'],
    'alternate art': ['alternate art', 'alt art'],
    'alt art': ['alternate art', 'alt art'],
    'extended art': ['extended art'],
    'alternate border': ['alternate border'],
    'alternate text': ['alternate text'],
};

const FOIL_NUMBER_SUFFIX = /(cf|rf|gf)$/;

const PITCH_BY_NAME = { red: '1', yellow: '2', blue: '3' };
const NAME_BY_PITCH = { 1: 'red', 2: 'yellow', 3: 'blue' };

export function collectorNumberKey(raw) {
    if (raw == null) return null;
    const key = String(raw).toLowerCase().replace(/[^a-z0-9]+/g, '');
    return key === '' ? null : key;
}

/** Index keys for a collector number, including `//` / `/` faces and foil suffixes. */
export function collectorNumberKeys(raw) {
    const text = raw == null ? '' : String(raw);
    if (!text.trim()) return [];
    const segments = text.split(/\s*\/\/\s*|\s*\/\s*/).map((part) => part.trim()).filter(Boolean);
    const keys = [];
    const seen = new Set();
    const add = (value) => {
        const key = collectorNumberKey(value);
        if (!key || seen.has(key)) return;
        seen.add(key);
        keys.push(key);
        const stripped = key.replace(FOIL_NUMBER_SUFFIX, '');
        if (stripped !== key && stripped.length >= 5 && !seen.has(stripped)) {
            seen.add(stripped);
            keys.push(stripped);
        }
    };
    add(text);
    for (const part of segments) add(part);
    return keys;
}

export function printingIdOf(card) {
    return card?.id || card?._uniqueId || '';
}

export function collectorNumberOf(card) {
    return card?.collectorNumber || card?.extNumber || card?.collector_number || '';
}

export function subTypeOf(card) {
    return card?.subTypeName || card?.sub_type_name || '';
}

export function setNameOf(card) {
    return card?.setName || card?._setName || card?.set_name || '';
}

export function pitchOf(card) {
    const raw = card?.pitch ?? card?.extPitchValue;
    if (raw === undefined || raw === null || raw === '') return '';
    return String(raw);
}

function stripNameSetCode(name) {
    const trimmed = String(name || '').trim();
    const stripped = trimmed.replace(/\s+-\s+[A-Z0-9]{2,}\s*$/i, '').trim();
    return stripped === '' ? trimmed : stripped;
}

export function nameQualifier(name) {
    const match = /\(([^)]*)\)\s*$/.exec(stripNameSetCode(name));
    return match ? match[1] : null;
}

function editionHaystack(card) {
    return `${subTypeOf(card)} ${setNameOf(card)}`.toLowerCase();
}

function hasArtTreatment(name) {
    const lower = String(name || '').toLowerCase();
    return ART_TREATMENTS.some((token) => lower.includes(`(${token})`));
}

function isRegularPrinting(card) {
    return !hasArtTreatment(card?.name || '');
}

function hasPitchColorName(name) {
    const lower = String(name || '').toLowerCase();
    return lower.includes('(red)') || lower.includes('(yellow)') || lower.includes('(blue)');
}

function matchesPitch(card, fabraryPitch) {
    const want = String(fabraryPitch || '').trim().toLowerCase();
    if (!want) {
        // Blank pitch: do not require a color, but prefer colorless when
        // later tie-breaking. Still accept any remaining candidate.
        return true;
    }
    const mapped = PITCH_BY_NAME[want];
    const catalogPitch = pitchOf(card);
    const hasNumericPitch = catalogPitch && catalogPitch !== '0';
    if (mapped && hasNumericPitch && String(catalogPitch) === mapped) return true;
    const name = String(card?.name || '').toLowerCase();
    if (name.includes(`(${want})`)) return true;
    if (mapped && NAME_BY_PITCH[catalogPitch] === want) return true;
    // Super Slam-style names omit (Red)/(Blue); collector number already
    // identifies the pitch when the catalog row has no pitch field.
    if (!hasNumericPitch && !hasPitchColorName(name)) return true;
    return false;
}

function matchesFoil(card, foiling) {
    const want = String(foiling || '').trim().toLowerCase();
    const sub = subTypeOf(card).toLowerCase();
    if (!want) {
        return !/\brainbow\b/.test(sub) && !/\bcold\b/.test(sub) && !/\bgold\b/.test(sub);
    }
    if (want.includes('rainbow')) return sub.includes('rainbow');
    if (want.includes('cold')) return sub.includes('cold');
    if (want.includes('gold')) return sub.includes('gold');
    return sub.includes(want);
}

function treatmentNeedles(treatment) {
    const want = String(treatment || '').trim().toLowerCase();
    if (!want) return [];
    return TREATMENT_ALIASES[want] || [want];
}

function nameHasTreatment(name, needles) {
    const lower = String(name || '').toLowerCase();
    return needles.some((token) => lower.includes(`(${token})`));
}

function applyTreatmentFilter(candidates, treatment) {
    const want = String(treatment || '').trim();
    if (!want) {
        const regular = candidates.filter((card) => !hasArtTreatment(card?.name || ''));
        return regular.length > 0 ? regular : candidates;
    }
    const needles = treatmentNeedles(want);
    const exact = candidates.filter((card) => nameHasTreatment(card?.name || '', needles));
    if (exact.length > 0) return exact;
    // GEM / promo / Marvel rows often omit Fabrary's exact treatment words.
    // Prefer any remaining art-treated printing so we do not land on the
    // ordinary version when a special version exists (FR-010).
    const artish = candidates.filter((card) => hasArtTreatment(card?.name || ''));
    return artish.length > 0 ? artish : candidates;
}

function applyFoilFilter(candidates, foiling) {
    const matched = candidates.filter((card) => matchesFoil(card, foiling));
    if (matched.length > 0) return matched;
    const want = String(foiling || '').trim();
    if (!want) return matched;
    return candidates.filter((card) => !String(subTypeOf(card) || '').trim());
}

function hasEditionToken(card, token) {
    const text = editionHaystack(card);
    if (token === 'first') return /\b1st\b/.test(text) || /\bfirst\b/.test(text);
    if (token === 'unlimited') return /\bunlimited\b/.test(text);
    if (token === 'alpha') return /\balpha\b/.test(text);
    return false;
}

function matchesEdition(card, edition) {
    const want = String(edition || '').trim().toLowerCase();
    if (!want) {
        return !hasEditionToken(card, 'first')
            && !hasEditionToken(card, 'unlimited')
            && !hasEditionToken(card, 'alpha');
    }
    if (want === 'first') return hasEditionToken(card, 'first');
    if (want === 'unlimited') return hasEditionToken(card, 'unlimited');
    if (want === 'alpha') return hasEditionToken(card, 'alpha');
    return editionHaystack(card).includes(want);
}

export function buildSetCodeIndex(catalog) {
    const index = new Map();
    for (const card of catalog || []) {
        for (const key of collectorNumberKeys(collectorNumberOf(card))) {
            const list = index.get(key);
            if (list) {
                if (!list.includes(card)) list.push(card);
            } else {
                index.set(key, [card]);
            }
        }
    }
    return index;
}

function unmatchedOf(row) {
    return {
        unmatched: {
            name: String(row?.Name ?? row?.name ?? ''),
            setNumber: String(row?.['Set number'] ?? row?.setNumber ?? ''),
            foiling: String(row?.Foiling ?? row?.foiling ?? ''),
            treatment: String(row?.Treatment ?? row?.treatment ?? ''),
            edition: String(row?.Edition ?? row?.edition ?? ''),
        },
    };
}

function pickCandidate(candidates) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const regular = candidates.filter(isRegularPrinting);
    const pool = regular.length > 0 ? regular : candidates;
    const sorted = [...pool].sort((a, b) => {
        const byName = String(a?.name || '').localeCompare(String(b?.name || ''));
        if (byName !== 0) return byName;
        const byNumber = String(collectorNumberOf(a)).localeCompare(String(collectorNumberOf(b)));
        if (byNumber !== 0) return byNumber;
        return String(subTypeOf(a)).localeCompare(String(subTypeOf(b)));
    });
    return sorted[0];
}

/**
 * @param {Object} row Fabrary owned row
 * @param {Object[]} catalog catalog-shaped printings
 * @returns {{ printingId: string } | { unmatched: Object }}
 */
export function matchFabraryRow(row, catalog) {
    const setNumber = row?.['Set number'] ?? row?.setNumber ?? '';
    const key = collectorNumberKey(setNumber);
    if (!key) return unmatchedOf(row);

    const index = Array.isArray(catalog) ? buildSetCodeIndex(catalog) : catalog;
    const pool = (index.get ? index.get(key) : null) || [];
    const pitched = pool.filter((card) =>
        matchesPitch(card, row?.Pitch ?? row?.pitch)
        && matchesEdition(card, row?.Edition ?? row?.edition),
    );
    const foiled = applyFoilFilter(pitched, row?.Foiling ?? row?.foiling);
    const candidates = applyTreatmentFilter(foiled, row?.Treatment ?? row?.treatment);

    const chosen = pickCandidate(candidates);
    if (!chosen) return unmatchedOf(row);
    return { printingId: printingIdOf(chosen) };
}
