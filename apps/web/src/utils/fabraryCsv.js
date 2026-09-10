/**
 * RFC4180 reader for a Fabrary collection export.
 * Required headers are case-sensitive as exported.
 */

export const FABRARY_REQUIRED_HEADERS = [
    'Identifier',
    'Name',
    'Pitch',
    'Set',
    'Set number',
    'Edition',
    'Foiling',
    'Treatment',
    'Have',
];

/**
 * Split a CSV string into a header row + records. Quoted fields may contain
 * commas and escaped quotes (`""`).
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvRecords(text) {
    const input = String(text ?? '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let i = 0;
    let inQuotes = false;

    const pushField = () => {
        row.push(field);
        field = '';
    };
    const pushRow = () => {
        // A trailing newline should not invent an empty record.
        if (row.length === 1 && row[0] === '' && !inQuotes) {
            row = [];
            return;
        }
        rows.push(row);
        row = [];
    };

    while (i < input.length) {
        const ch = input[i];
        if (inQuotes) {
            if (ch === '"') {
                if (input[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i += 1;
                continue;
            }
            field += ch;
            i += 1;
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            i += 1;
            continue;
        }
        if (ch === ',') {
            pushField();
            i += 1;
            continue;
        }
        if (ch === '\n') {
            pushField();
            pushRow();
            i += 1;
            continue;
        }
        if (ch === '\r') {
            i += 1;
            continue;
        }
        field += ch;
        i += 1;
    }
    if (inQuotes || field !== '' || row.length > 0) {
        pushField();
        pushRow();
    }
    return rows;
}

/**
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, headers: string[], rows: Object[] }}
 */
export function parseFabraryCsv(text) {
    const records = parseCsvRecords(text);
    if (records.length === 0) {
        return { ok: false, reason: 'not_fabrary', headers: [], rows: [] };
    }
    const headers = records[0].map((h) => String(h ?? ''));
    const missing = FABRARY_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
        return { ok: false, reason: 'not_fabrary', headers, rows: [] };
    }
    const rows = records.slice(1).map((cells) => {
        const row = {};
        headers.forEach((header, index) => {
            row[header] = cells[index] ?? '';
        });
        return row;
    });
    return { ok: true, headers, rows };
}

export function hasFabraryHeaders(headers) {
    const list = headers || [];
    return FABRARY_REQUIRED_HEADERS.every((h) => list.includes(h));
}
