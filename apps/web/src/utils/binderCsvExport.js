/**
 * One Binder → a CSV the player can keep, share, or re-import (spec 010).
 *
 * One row per printing (conditions are summed). Name, Code, Foiling and
 * Treatment are the columns the general CSV import (spec 009) reads, so an
 * exported file round-trips into another Binder.
 */

import { baseCardName, cardPitchValue, cardTreatments } from './cardIdentity.js';

export const BINDER_EXPORT_HEADERS = [
    'Name',
    'Pitch',
    'Set',
    'Code',
    'Foiling',
    'Treatment',
    'Quantity',
    'Price',
    'Total Price',
];

const PITCH_COLORS = { 1: 'Red', 2: 'Yellow', 3: 'Blue' };

function foilingOf(subType, isFoil) {
    const sub = String(subType || '').toLowerCase();
    if (sub.includes('rainbow')) return 'Rainbow';
    if (sub.includes('cold')) return 'Cold';
    if (sub.includes('gold')) return 'Gold';
    if (sub.includes('foil') || isFoil) return 'Foil';
    return 'Normal';
}

function money(n) {
    return n > 0 ? n.toFixed(2) : '';
}

/**
 * @param {Object} input
 * @param {Object[]} input.entries the Binder's entries (`{ cardId, quantity, card }`)
 * @param {(entry: Object) => Object|null} [input.resolveCard] live catalog lookup
 * @returns {Object[]} rows keyed by BINDER_EXPORT_HEADERS, sorted by name
 */
export function buildBinderExportRows({ entries = [], resolveCard } = {}) {
    const rows = new Map();
    for (const entry of entries) {
        const quantity = Number(entry?.quantity) || 0;
        if (quantity <= 0) continue;
        const stub = entry.card || {};
        const live = resolveCard?.(entry) || null;
        const name = live?.name || stub.name || '';
        if (!name) continue;
        const key = entry.cardId || `${name}|${stub.collectorNumber}|${stub.subTypeName}`;
        const existing = rows.get(key);
        if (existing) {
            existing.quantity += quantity;
            continue;
        }
        const card = { name, extPitchValue: live?.extPitchValue ?? stub.pitch };
        rows.set(key, {
            Name: baseCardName(name),
            Pitch: PITCH_COLORS[cardPitchValue(card)] || '',
            Set: live?._setName || stub.setName || '',
            Code: live?.extNumber || stub.collectorNumber || '',
            Foiling: foilingOf(live?.subTypeName || stub.subTypeName, stub.isFoil),
            Treatment: cardTreatments(card).join(', '),
            price: Number(live?.marketPrice) || Number(stub.tcgMarket) || 0,
            quantity,
        });
    }

    return [...rows.values()]
        .sort((a, b) => a.Name.localeCompare(b.Name)
            || a.Pitch.localeCompare(b.Pitch)
            || a.Set.localeCompare(b.Set)
            || a.Code.localeCompare(b.Code)
            || a.Foiling.localeCompare(b.Foiling)
            || a.Treatment.localeCompare(b.Treatment))
        .map(({ price, quantity, ...row }) => ({
            ...row,
            Quantity: String(quantity),
            Price: money(price),
            'Total Price': money(price * quantity),
        }));
}

function csvField(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC4180 text with the binder export header row. */
export function toBinderCsv(rows) {
    const lines = [BINDER_EXPORT_HEADERS.map(csvField).join(',')];
    for (const row of rows || []) {
        lines.push(BINDER_EXPORT_HEADERS.map((header) => csvField(row[header])).join(','));
    }
    return `${lines.join('\n')}\n`;
}

/** `Trade Binder` on 2026-10-27 → `trade-binder-2026-10-27.csv`. */
export function binderExportFilename(binderName, date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const slug = String(binderName || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'binder';
    return `${slug}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
