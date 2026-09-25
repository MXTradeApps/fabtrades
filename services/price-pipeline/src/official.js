// Legend Story Studios public card list. English printings are the catalog;
// other languages are translations of the same printings.
export const OFFICIAL_CARD_DATA_URL = 'https://d1pn9y8e99aays.cloudfront.net/public_card_data.csv';

const HTTP_HEADERS = {
  'User-Agent': 'fabtrades-pipeline/1.0 (+https://github.com/fabtrades; card & price ingest)',
  Accept: 'text/csv,*/*'
};

const ART_SUFFIXES = new Set(['MV', 'EA', 'AA', 'TP', 'CC', 'MVA']);
const FINISH_SUFFIXES = new Set(['RF', 'CF', 'GF']);

const ART_LABEL = {
  MV: 'Marvel',
  MVA: 'Marvel',
  EA: 'Extended Art',
  AA: 'Alternate Art',
  TP: 'Treasure',
  CC: 'CC Tag'
};

const COLOR_LABEL = { red: 'Red', yellow: 'Yellow', blue: 'Blue' };

const FINISH_LABEL = {
  regular: 'Normal',
  'rainbow-foil': 'Rainbow Foil',
  'cold-foil': 'Cold Foil',
  'gold-foil': 'Gold Foil'
};

const NAME_SET_CODE = /\s+-\s+([A-Z0-9]*[A-Z]+[0-9]+)\s*$/;

function blank(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function alphaKey(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function titleCase(value) {
  const text = blank(value);
  if (!text) return null;
  return text
    .split(/(\s+|-)/)
    .map((part) => (/[a-z]/i.test(part) ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join('');
}

// "U-ARC123-RF" → base U-ARC123, finish suffix RF. "MST095-MV" → base MST095, art MV.
export function splitPrintId(printId) {
  let rest = String(printId || '').trim();
  let art = null;
  const last = () => (rest.includes('-') ? rest.slice(rest.lastIndexOf('-') + 1) : '');
  const strip = () => {
    rest = rest.slice(0, rest.lastIndexOf('-'));
  };
  if (FINISH_SUFFIXES.has(last())) {
    strip();
  }
  if (ART_SUFFIXES.has(last())) {
    art = last();
    strip();
  }
  return { base: rest, art };
}

export function tcgFinish(subTypeName) {
  const text = (subTypeName || '').toLowerCase();
  if (text.includes('rainbow')) return 'rainbow-foil';
  if (text.includes('gold')) return 'gold-foil';
  if (text.includes('cold')) return 'cold-foil';
  return 'regular';
}

export function editionPrefix(subTypeName) {
  const text = (subTypeName || '').toLowerCase();
  if (text.includes('revised')) return 'R-';
  if (text.includes('unlimited')) return 'U-';
  return '';
}

function artHint(name) {
  const text = (name || '').toLowerCase();
  if (text.includes('(marvel)')) return 'MV';
  if (text.includes('extended art')) return 'EA';
  if (text.includes('alternate art') || text.includes('alt art')) return 'AA';
  if (text.includes('(treasure')) return 'TP';
  if (text.includes('cc tag')) return 'CC';
  return null;
}

function nameSetCode(name) {
  return NAME_SET_CODE.exec(String(name || '').trim())?.[1] || null;
}

export function officialDisplayName(printing) {
  let name = printing.trueName || printing.printedName || '';
  const color = COLOR_LABEL[(printing.color || '').toLowerCase()];
  if (color && !new RegExp(`\\(${color}\\)`, 'i').test(name)) name += ` (${color})`;
  const art = ART_LABEL[printing.art];
  if (art && !name.toLowerCase().includes(`(${art.toLowerCase()})`)) name += ` (${art})`;
  return name.trim();
}

function numbersAgree(current, printing) {
  const cur = alphaKey(current);
  if (!cur) return false;
  const id = alphaKey(printing.printId);
  const base = alphaKey(printing.base);
  if (cur === id || cur === base) return true;
  // Unlimited / revised ids prefix the number printed on the card.
  return base === `U${cur}` || base === `R${cur}`;
}

export function officialCollectorNumber(current, printing) {
  const cur = blank(current);
  if (!cur) return printing.printId;
  // "UPR042//UPR043" is one double-faced product. Keep both faces.
  if (cur.includes('//')) return cur;
  return numbersAgree(cur, printing) ? cur : printing.printId;
}

function finishAgrees(subTypeName, finish) {
  const text = (subTypeName || '').toLowerCase();
  if (finish === 'rainbow-foil') return text.includes('rainbow');
  if (finish === 'gold-foil') return text.includes('gold');
  if (finish === 'cold-foil') return text.includes('cold') && !text.includes('gold');
  return !text.includes('rainbow') && !text.includes('cold') && !text.includes('gold');
}

// Keep "Unlimited Edition" / "1st Edition" — Fabrary edition matching reads them —
// and correct the foil word from the official finish.
export function mergeSubtype(existing, finish) {
  const label = FINISH_LABEL[finish] || 'Normal';
  const text = existing || '';
  const lower = text.toLowerCase();
  let edition = '';
  if (lower.includes('unlimited')) edition = 'Unlimited Edition ';
  else if (lower.includes('revised')) edition = 'Revised Edition ';
  else if (lower.includes('1st')) edition = '1st Edition ';
  if (!edition && finishAgrees(text, finish)) return text || label;
  return `${edition}${label}`.trim();
}

function toPrinting(row) {
  const printId = blank(row.print_id);
  if (!printId) return null;
  const { base, art } = splitPrintId(printId);
  return {
    printId,
    base,
    art,
    finish: (blank(row.face_1_finish_type) || 'regular').toLowerCase(),
    setCode: (blank(row.set_code) || '').toUpperCase(),
    productName: blank(row.product_name) || '',
    trueName: blank(row.face_1_true_name),
    printedName: blank(row.face_1_name),
    color: (blank(row.face_1_true_color) || '').toLowerCase(),
    pitch: blank(row.face_1_true_pitch),
    cost: blank(row.face_1_true_cost),
    power: blank(row.face_1_true_power),
    defense: blank(row.face_1_true_defense),
    life: blank(row.face_1_true_life),
    intellect: blank(row.face_1_true_intellect),
    cardType: blank(row.face_1_types),
    cardSubType: blank(row.face_1_subtypes),
    cardClass: blank(row.face_1_classes),
    talent: blank(row.face_1_talents),
    rarity: titleCase(row.rarity),
    imageUrl: blank(row.face_1_thumbnail_large)
  };
}

export function indexOfficialPrintings(rows) {
  const printings = [];
  const byPrintId = new Map();
  const byBase = new Map();
  for (const row of rows) {
    if ((row.print_language || '').trim().toLowerCase() !== 'en') continue;
    const printing = toPrinting(row);
    if (!printing || byPrintId.has(printing.printId.toUpperCase())) continue;
    printings.push(printing);
    byPrintId.set(printing.printId.toUpperCase(), printing);
    const bucket = byBase.get(printing.base.toUpperCase()) || [];
    bucket.push(printing);
    byBase.set(printing.base.toUpperCase(), bucket);
  }
  return { printings, byPrintId, byBase };
}

function pickPrinting(card, list) {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0];

  let pool = list.slice();
  const hinted = artHint(card.name);
  if (hinted) {
    const narrowed = pool.filter((printing) => printing.art === hinted || (hinted === 'MV' && printing.art === 'MVA'));
    if (narrowed.length === 1) return narrowed[0];
    if (narrowed.length > 1) pool = narrowed;
  } else {
    const plain = pool.filter((printing) => !printing.art);
    if (plain.length > 0) pool = plain;
  }

  const name = (card.name || '').toLowerCase();
  if (name.includes('golden') || name.includes('gold foil')) {
    const gold = pool.filter((printing) => printing.finish === 'gold-foil');
    if (gold.length === 1) return gold[0];
    if (gold.length > 1) pool = gold;
  }

  const finish = tcgFinish(card.sub_type_name);
  const byFinish = pool.filter((printing) => printing.finish === finish);
  if (byFinish.length === 1) return byFinish[0];
  return null;
}

function lookupNumber(index, number, card) {
  const key = String(number || '').trim().toUpperCase();
  if (!key) return null;
  const exact = index.byPrintId.get(key);
  const finish = tcgFinish(card.sub_type_name);
  const art = artHint(card.name);
  const edition = editionPrefix(card.sub_type_name);
  // "ARC123" is the first-edition regular id. TCGplayer reuses it for rainbow
  // foils and for unlimited rows, which the official list numbers U-ARC123 / ARC123-RF.
  if (exact && !edition) {
    const artOk = !art || art === exact.art || (art === 'MV' && exact.art === 'MVA');
    const suffixed = key !== exact.base.toUpperCase();
    if (artOk && (suffixed || exact.finish === finish)) return exact;
  }
  const prefixed = /^(U|R)-/.test(key) ? key : `${edition}${key}`;
  return pickPrinting(card, index.byBase.get(prefixed));
}

function matchCard(card, index) {
  const printed = nameSetCode(card.name);
  const fromName = printed ? lookupNumber(index, printed, card) : null;
  const fromNumber = lookupNumber(index, card.collector_number, card);
  // The code TCGplayer appends to the name is the number printed on the card.
  // When it disagrees with extNumber, the official list says the name is right.
  if (fromName && (!fromNumber || fromName.printId !== fromNumber.printId)) {
    if (!fromNumber || !numbersAgree(card.collector_number, fromName)) return fromName;
  }
  return fromNumber;
}

function printingsForCard(card, index) {
  const found = [];
  const add = (printing) => {
    if (printing && !found.some((item) => item.printId === printing.printId)) found.push(printing);
  };
  const parts = String(card.collector_number || '')
    .split(/\s*\/\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    for (const part of parts) add(lookupNumber(index, part, card));
  } else {
    add(matchCard(card, index));
  }
  return found;
}

function normName(name) {
  return String(name || '')
    .replace(NAME_SET_CODE, '')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function pitchKey(card) {
  const raw = blank(card.pitch);
  if (raw && raw !== '0') return raw;
  const name = (card.name || '').toLowerCase();
  if (name.includes('(red)')) return '1';
  if (name.includes('(yellow)')) return '2';
  if (name.includes('(blue)')) return '3';
  return '';
}

function nameMatchKey(name, setCode, pitch, finish, art, edition) {
  return [normName(name), setCode || '', pitch || '', finish || '', art || '', edition || ''].join('|');
}

function editionOf(printing) {
  if (printing.base.startsWith('U-')) return 'U';
  if (printing.base.startsWith('R-')) return 'R';
  return editionPrefix(printing.base).replace('-', '') || '';
}

function uniqueNameIndex(printings) {
  const buckets = new Map();
  for (const printing of printings) {
    const key = nameMatchKey(
      printing.trueName || printing.printedName,
      printing.setCode,
      printing.pitch || '',
      printing.finish,
      printing.art || '',
      editionOf(printing)
    );
    const list = buckets.get(key) || [];
    list.push(printing);
    buckets.set(key, list);
  }
  const unique = new Map();
  for (const [key, list] of buckets) {
    if (list.length === 1) unique.set(key, list[0]);
  }
  return unique;
}

function assignField(card, field, value) {
  const next = value ?? null;
  const prev = card[field] ?? null;
  if (prev === next) return false;
  card[field] = next;
  return true;
}

function overlay(card, printing) {
  let changed = false;
  const name = officialDisplayName(printing);
  const doubleFaced = String(card.name || '').includes('//');
  if (name && !doubleFaced) changed = assignField(card, 'name', name) || changed;
  if (!doubleFaced) {
    changed = assignField(card, 'clean_name', printing.trueName || printing.printedName) || changed;
  }
  changed = assignField(card, 'rarity', printing.rarity) || changed;
  changed = assignField(card, 'collector_number', officialCollectorNumber(card.collector_number, printing)) || changed;
  changed = assignField(card, 'card_type', printing.cardType) || changed;
  changed = assignField(card, 'card_sub_type', printing.cardSubType) || changed;
  changed = assignField(card, 'card_class', printing.cardClass) || changed;
  changed = assignField(card, 'talent', printing.talent) || changed;
  changed = assignField(card, 'pitch', printing.pitch) || changed;
  changed = assignField(card, 'cost', printing.cost) || changed;
  changed = assignField(card, 'power', printing.power) || changed;
  changed = assignField(card, 'defense', printing.defense) || changed;
  changed = assignField(card, 'life', printing.life) || changed;
  changed = assignField(card, 'intellect', printing.intellect) || changed;
  const subtype = mergeSubtype(card.sub_type_name, printing.finish);
  changed = assignField(card, 'sub_type_name', subtype) || changed;
  changed = assignField(card, 'is_foil', printing.finish !== 'regular') || changed;
  if (!blank(card.image_url) && printing.imageUrl) {
    changed = assignField(card, 'image_url', printing.imageUrl) || changed;
  }
  return changed;
}

/**
 * Map official printings onto existing catalog rows. Card ids stay put so
 * prices, history, and binders keep their keys. Identity fields that disagree
 * are rewritten from the official printing.
 */
export function applyOfficialCards(cards, officialRows, groupsById = new Map()) {
  const index = indexOfficialPrintings(officialRows);
  const claimed = new Map();
  const decided = new Map();
  const stats = { official: index.printings.length, matched: 0, corrected: 0, unmatchedSingles: 0, unmatchedSample: [] };

  // Several TCGplayer rows can be the same printing (a blitz deck reprint, a
  // cold foil, and the main-set copy). Each keeps its own id and price; they
  // share the official identity. `claimed` only stops us from inserting a
  // second, unpriced copy of a printing we already have.
  const claim = (card, printing, primary = false) => {
    if (!printing) return false;
    claimed.set(printing.printId, card.id);
    if (primary && !decided.has(card.id)) decided.set(card.id, printing);
    return true;
  };

  const singles = cards.filter((card) => !card.is_sealed);
  const faceIndex = uniqueNameIndex(index.printings);
  for (const card of singles) {
    const matches = printingsForCard(card, index);
    matches.forEach((printing, i) => claim(card, printing, i === 0));
    if (!String(card.name || '').includes('//')) continue;
    const group = groupsById.get(Number(card.set_id));
    const setCode = (group?.abbreviation || '').toUpperCase();
    if (!setCode) continue;
    const edition = editionPrefix(card.sub_type_name).replace('-', '');
    for (const face of String(card.name).split(/\s*\/\/\s*/)) {
      const key = nameMatchKey(
        face,
        setCode,
        pitchKey({ ...card, name: face }),
        tcgFinish(card.sub_type_name),
        artHint(face) || artHint(card.name) || '',
        edition
      );
      claim(card, faceIndex.get(key) || null, !decided.has(card.id));
    }
  }

  const nameIndex = uniqueNameIndex(index.printings.filter((printing) => !claimed.has(printing.printId)));
  for (const card of singles) {
    if (decided.has(card.id)) continue;
    const group = groupsById.get(Number(card.set_id));
    const setCode = (group?.abbreviation || '').toUpperCase();
    if (!setCode) continue;
    const edition = editionPrefix(card.sub_type_name).replace('-', '');
    const key = nameMatchKey(
      card.name,
      setCode,
      pitchKey(card),
      tcgFinish(card.sub_type_name),
      artHint(card.name) || '',
      edition
    );
    claim(card, nameIndex.get(key) || null, true);
  }

  for (const card of singles) {
    const printing = decided.get(card.id);
    if (!printing) {
      stats.unmatchedSingles += 1;
      if (stats.unmatchedSample.length < 8) {
        stats.unmatchedSample.push(
          `${card.collector_number || '—'} | ${card.sub_type_name || '—'} | ${card.name}`
        );
      }
      continue;
    }
    stats.matched += 1;
    if (overlay(card, printing)) stats.corrected += 1;
  }

  return { claimed, stats, printings: index.printings };
}

function resolveGroup(printing, groups) {
  const matches = groups.filter((group) => (group.abbreviation || '').toUpperCase() === printing.setCode);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) return null;
  const product = printing.productName.trim().toLowerCase();
  const named = matches.filter((group) => group.name.trim().toLowerCase() === product);
  return named.length === 1 ? named[0] : null;
}

function syntheticProductId(base, idsByBase) {
  const existing = idsByBase.get(base);
  if (existing !== undefined) return existing;
  let hash = 2166136261;
  const source = `lss:${base}`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let id = -((hash >>> 0) % 2000000000 + 1);
  const taken = new Set(idsByBase.values());
  while (taken.has(id)) id -= 1;
  idsByBase.set(base, id);
  return id;
}

/**
 * Official printings that did not map onto a TCGplayer row. Inserted under the
 * set we already know, with no price row, so the catalog gains the card
 * without inventing a market price or reusing an existing id.
 */
export function buildUnmatchedOfficialCards(officialRows, claimed, groups, now) {
  const { printings } = indexOfficialPrintings(officialRows);
  const idsByBase = new Map();
  const cards = [];
  let skipped = 0;
  for (const printing of printings) {
    if (claimed.has(printing.printId)) continue;
    const group = resolveGroup(printing, groups);
    if (!group) {
      skipped += 1;
      continue;
    }
    const subtype = FINISH_LABEL[printing.finish] || 'Normal';
    cards.push({
      id: `lss-${printing.printId}`,
      product_id: syntheticProductId(printing.base, idsByBase),
      set_id: Number(group.groupId ?? group.group_id),
      unique_id: printing.printId,
      name: officialDisplayName(printing),
      clean_name: printing.trueName || printing.printedName,
      image_url: printing.imageUrl,
      tcgplayer_url: null,
      sub_type_name: subtype,
      is_foil: printing.finish !== 'regular',
      rarity: printing.rarity,
      collector_number: printing.printId,
      is_sealed: false,
      cardmarket_id: null,
      cardmarket_name: null,
      card_type: printing.cardType,
      card_sub_type: printing.cardSubType,
      card_class: printing.cardClass,
      talent: printing.talent,
      pitch: printing.pitch,
      cost: printing.cost,
      power: printing.power,
      defense: printing.defense,
      life: printing.life,
      intellect: printing.intellect,
      modified_on: null,
      updated_at: now
    });
  }
  return { cards, skipped };
}

export async function fetchOfficialPrintings(url = OFFICIAL_CARD_DATA_URL) {
  const res = await fetch(url, { headers: HTTP_HEADERS });
  if (!res.ok) {
    throw new Error(`Failed to fetch official card list: ${res.status} ${res.statusText}`);
  }
  const csvText = await res.text();
  const { default: Papa } = await import('papaparse');
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => (typeof value === 'string' ? value.trim() : value)
  });
  if (parsed.errors?.length) {
    console.warn('   ⚠ Official card CSV warnings:', parsed.errors.slice(0, 3));
  }
  const english = (parsed.data || []).filter((row) => (row.print_language || '').toLowerCase() === 'en');
  if (english.length === 0) {
    throw new Error('Official card list contained no English printings');
  }
  return english;
}
