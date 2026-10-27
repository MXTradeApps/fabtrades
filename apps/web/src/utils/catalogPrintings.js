const hasPrice = (card) => Number(card?.marketPrice) > 0 || Number(card?.lowPrice) > 0;

/**
 * A blank TCGplayer finish was stored as `{productId}-base`. Once the same
 * product has a Normal printing (`{productId}-normal`), the base row is the
 * same card and must not be listed again. An unpriced base row next to any
 * other finish (Usurp the Shadow Throne: blank + Rainbow Foil only) is a
 * leftover too: listing it shows a phantom, unpriced "Normal" printing.
 * Callers that still hold the base id (a binder entry, a shared link) resolve
 * through `aliases`.
 */
export function linkBasePrintings(cards) {
    const idOf = (card) => card?._uniqueId || card?.id || '';
    // Ids are `{productId}-{finish slug}`; prefer the row's own product id
    // (synthetic `lss-…` ids carry theirs only there).
    const productOf = (card, id) => String(card?.productId ?? card?.product_id ?? id.split('-')[0]);
    const siblingsByProduct = new Map();
    for (const card of cards || []) {
        const id = idOf(card);
        if (!id || id.endsWith('-base')) continue;
        const product = productOf(card, id);
        const list = siblingsByProduct.get(product);
        if (list) list.push(id);
        else siblingsByProduct.set(product, [id]);
    }
    const aliases = new Map();
    const kept = [];
    for (const card of cards || []) {
        const id = idOf(card);
        if (id.endsWith('-base')) {
            const siblings = siblingsByProduct.get(productOf(card, id)) || [];
            const normalId = `${id.slice(0, -'base'.length)}normal`;
            const target = siblings.includes(normalId)
                ? normalId
                : (!hasPrice(card) && siblings[0]) || null;
            if (target) {
                aliases.set(id, target);
                continue;
            }
        }
        kept.push(card);
    }
    return { cards: kept, aliases };
}
