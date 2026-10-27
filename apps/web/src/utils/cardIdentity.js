/**
 * One card across all its printings.
 *
 * Catalog names come from two sources (TCGplayer and the official card list)
 * and disagree on qualifiers: "Usurp the Shadow Throne" vs "Usurp the Shadow
 * Throne (Blue) (Marvel)", "Anothos" vs "Anothos (Golden) - FAB061", "Heat
 * Seeker" vs "Heat Seeker (Red)". Grouping by the raw name splits one card
 * into several, so group by base name + pitch instead.
 */

const COLORS = { red: 1, yellow: 2, blue: 3 };
const COLOR_BY_PITCH = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };

/** Name without a trailing ` - FAB061` printed code. */
function stripNameSetCode(name) {
    const trimmed = String(name ?? '').trim();
    const stripped = trimmed.replace(/\s+-\s+[A-Z0-9]{2,}\s*$/i, '').trim();
    return stripped === '' ? trimmed : stripped;
}

/** Card name without trailing `(Red)` / `(Extended Art)` / ` - WTR` qualifiers. */
export function baseCardName(name) {
    let text = stripNameSetCode(name);
    let previous;
    do {
        previous = text;
        text = text.replace(/\s*[([][^)\]]*[)\]]\s*$/, '').trim();
    } while (text !== previous);
    return text;
}

/** Trailing parentheticals, in order, as written. */
function trailingQualifiers(name) {
    const base = baseCardName(name);
    const rest = stripNameSetCode(name).slice(base.length);
    return [...rest.matchAll(/[([]([^)\]]*)[)\]]/g)].map((m) => m[1].trim()).filter(Boolean);
}

/** Pitch 1/2/3 from a `(Red)`-style qualifier, else the catalog pitch field; 0 when none. */
export function cardPitchValue(card) {
    for (const token of trailingQualifiers(card?.name)) {
        const pitch = COLORS[token.toLowerCase()];
        if (pitch) return pitch;
    }
    const raw = Number(card?.extPitchValue ?? card?.pitch);
    return COLOR_BY_PITCH[raw] ? raw : 0;
}

/** Non-color qualifiers such as `Marvel`, `Extended Art`, `Golden`. */
export function cardTreatments(card) {
    return trailingQualifiers(card?.name).filter((token) => !COLORS[token.toLowerCase()]);
}

function normalizeKey(text) {
    return String(text ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[''`]/g, '')
        .replace(/[^a-z0-9/]+/g, ' ')
        .trim();
}

/** Same key for every printing and version (Marvel, Extended Art, …) of one card. */
export function cardKey(card) {
    const base = normalizeKey(baseCardName(card?.name));
    if (!base) return '';
    return `${base}|${cardPitchValue(card) || ''}`;
}

/**
 * Display name with qualifiers in one order: base, color, then treatments.
 * "Usurp the Shadow Throne (Marvel)" with pitch 3 → "Usurp the Shadow Throne (Blue) (Marvel)".
 */
export function canonicalCardName(card) {
    const base = baseCardName(card?.name);
    if (!base) return String(card?.name ?? '');
    const color = COLOR_BY_PITCH[cardPitchValue(card)];
    const parts = [base];
    if (color) parts.push(`(${color})`);
    for (const treatment of cardTreatments(card)) parts.push(`(${treatment})`);
    return parts.join(' ');
}
