import { distinctOwnedCount } from './freeLimits.js';

/**
 * Move copies of a Printing+condition between live Binders.
 * Golden cases: packages/contracts/binder_move.json
 * Never refuses for binderCards. Want List is never a destination.
 *
 * @returns {{ ok: boolean, reason: string|null, entries: Array, distinctOwned: number }}
 */
export function moveBinderCopies({
    binders,
    entries,
    fromBinderId,
    toBinderId,
    printingId,
    condition = 'NM',
    quantity,
}) {
    const snapshot = (entries || []).map((e) => ({ ...e }));
    const owned = () => distinctOwnedCount(snapshot);
    const refuse = (reason) => ({
        ok: false,
        reason,
        entries: snapshot,
        distinctOwned: owned(),
    });

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) return refuse('invalid-quantity');
    if (fromBinderId === toBinderId) return refuse('same-binder');
    if (!toBinderId || toBinderId === 'want') return refuse('invalid-destination');

    const dest = (binders || []).find((b) => b.clientId === toBinderId);
    if (!dest || dest.deletedAt) return refuse('invalid-destination');

    const srcIdx = snapshot.findIndex((e) =>
        !e.isWanted &&
        (e.printingId || e.cardId) === printingId &&
        (e.binderId || null) === fromBinderId &&
        (e.condition || 'NM') === condition,
    );
    if (srcIdx < 0) return refuse('missing-source');
    const source = snapshot[srcIdx];
    if (qty > (Number(source.quantity) || 0)) return refuse('invalid-quantity');

    const remaining = (Number(source.quantity) || 0) - qty;
    if (remaining <= 0) snapshot.splice(srcIdx, 1);
    else snapshot[srcIdx] = { ...source, quantity: remaining };

    const destIdx = snapshot.findIndex((e) =>
        !e.isWanted &&
        (e.printingId || e.cardId) === printingId &&
        (e.binderId || null) === toBinderId &&
        (e.condition || 'NM') === condition,
    );
    if (destIdx >= 0) {
        snapshot[destIdx] = {
            ...snapshot[destIdx],
            quantity: (Number(snapshot[destIdx].quantity) || 0) + qty,
        };
    } else {
        snapshot.push({
            ...source,
            binderId: toBinderId,
            isWanted: false,
            quantity: qty,
            condition,
            printingId: source.printingId || source.cardId || printingId,
            cardId: source.cardId || source.printingId || printingId,
        });
    }

    return {
        ok: true,
        reason: null,
        entries: snapshot,
        distinctOwned: distinctOwnedCount(snapshot),
    };
}
