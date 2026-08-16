/**
 * Sibling Printings of the opened card (same catalog `name`), including
 * reprints across sets. Grain is Printing (set + finish), not displayName.
 *
 * @param {Array} catalog - In-memory catalog card objects
 * @param {Object} printing - The opened Printing
 * @returns {Array}
 */
export function printingsForCard(catalog, printing) {
    if (!printing?.name || !Array.isArray(catalog)) return [];
    const name = printing.name;
    return catalog.filter((card) => card?.name === name && card._uniqueId);
}

/**
 * Resolve a list/history/search row to a catalog Printing, or null when
 * there is no Printing identity (name is then not a details control).
 */
export function resolvePrinting(card, cardIdLookup = {}) {
    if (!card) return null;
    if (card._uniqueId && cardIdLookup[card._uniqueId]) {
        return cardIdLookup[card._uniqueId];
    }
    if (card._uniqueId && card.name) return card;
    const id = card.uniqueId || card.cardId;
    if (id && cardIdLookup[id]) return cardIdLookup[id];
    if (card.card?._uniqueId) {
        return cardIdLookup[card.card._uniqueId] || card.card;
    }
    return null;
}
