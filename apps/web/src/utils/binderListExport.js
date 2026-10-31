/**
 * "Export card list" for a Binder: plain text, Discord, or CSV, with the
 * player's choice of sort, price source, and whether to show condition.
 *
 * The CSV keeps the Name / Code / Foiling / Treatment / Quantity columns the
 * general CSV import reads, so an exported file still round-trips.
 */

import { baseCardName, cardPitchValue, cardTreatments } from './cardIdentity.js';

export const EXPORT_FORMATS = [
    { id: 'text', label: 'Plain Text', description: 'Clean text format without formatting' },
    { id: 'discord', label: 'Discord', description: 'With bold formatting for Discord/chat' },
    { id: 'csv', label: 'CSV', description: 'Spreadsheet format with columns' },
];

export const EXPORT_SORTS = [
    { id: 'nameAsc', label: 'Name (A–Z)' },
    { id: 'nameDesc', label: 'Name (Z–A)' },
    { id: 'priceDesc', label: 'Price (high → low)' },
    { id: 'priceAsc', label: 'Price (low → high)' },
    { id: 'numberAsc', label: 'Collector #' },
    { id: 'quantityDesc', label: 'Quantity (most first)' },
];

export const PRICE_SOURCES = [
    { id: 'market', label: 'TCG Market' },
    { id: 'low', label: 'TCG Low' },
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

const FINISH_LABELS = { Rainbow: 'Rainbow Foil', Cold: 'Cold Foil', Gold: 'Gold Foil', Foil: 'Foil' };

/**
 * One item per printing (and per condition when `includeCondition`).
 *
 * @param {Object} input
 * @param {Object[]} input.entries Binder entries (`{ cardId, quantity, condition, card }`)
 * @param {(entry: Object) => Object|null} [input.resolveCard] live catalog lookup
 * @param {boolean} [input.includeCondition]
 */
export function buildExportItems({ entries = [], resolveCard, includeCondition = false } = {}) {
    const items = new Map();
    for (const entry of entries) {
        const quantity = Number(entry?.quantity) || 0;
        if (quantity <= 0) continue;
        const stub = entry.card || {};
        const live = resolveCard?.(entry) || null;
        const name = live?.name || stub.name || '';
        if (!name) continue;
        const condition = entry.condition || 'NM';
        const printingKey = entry.cardId || `${name}|${stub.collectorNumber}|${stub.subTypeName}`;
        const key = includeCondition ? `${printingKey}|${condition}` : printingKey;
        const existing = items.get(key);
        if (existing) {
            existing.quantity += quantity;
            continue;
        }
        const card = { name, extPitchValue: live?.extPitchValue ?? stub.pitch };
        items.set(key, {
            name,
            baseName: baseCardName(name),
            pitch: PITCH_COLORS[cardPitchValue(card)] || '',
            set: live?._setName || stub.setName || '',
            code: live?.extNumber || stub.collectorNumber || '',
            foiling: foilingOf(live?.subTypeName || stub.subTypeName, stub.isFoil),
            treatment: cardTreatments(card).join(', '),
            condition: includeCondition ? condition : '',
            quantity,
            market: Number(live?.marketPrice) || Number(stub.tcgMarket) || 0,
            low: Number(live?.lowPrice) || Number(stub.tcgLow) || 0,
        });
    }
    return [...items.values()];
}

export function itemPrice(item, priceSource = 'market') {
    return (priceSource === 'low' ? item.low : item.market) || 0;
}

function byName(a, b) {
    return a.name.localeCompare(b.name) || a.code.localeCompare(b.code, undefined, { numeric: true });
}

export function sortExportItems(items, sort = 'nameAsc', priceSource = 'market') {
    const list = [...items];
    const price = (item) => itemPrice(item, priceSource);
    list.sort((a, b) => {
        switch (sort) {
            case 'nameDesc': return byName(b, a);
            case 'priceDesc': return price(b) - price(a) || byName(a, b);
            case 'priceAsc': return price(a) - price(b) || byName(a, b);
            case 'quantityDesc': return b.quantity - a.quantity || byName(a, b);
            case 'numberAsc':
                if (!a.code !== !b.code) return a.code ? -1 : 1;
                return a.code.localeCompare(b.code, undefined, { numeric: true }) || byName(a, b);
            case 'nameAsc':
            default:
                return byName(a, b);
        }
    });
    return list;
}

function money(n) {
    return `$${n.toFixed(2)}`;
}

/** `3x Command and Conquer - $25.00 - WTR159 (Rainbow Foil, NM)` */
export function formatExportLine(item, { format = 'text', includePrices = false, priceSource = 'market' } = {}) {
    const head = `${item.quantity}x ${item.name}`;
    const parts = [format === 'discord' ? `**${head}**` : head];
    const price = itemPrice(item, priceSource);
    if (includePrices && price > 0) {
        parts.push(item.quantity > 1 ? `${money(price)} each` : money(price));
    }
    if (item.code) parts.push(item.code);
    const details = [FINISH_LABELS[item.foiling], item.condition].filter(Boolean);
    const line = parts.join(' - ');
    return details.length ? `${line} (${details.join(', ')})` : line;
}

function csvField(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(items, { includePrices, includeCondition, priceSource }) {
    const headers = ['Name', 'Pitch', 'Set', 'Code', 'Foiling', 'Treatment'];
    if (includeCondition) headers.push('Condition');
    headers.push('Quantity');
    if (includePrices) headers.push('Price', 'Total Price');
    const lines = [headers.join(',')];
    for (const item of items) {
        const price = itemPrice(item, priceSource);
        const row = [item.baseName, item.pitch, item.set, item.code, item.foiling, item.treatment];
        if (includeCondition) row.push(item.condition);
        row.push(String(item.quantity));
        if (includePrices) {
            row.push(price > 0 ? price.toFixed(2) : '', price > 0 ? (price * item.quantity).toFixed(2) : '');
        }
        lines.push(row.map(csvField).join(','));
    }
    return `${lines.join('\n')}\n`;
}

/**
 * The whole export as a string.
 *
 * @param {Object} input
 * @param {Object[]} input.items from `buildExportItems`
 * @param {string} [input.title] Binder name, shown above text/Discord lists
 * @param {'text'|'discord'|'csv'} [input.format]
 * @param {string} [input.sort]
 * @param {boolean} [input.includePrices]
 * @param {'market'|'low'} [input.priceSource]
 * @param {boolean} [input.includeCondition]
 */
export function buildCardListExport({
    items = [],
    title = '',
    format = 'text',
    sort = 'nameAsc',
    includePrices = false,
    priceSource = 'market',
    includeCondition = false,
} = {}) {
    const sorted = sortExportItems(items, sort, priceSource);
    if (format === 'csv') return toCsv(sorted, { includePrices, includeCondition, priceSource });

    const lines = sorted.map((item) => formatExportLine(item, { format, includePrices, priceSource }));
    const heading = String(title || '').trim();
    const out = [];
    if (heading) out.push(format === 'discord' ? `**${heading}**` : heading, '');
    out.push(...lines);
    if (includePrices && sorted.length) {
        const cards = sorted.reduce((sum, item) => sum + item.quantity, 0);
        const total = sorted.reduce((sum, item) => sum + itemPrice(item, priceSource) * item.quantity, 0);
        const label = `Total: ${cards} ${cards === 1 ? 'card' : 'cards'} - ${money(total)}`;
        out.push('', format === 'discord' ? `**${label}**` : label);
    }
    return out.join('\n');
}

/** `Trade Binder` on 2026-10-27 → `trade-binder-2026-10-27.txt` (or `.csv`). */
export function cardListExportFilename(binderName, format = 'text', date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const slug = String(binderName || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'binder';
    const ext = format === 'csv' ? 'csv' : 'txt';
    return `${slug}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.${ext}`;
}

export function downloadTextFile(text, filename, type = 'text/plain') {
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
