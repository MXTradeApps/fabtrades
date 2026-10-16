/**
 * Binder entries → a CSV in Fabrary's own collection-export shape, so the file
 * can be imported back into Fabrary (and into our own Fabrary import).
 *
 * Quantities follow Fabrary's meaning:
 * - Have: every owned copy, across all Binders and conditions.
 * - Extra for trade: the Trade Binder copies (a subset of Have).
 * - Want in trade: the Want List.
 */

const TRADE_BINDER_ID = 'system:trade';

export const FABRARY_EXPORT_HEADERS = [
    'Identifier',
    'Name',
    'Pitch',
    'Set',
    'Set number',
    'Edition',
    'Foiling',
    'Treatment',
    'Have',
    'Want in trade',
    'Want to buy',
    'Extra for trade',
    'Extra to sell',
];

const PITCH_COLORS = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };
const COLOR_WORDS = ['red', 'yellow', 'blue'];

/** Catalog name parentheticals → Fabrary Treatment labels. */
const TREATMENT_BY_QUALIFIER = {
    'extended art': 'Extended Art',
    'full art': 'Full Art',
    marvel: 'Full Art',
    'alternate art': 'Alternate Art',
    'alt art': 'Alternate Art',
    'japanese alternate art': 'Alternate Art',
    'japanese alternative art': 'Alternate Art',
    'japanese alternate artwork': 'Alternate Art',
    'alternate border': 'Alternate Border',
    'alternate text': 'Alternate Text',
};

/** Fabrary-style slug: `Fyendal's Spring Tunic` → `fyendals-spring-tunic`. */
export function fabraryIdentifier(name, pitch) {
    const base = String(name || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/['’!.,:]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const color = String(pitch || '').toLowerCase();
    return color ? `${base}-${color}` : base;
}

/** Drop a trailing ` - LGS039` style code some promo names carry. */
function stripNameSetCode(name) {
    return String(name || '').replace(/\s+-\s+[A-Z0-9]{2,}\s*$/i, '').trim();
}

function qualifiersOf(text) {
    return [...String(text || '').matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim().toLowerCase());
}

/** Name without any trailing `(Red)` / `(Marvel)` / … parentheticals. */
function bareName(text) {
    let out = String(text || '').trim();
    while (/\s*\([^)]*\)\s*$/.test(out)) out = out.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return out;
}

function pitchFromText(text) {
    const color = qualifiersOf(text).find((q) => COLOR_WORDS.includes(q));
    return color ? color[0].toUpperCase() + color.slice(1) : '';
}

function editionOf(subType) {
    const sub = String(subType || '').toLowerCase();
    if (/\b1st\b|\bfirst\b/.test(sub)) return 'First';
    if (/\bunlimited\b/.test(sub)) return 'Unlimited';
    if (/\balpha\b/.test(sub)) return 'Alpha';
    return '';
}

function foilingOf(subType, qualifiers) {
    const sub = String(subType || '').toLowerCase();
    if (sub.includes('rainbow') || qualifiers.includes('rainbow')) return 'Rainbow';
    if (sub.includes('cold') || qualifiers.includes('cold foil')) return 'Cold';
    if (sub.includes('gold') || qualifiers.includes('golden')) return 'Gold';
    return '';
}

function treatmentOf(qualifiers) {
    for (const q of qualifiers) {
        if (TREATMENT_BY_QUALIFIER[q]) return TREATMENT_BY_QUALIFIER[q];
    }
    return '';
}

function splitFaces(text, pattern) {
    return String(text || '').split(pattern).map((part) => part.trim()).filter(Boolean);
}

/**
 * One catalog printing → one Fabrary row per physical card. Bundled products
 * like `Anothos // Bravo` (`WTR040 // WTR039`) become one row per card; a
 * double-faced card with a single number stays one row.
 *
 * @param {Object} card catalog card or parsed binder stub
 * @returns {Object[]} rows without quantities
 */
export function fabraryRowsForCard(card) {
    if (!card) return [];
    const fullName = stripNameSetCode(card.name);
    const qualifiers = qualifiersOf(fullName);
    const subType = card.subTypeName ?? card.sub_type_name ?? '';
    const shared = {
        Set: card._setName || card.setName || card.set_name || '',
        Edition: editionOf(subType),
        Foiling: foilingOf(subType, qualifiers),
        Treatment: treatmentOf(qualifiers),
    };

    const names = splitFaces(fullName, /\s*\/\/\s*/);
    const numbers = splitFaces(
        card.extNumber || card.collectorNumber || card.collector_number,
        /\s*\/\/\s*|\s*\/\s*/,
    );
    const catalogPitch = PITCH_COLORS[String(card.extPitchValue ?? card.pitch ?? '')] || '';

    const toRow = (faceName, number, pitch) => {
        const name = bareName(faceName);
        return {
            Identifier: fabraryIdentifier(name, pitch),
            Name: name,
            Pitch: pitch,
            ...shared,
            'Set number': number || '',
        };
    };

    if (names.length > 1 && names.length === numbers.length) {
        return names.map((face, i) => toRow(face, numbers[i], pitchFromText(face)));
    }
    const first = names[0] || fullName;
    return [toRow(first, numbers[0], catalogPitch || pitchFromText(first))];
}

function rowKey(row) {
    return [row.Identifier, row['Set number'], row.Edition, row.Foiling, row.Treatment].join('|');
}

/**
 * @param {Object} input
 * @param {Object[]} input.owned binder entries (`{ cardId, binderId, quantity, card }`)
 * @param {Object[]} [input.wants] Want List entries
 * @param {(entry: Object) => Object|null} [input.resolveCard] live catalog lookup
 * @returns {Object[]} Fabrary rows with quantity columns, sorted by set number
 */
export function buildFabraryExportRows({ owned = [], wants = [], resolveCard } = {}) {
    const rows = new Map();
    const add = (entry, column) => {
        const quantity = Number(entry?.quantity) || 0;
        if (quantity <= 0) return;
        const card = resolveCard?.(entry) || entry.card;
        for (const base of fabraryRowsForCard(card)) {
            if (!base.Name) continue;
            const key = rowKey(base);
            const row = rows.get(key) || { ...base, have: 0, want: 0, trade: 0 };
            row[column] += quantity;
            rows.set(key, row);
        }
    };
    for (const entry of owned) {
        add(entry, 'have');
        if ((entry.binderId || TRADE_BINDER_ID) === TRADE_BINDER_ID) add(entry, 'trade');
    }
    for (const entry of wants) add(entry, 'want');

    const blankZero = (n) => (n > 0 ? String(n) : '');
    return [...rows.values()]
        .sort((a, b) => a['Set number'].localeCompare(b['Set number'])
            || a.Name.localeCompare(b.Name)
            || rowKey(a).localeCompare(rowKey(b)))
        .map(({ have, want, trade, ...row }) => ({
            ...row,
            Have: blankZero(have),
            'Want in trade': blankZero(want),
            'Want to buy': '',
            'Extra for trade': blankZero(trade),
            'Extra to sell': '',
        }));
}

function csvField(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC4180 text with Fabrary's header row. */
export function toFabraryCsv(rows) {
    const lines = [FABRARY_EXPORT_HEADERS.map(csvField).join(',')];
    for (const row of rows || []) {
        lines.push(FABRARY_EXPORT_HEADERS.map((header) => csvField(row[header])).join(','));
    }
    return `${lines.join('\n')}\n`;
}

export function fabraryExportFilename(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `fabtrades-fabrary-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}

/** Hand the CSV to the browser as a download. */
export function downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
