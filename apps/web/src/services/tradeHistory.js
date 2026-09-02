import { supabase } from '../lib/supabase';
import { unlockAllFeatures } from '../utils/featureAccess.js';
import { tradesOverFreeLimit } from '../utils/freeLimits';
import { fetchEntitlement } from './entitlements';

/**
 * Ensure Supabase is configured and a user is authenticated.
 * @param {string} unauthedMessage - Message to return when no user is signed in
 * @returns {Promise<{ user: Object|null, error: Object|null }>}
 */
async function requireAuthenticatedUser(unauthedMessage) {
    if (!supabase) {
        return { user: null, error: { message: 'Authentication not configured' } };
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { user: null, error: { message: unauthedMessage } };
    }

    return { user, error: null };
}

/**
 * Roll the oldest trades off a free account's history.
 * No-op while [unlockAllFeatures] is on.
 */
async function trimToFreeWindow(userId) {
    if (unlockAllFeatures) return 0;

    const { entitlement } = await fetchEntitlement(userId);
    if (entitlement.isPro) return 0;

    const { data, error } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const overLimit = tradesOverFreeLimit(rows.length);
    if (overLimit === 0) return 0;

    const surplus = rows.slice(-overLimit).map((row) => row.id);

    const now = new Date().toISOString();
    const { error: trimError } = await supabase
        .from('trades')
        .update({ deleted_at: now, updated_at: now })
        .in('id', surplus);

    if (trimError) throw trimError;

    return surplus.length;
}

/**
 * Save a trade to the user's trade history
 *
 * Free accounts keep a rolling window of the most recent trades; `trimmed` says
 * how many rolled off, so the UI can say so rather than let them vanish quietly.
 *
 * Confirm Trade writes unnamed rows (`options.unnamed`), matching mobile. The
 * Save dialog still requires a name.
 *
 * @param {string|null} name - The name/title of the trade
 * @param {Array} haveList - Array of cards the user has
 * @param {Array} wantList - Array of cards the user wants
 * @param {Object} totals - Object containing haveTotal, wantTotal, and diff
 * @param {{ unnamed?: boolean }} [options]
 * @returns {Object} - { data, error, trimmed }
 */
export async function saveTradeToHistory(name, haveList, wantList, totals, options = {}) {
    try {
        const { user, error: authError } = await requireAuthenticatedUser('You must be logged in to save trades');
        if (authError) {
            return { data: null, error: authError, trimmed: 0 };
        }

        const unnamed = Boolean(options.unnamed);
        let tradeName = null;
        if (!unnamed) {
            if (!name || name.trim() === '') {
                return { data: null, error: { message: 'Trade name is required' }, trimmed: 0 };
            }
            tradeName = name.trim();
        }

        // `client_id` is how the mobile app addresses a row it has not yet seen a
        // server id for. Web has no such need, but the column is NOT NULL and shared,
        // so it mints one here too.
        const tradeData = {
            user_id: user.id,
            client_id: crypto.randomUUID(),
            name: tradeName,
            have_list: haveList,
            want_list: wantList,
            have_total: totals.haveTotal,
            want_total: totals.wantTotal,
            diff: totals.diff,
            updated_at: new Date().toISOString(),
        };

        // Insert trade into database
        const { data, error } = await supabase
            .from('trades')
            .insert([tradeData])
            .select()
            .single();

        if (error) throw error;

        // After the insert, and deliberately outside its failure path: the trade is
        // saved either way, and a trim that fails is worth a log, not an error the
        // customer sees about a save that worked.
        let trimmed = 0;
        try {
            trimmed = await trimToFreeWindow(user.id);
        } catch (trimError) {
            console.error('Error trimming trade history:', trimError);
        }

        return { data, error: null, trimmed };
    } catch (error) {
        console.error('Error saving trade:', error);
        return { data: null, error, trimmed: 0 };
    }
}

/**
 * Get all trades for the current user
 * @returns {Object} - { data, error }
 */
export async function getUserTrades() {
    try {
        const { user, error: authError } = await requireAuthenticatedUser('You must be logged in to view trade history');
        if (authError) {
            return { data: null, error: authError };
        }

        // Deleted trades are tombstoned rather than removed, so that a mobile device
        // that is offline when the delete happens learns about it on its next sync.
        // Those rows must not surface here.
        const { data, error } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('Error fetching trades:', error);
        return { data: null, error };
    }
}

/**
 * Get a specific trade by ID
 * @param {string} id - The trade ID
 * @returns {Object} - { data, error }
 */
export async function getTradeById(id) {
    try {
        const { user, error: authError } = await requireAuthenticatedUser('You must be logged in to view trades');
        if (authError) {
            return { data: null, error: authError };
        }

        // Fetch specific trade
        const { data, error } = await supabase
            .from('trades')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('Error fetching trade:', error);
        return { data: null, error };
    }
}

/**
 * Update an existing trade
 * @param {string} id - The trade ID
 * @param {Object} updates - Object containing fields to update
 * @returns {Object} - { data, error }
 */
export async function updateTrade(id, updates) {
    try {
        const { user, error: authError } = await requireAuthenticatedUser('You must be logged in to update trades');
        if (authError) {
            return { data: null, error: authError };
        }

        // Update trade
        const { data, error } = await supabase
            .from('trades')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('Error updating trade:', error);
        return { data: null, error };
    }
}

/**
 * Delete a trade from history
 *
 * Tombstoned rather than removed. A hard delete is invisible to a mobile device that
 * was offline at the time, which would re-upload the trade from its local copy on the
 * next sync and resurrect it.
 *
 * @param {string} id - The trade ID
 * @returns {Object} - { data, error }
 */
export async function deleteTrade(id) {
    try {
        const { user, error: authError } = await requireAuthenticatedUser('You must be logged in to delete trades');
        if (authError) {
            return { data: null, error: authError };
        }

        const now = new Date().toISOString();
        const { error } = await supabase
            .from('trades')
            .update({ deleted_at: now, updated_at: now })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;

        return { data: { success: true }, error: null };
    } catch (error) {
        console.error('Error deleting trade:', error);
        return { data: null, error };
    }
}

