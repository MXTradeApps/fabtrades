import { supabase } from '../lib/supabase';

/**
 * The signed-in user's price alerts for one printing. Alerts are created and
 * managed in the mobile app; the web only shows them. RLS limits the query to
 * the caller's own rows.
 *
 * @param {string} cardId `fab_cards.id` (a printing's `_uniqueId`)
 * @returns {Promise<{ data: object[]|null, error: Error|null }>}
 */
export async function listPriceAlertsForCard(cardId) {
    if (!supabase || !cardId) return { data: [], error: null };
    const { data, error } = await supabase
        .from('fab_price_alerts')
        .select('id, card_id, direction, source, target_price, triggered_at, triggered_price, created_at')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });
    return { data: data ?? null, error: error ?? null };
}
