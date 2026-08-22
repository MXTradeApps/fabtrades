/**
 * Pure binder reconcile for Confirm Trade — mirrors mobile
 * `apps/mobile/lib/core/logic/confirm_trade.dart`.
 *
 * Order:
 * 1. Optionally decrement Have-side (given) cards from the Binder (clamp ≥ 0).
 * 2. Optionally add Want-side (received) cards to the Binder (qty merge, NM).
 * 3. Always clear/decrement Want List entries for received cards.
 */

/**
 * @typedef {Object} BinderEntryLike
 * @property {string} cardId
 * @property {boolean} isWanted
 * @property {number} quantity
 * @property {string} [condition]
 * @property {Object} [card]
 * @property {Object} [stub]
 * @property {string} [addedAt]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} TradeLine
 * @property {string} cardId
 * @property {number} quantity
 * @property {Object} [card] - Web card shape for new binder rows
 */

/**
 * @param {Object} params
 * @param {BinderEntryLike[]} params.entries
 * @param {TradeLine[]} params.haveItems - Cards given away
 * @param {TradeLine[]} params.wantItems - Cards received
 * @param {boolean} params.removeGivenFromBinder
 * @param {boolean} params.addReceivedToBinder
 * @param {string} [params.now] - ISO timestamp for new rows
 * @param {string} [params.tradeBinderId='system:trade'] - Trade Binder client id
 * @returns {BinderEntryLike[]}
 */
export function reconcileBinderAfterTrade({
    entries,
    haveItems = [],
    wantItems = [],
    removeGivenFromBinder,
    addReceivedToBinder,
    now,
    tradeBinderId = 'system:trade',
    binders,
}) {
    let next = Array.isArray(entries) ? entries.map((e) => ({ ...e })) : [];
    const stamp = now || new Date().toISOString();
    const tradeId = resolveTradeBinderId(tradeBinderId, binders);

    if (removeGivenFromBinder) {
        for (const item of haveItems) {
            next = decrement(next, item.cardId, item.quantity, false, tradeId);
        }
    }

    if (addReceivedToBinder) {
        for (const item of wantItems) {
            next = add(
                next,
                item.cardId,
                item.quantity,
                {
                    isWanted: false,
                    condition: 'NM',
                    card: item.card,
                    now: stamp,
                    binderId: tradeId,
                },
            );
        }
    }

    // Want list stays honest: received cards leave the want half.
    for (const item of wantItems) {
        next = decrement(next, item.cardId, item.quantity, true);
    }

    return next;
}

export const TRADE_BINDER_ID = 'system:trade';
export const COLLECTION_BINDER_ID = 'system:collection';

function resolveTradeBinderId(tradeBinderId, binders) {
    if (tradeBinderId) return tradeBinderId;
    if (Array.isArray(binders)) {
        const trade = binders.find((b) => b.role === 'trade' && !b.deletedAt);
        if (trade?.clientId) return trade.clientId;
    }
    return TRADE_BINDER_ID;
}

/**
 * Normalize calculator list lines into reconcile trade lines.
 * Lines without a printing id are skipped — binder identity is printing-keyed.
 *
 * @param {Array} list - Calculator have/want list
 * @returns {TradeLine[]}
 */
export function tradeLinesFromList(list) {
    if (!Array.isArray(list)) return [];
    const lines = [];
    for (const item of list) {
        const cardId = item?.uniqueId || item?._uniqueId || item?.id || '';
        if (!cardId) continue;
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
        lines.push({
            cardId,
            quantity,
            card: {
                _uniqueId: cardId,
                name: item.name || '',
                subTypeName: item.subTypeName || 'Normal',
                marketPrice: item.price,
                lowPrice: item.lowPrice,
                imageUrl: item.imageUrl || '',
                _setName: item.setName || item._setName || '',
            },
        });
    }
    return lines;
}

/**
 * @param {BinderEntryLike[]} entries
 * @param {string} cardId
 * @param {number} quantity
 * @param {boolean} isWanted
 * @returns {BinderEntryLike[]}
 */
function decrement(entries, cardId, quantity, isWanted, binderId) {
    if (!cardId || !quantity) return entries;
    const idx = entries.findIndex((e) => {
        if (e.cardId !== cardId || Boolean(e.isWanted) !== Boolean(isWanted)) return false;
        if (isWanted) return true;
        return resolvedBinderId(e) === binderId;
    });
    if (idx < 0) return entries;

    const existing = entries[idx];
    const remaining = existing.quantity - quantity;
    if (remaining <= 0) {
        return entries.filter((_, i) => i !== idx);
    }
    const updated = [...entries];
    updated[idx] = { ...existing, quantity: remaining };
    return updated;
}

function resolvedBinderId(entry) {
    if (entry?.isWanted) return null;
    return entry.binderId || TRADE_BINDER_ID;
}

function add(entries, cardId, quantity, { isWanted, condition, card, now, binderId }) {
    if (!cardId || !quantity) return entries;
    const targetBinder = isWanted ? null : (binderId || TRADE_BINDER_ID);
    const idx = entries.findIndex((e) => {
        if (e.cardId !== cardId || Boolean(e.isWanted) !== Boolean(isWanted)) return false;
        if (isWanted) return true;
        return resolvedBinderId(e) === targetBinder && (e.condition || 'NM') === (condition || 'NM');
    });
    if (idx >= 0) {
        const existing = entries[idx];
        const updated = [...entries];
        updated[idx] = {
            ...existing,
            quantity: existing.quantity + quantity,
        };
        return updated;
    }
    return [
        {
            cardId,
            isWanted: Boolean(isWanted),
            binderId: targetBinder,
            quantity,
            condition: condition || 'NM',
            card: card || null,
            stub: null,
            addedAt: now,
            updatedAt: now,
        },
        ...entries,
    ];
}
