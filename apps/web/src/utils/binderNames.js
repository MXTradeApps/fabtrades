/**
 * Binder name uniqueness. Golden cases: packages/contracts/binder_names.json
 * Normalize: trim, then case-fold for comparison. Empty after trim is invalid.
 */

export function normalizeBinderName(raw) {
    return String(raw ?? '').trim();
}

function fold(name) {
    return normalizeBinderName(name).toLowerCase();
}

/**
 * @param {{ proposedName: string, binders: Array, binderId?: string|null }} args
 * @returns {{ ok: boolean, normalized: string, reason: string|null, role: string|null }}
 */
export function validateBinderName({ proposedName, binders, binderId = null }) {
    const normalized = normalizeBinderName(proposedName);
    const self = binderId
        ? (binders || []).find((b) => b.clientId === binderId)
        : null;
    const selfRole = self?.role || null;

    if (!normalized) {
        return { ok: false, normalized: '', reason: 'empty', role: selfRole };
    }

    const folded = fold(normalized);
    const collision = (binders || []).some((b) => {
        if (b.deletedAt) return false;
        if (binderId && b.clientId === binderId) return false;
        return fold(b.name) === folded;
    });
    if (collision) {
        return {
            ok: false,
            normalized,
            reason: 'duplicate',
            role: selfRole,
        };
    }
    return {
        ok: true,
        normalized,
        reason: null,
        role: selfRole || 'standard',
    };
}
