import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { FREE_ENTITLEMENT, fetchEntitlement } from '../services/entitlements';
import { unlockAllFeatures } from '../utils/featureAccess.js';

const EntitlementContext = createContext({});

/**
 * **The** entitlement. Every Pro decision on web resolves through here, the same
 * way every Pro decision on mobile resolves through `entitlementProvider`.
 *
 * Returns:
 * - `isPro` — whether Pro features are unlocked
 * - `isInTrial`, `hasBillingIssue`, `isSandbox`, `expiresAt`, `productId`,
 *   `purchasedFrom` — detail for status copy
 * - `loading` — the row has not been read yet; gates should stay closed
 * - `refresh()` — re-read the row, for after a purchase completes elsewhere
 *
 * Web reads and never writes. Purchases happen in the apps, so the honest thing
 * to show a free customer here is where to buy, not a checkout that does not
 * exist.
 *
 * @returns {Object} The entitlement plus `loading` and `refresh`
 */
export const useEntitlement = () => useContext(EntitlementContext);

export const EntitlementProvider = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const [entitlement, setEntitlement] = useState(FREE_ENTITLEMENT);
    // Starts true so a gate never flashes "free" at a subscriber on first paint.
    const [loading, setLoading] = useState(true);

    const userId = user?.id ?? null;

    const load = useCallback(async () => {
        if (!userId) {
            setEntitlement(FREE_ENTITLEMENT);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { entitlement: next } = await fetchEntitlement(userId);
        setEntitlement(next);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        // Wait for auth to settle. Reading on a null user mid-restore would
        // resolve to free and then correct itself, which is exactly the flicker
        // `loading` exists to prevent.
        if (authLoading) return;
        load();
    }, [authLoading, load]);

    const value = useMemo(
        () => ({
            ...entitlement,
            isPro: unlockAllFeatures || entitlement.isPro,
            loading: loading || authLoading,
            refresh: load,
        }),
        [entitlement, loading, authLoading, load],
    );

    return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
};
