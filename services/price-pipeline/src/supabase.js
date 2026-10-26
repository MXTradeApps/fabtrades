import { UPSERT_CHUNK_SIZE } from './config.js';
import { findStaleTwins } from './stale.js';

const PAGE = 1000;

async function eachPage(supabase, table, column, pattern, onPage) {
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .like(column, pattern)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    if (!data?.length) return;
    await onPage(data);
    if (data.length < PAGE) return;
    from += PAGE;
  }
}

async function deleteWhereIn(supabase, table, column, ids) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) throw new Error(`Delete from ${table} failed: ${error.message}`);
  }
}

/**
 * `{productId}-base` is an older copy of the Normal printing. Once
 * `{productId}-normal` exists, drop the blank-finish row and point binders at
 * the Normal id. A binder that already has both keeps the Normal entry.
 */
export async function retireBaseDuplicates(supabase) {
  const baseIds = [];
  await eachPage(supabase, 'fab_cards', 'id', '%-base', async (rows) => {
    for (const row of rows) {
      if (String(row.id).endsWith('-base')) baseIds.push(row.id);
    }
  });

  const pairs = [];
  for (let i = 0; i < baseIds.length; i += 200) {
    const chunk = baseIds.slice(i, i + 200);
    const normalIds = chunk.map((id) => `${id.slice(0, -'base'.length)}normal`);
    const { data, error } = await supabase.from('fab_cards').select('id').in('id', normalIds);
    if (error) throw new Error(`Reading Normal printings failed: ${error.message}`);
    const present = new Set((data || []).map((row) => row.id));
    for (const base of chunk) {
      const normal = `${base.slice(0, -'base'.length)}normal`;
      if (present.has(normal)) pairs.push({ base, normal });
    }
  }

  if (pairs.length === 0) {
    console.log('   ✓ No blank-finish duplicates beside Normal');
    return 0;
  }

  await retireOntoTwins(
    supabase,
    pairs.map((pair) => ({ stale: pair.base, twin: pair.normal })),
    (stub) => ({ ...stub, sub_type_name: 'Normal' })
  );
  console.log(`   ✓ Linked ${pairs.length} blank-finish card${pairs.length === 1 ? '' : 's'} onto Normal`);
  return pairs.length;
}

/**
 * Drop each `stale` card id in favour of its `twin`: binder entries and price
 * alerts move to the twin, then the stale row and its prices go. A binder that
 * already holds the twin keeps that entry and the stale one is tombstoned.
 */
async function retireOntoTwins(supabase, pairs, patchStub = (stub) => stub) {
  const stales = pairs.map((pair) => pair.stale);
  const twinByStale = new Map(pairs.map((pair) => [pair.stale, pair.twin]));

  await deleteWhereIn(supabase, 'fab_price_history', 'card_id', stales);
  await deleteWhereIn(supabase, 'fab_card_prices', 'card_id', stales);

  for (let i = 0; i < stales.length; i += 200) {
    const chunk = stales.slice(i, i + 200);
    const { data, error } = await supabase
      .from('binder_entries')
      .select('id, card_id, card')
      .in('card_id', chunk);
    if (error) throw new Error(`Reading binder entries failed: ${error.message}`);
    for (const entry of data || []) {
      const twin = twinByStale.get(entry.card_id);
      if (!twin) continue;
      const stub = patchStub({ ...(entry.card || {}), id: twin });
      const { error: updateError } = await supabase
        .from('binder_entries')
        .update({ card_id: twin, card: stub })
        .eq('id', entry.id);
      if (!updateError) continue;
      if (updateError.code !== '23505') {
        throw new Error(`Relinking binder entry failed: ${updateError.message}`);
      }
      const { error: tombstoneError } = await supabase
        .from('binder_entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (tombstoneError) {
        throw new Error(`Retiring duplicate binder entry failed: ${tombstoneError.message}`);
      }
    }
  }

  // Alerts cascade on card delete, so move them first.
  for (const [stale, twin] of twinByStale) {
    const { error } = await supabase.from('fab_price_alerts').update({ card_id: twin }).eq('card_id', stale);
    if (error) throw new Error(`Relinking price alerts failed: ${error.message}`);
  }

  await deleteWhereIn(supabase, 'fab_cards', 'id', stales);
}

/**
 * Rows this run no longer produces that duplicate a printing it did produce
 * (see findStaleTwins). Retire them onto the fresh row.
 */
export async function retireStaleTwins(supabase, freshCards) {
  const existing = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('fab_cards')
      .select('id, set_id, name, sub_type_name, collector_number, is_sealed')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading fab_cards failed: ${error.message}`);
    existing.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }

  const pairs = findStaleTwins(existing, freshCards);
  if (pairs.length === 0) {
    console.log('   ✓ No stale duplicates');
    return 0;
  }
  await retireOntoTwins(supabase, pairs);
  console.log(`   ✓ Retired ${pairs.length} stale duplicate${pairs.length === 1 ? '' : 's'} onto the current printing`);
  return pairs.length;
}

// Upsert rows in chunks to stay within request size limits.
export async function upsertInChunks(supabase, table, rows, onConflict) {
  let count = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Upsert into "${table}" failed: ${error.message}`);
    }
    count += chunk.length;
  }
  return count;
}
