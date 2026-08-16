/**
 * Free-tier ceilings. FABTrades Pro removes all of them.
 *
 * These numbers are duplicated in `apps/mobile/lib/core/logic/free_limits.dart`
 * and pinned by `packages/contracts/free_limits.json`, which both test suites
 * read. Drift here is not cosmetic: mobile enforces the trade window by deleting
 * the oldest rows, so a higher cap on web would look to the customer like mobile
 * eating trades they had saved.
 *
 * Binder and want-list caps refuse new distinct cards (never trim existing rows).
 * Raising quantity on a card that is already listed is never capped — same as
 * mobile's `_canAddNewCard`.
 */
export const FreeLimits = {
    binderCards: 50,
    wantListCards: 50,
    savedTrades: 3,
    loanedCards: 10,
};

/**
 * Distinct-card cap for binder vs want list.
 *
 * @param {{ isWanted: boolean }} opts
 * @returns {number}
 */
export function cardsFor({ isWanted }) {
    return isWanted ? FreeLimits.wantListCards : FreeLimits.binderCards;
}

/**
 * Whether a free account may add another distinct card to binder or want list.
 *
 * Matches mobile: Pro always allowed; free accounts are blocked once they already
 * hold the cap. Callers that are only raising quantity on an existing entry should
 * not use this — that path is uncapped.
 *
 * @param {number} existingDistinctCount - How many distinct cards are already listed
 * @param {{ isWanted: boolean, isPro?: boolean }} opts
 * @returns {boolean}
 */
export function canAddDistinctCard(existingDistinctCount, { isWanted, isPro = false } = {}) {
    if (isPro) return true;
    return existingDistinctCount < cardsFor({ isWanted });
}

/**
 * How many of the oldest trades have to roll off to fit inside the free window.
 *
 * Saving a trade is never refused, on either client. Refusing would lose the
 * trade outright, and a history that quietly keeps the most recent is a much
 * gentler limit to run into than a save button that stops working.
 *
 * @param {number} total - Trades the account would hold after the save
 * @returns {number} Trades to tombstone, oldest first; 0 when inside the window
 */
export function tradesOverFreeLimit(total) {
    return Math.max(0, total - FreeLimits.savedTrades);
}
