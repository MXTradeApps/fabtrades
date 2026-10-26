import { splitPrintId } from './official.js';

// "IAR243-RF" and "IAR243" are the same number; the finish lives in sub_type_name.
function numberKey(collectorNumber) {
  return splitPrintId(collectorNumber).base.toUpperCase().replace(/[^A-Z0-9/]/g, '');
}

function twinKey(card) {
  return [card.set_id, card.name, card.sub_type_name || '', numberKey(card.collector_number)].join('|');
}

/**
 * Rows still in fab_cards that this run did not produce, paired with a row
 * this run did produce for the same printing (set, name, finish, number).
 *
 * TCGplayer sometimes moves a printing to a new product id, and an official
 * printing we filled in (`lss-…`) later shows up on TCGplayer. The upsert never
 * removes the old row, so the card shows the same version twice with a frozen
 * price. Rows with no fresh twin are left alone: they may be delisted, and
 * binders still point at them.
 */
export function findStaleTwins(existingRows, freshCards) {
  const freshIds = new Set(freshCards.map((card) => card.id));
  const twins = new Map();
  for (const card of freshCards) {
    if (card.is_sealed) continue;
    const key = twinKey(card);
    const current = twins.get(key);
    // Prefer a TCGplayer row (it has a price) over an official-only one.
    if (!current || (String(current.id).startsWith('lss-') && !String(card.id).startsWith('lss-'))) {
      twins.set(key, card);
    }
  }

  const pairs = [];
  for (const row of existingRows) {
    if (row.is_sealed || freshIds.has(row.id)) continue;
    const twin = twins.get(twinKey(row));
    if (twin) pairs.push({ stale: row.id, twin: twin.id });
  }
  return pairs;
}
