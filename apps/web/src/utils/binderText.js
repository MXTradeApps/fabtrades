/**
 * Paste-friendly list of a Binder's cards, one line per printing.
 *
 * `{qty}x {name} · {collector #} · {finish} · {condition} · {set}`
 * Finish is omitted when it is missing or Normal.
 *
 * @param {{ name?: string, entries?: Array<{
 *   quantity?: number,
 *   name?: string,
 *   collectorNumber?: string,
 *   finish?: string,
 *   condition?: string,
 *   setName?: string,
 * }> }} opts
 * @returns {string}
 */
export function formatBinderAsText({ name, entries } = {}) {
    const title = String(name || '').trim() || 'Binder';
    const lines = (entries || [])
        .filter((entry) => (Number(entry.quantity) || 0) > 0)
        .map((entry) => formatBinderTextLine(entry))
        .sort((a, b) => a.sort.localeCompare(b.sort))
        .map((entry) => entry.line);
    if (lines.length === 0) return title;
    return `${title}\n\n${lines.join('\n')}`;
}

function formatBinderTextLine(entry) {
    const qty = Number(entry.quantity) || 1;
    const name = String(entry.name || '').trim() || 'Unknown card';
    const collectorNumber = String(entry.collectorNumber || '').trim();
    const finish = finishLabel(entry.finish);
    const condition = String(entry.condition || '').trim();
    const setName = String(entry.setName || '').trim();
    const parts = [
        collectorNumber,
        finish,
        condition,
        setName,
    ].filter(Boolean);
    const suffix = parts.length ? ` · ${parts.join(' · ')}` : '';
    return {
        line: `${qty}x ${name}${suffix}`,
        sort: `${name}\t${collectorNumber}\t${finish || ''}\t${condition}`,
    };
}

function finishLabel(raw) {
    const finish = String(raw || '').trim();
    if (!finish || finish.toLowerCase() === 'normal') return '';
    return finish;
}
