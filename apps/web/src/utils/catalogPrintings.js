/**
 * A blank TCGplayer finish was stored as `{productId}-base`. Once the same
 * product has a Normal printing (`{productId}-normal`), the base row is the
 * same card and must not be listed again. Callers that still hold the base id
 * (a binder entry, a shared link) resolve through `aliases`.
 */
export function linkBasePrintings(cards) {
    const normalIds = new Set(
        (cards || [])
            .map((card) => card?._uniqueId || card?.id || '')
            .filter((id) => id.endsWith('-normal'))
    );
    const aliases = new Map();
    const kept = [];
    for (const card of cards || []) {
        const id = card?._uniqueId || card?.id || '';
        if (id.endsWith('-base')) {
            const normalId = `${id.slice(0, -'base'.length)}normal`;
            if (normalIds.has(normalId)) {
                aliases.set(id, normalId);
                continue;
            }
        }
        kept.push(card);
    }
    return { cards: kept, aliases };
}
