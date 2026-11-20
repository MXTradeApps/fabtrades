// Pure planning for set logos, kept free of network and image dependencies so
// the web test suite can exercise it (see apps/web/tests/pipeline).

export const LOGO_BUCKET = 'set-logos';

// Products that have no logo of their own and show a parent set's instead.
// First match wins; each returns the parent set's exact name in fab_sets.
const PARENT_RULES = [
  [/^Historic Pack 1 Blitz Deck:/i, () => 'History Pack Vol.1'],
  [/^Blitz Deck: (.+) - .+$/i, (m) => m[1]],
  // The 2019 Hero Decks shipped alongside the first set and have no mark of their own.
  [/^Hero Deck: .+$/i, () => 'Welcome to Rathe'],
  [/^(.+) Pre-?release (?:Cards|Kit)$/i, (m) => m[1]],
  [/^(.+) - Antiquity Pack$/i, (m) => m[1]],
  [/^Silver Age: .+$/i, () => 'Silver Age Chapter 1'],
  [/^Smash Palace: .+$/i, () => 'Smash Palace']
];

/** Name of the set whose logo [name] borrows, or null when it stands alone. */
export function parentSetName(name) {
  const text = String(name || '').trim();
  for (const [pattern, toParent] of PARENT_RULES) {
    const match = text.match(pattern);
    if (match) {
      const parent = toParent(match).trim();
      return parent && parent !== text ? parent : null;
    }
  }
  return null;
}

const bucketFile = (url) => {
  const marker = `/${LOGO_BUCKET}/`;
  const at = String(url || '').indexOf(marker);
  return at === -1 ? null : String(url).slice(at + marker.length).split('?')[0];
};

/** True when [url] is this set's own stored copy (`<groupId>-<hash>.png`). */
export function isOwnLogo(url, groupId) {
  const file = bucketFile(url);
  return file !== null && file.startsWith(`${groupId}-`);
}

/** True when [url] is a stored copy that belongs to a different set. */
export function isInheritedLogo(url, groupId) {
  const file = bucketFile(url);
  return file !== null && !file.startsWith(`${groupId}-`);
}

/**
 * Decide what each set needs. Never touches a logo that is already the set's
 * own copy, or a URL someone set by hand outside the bucket.
 *
 * @param {{group_id:number,name:string,logo_url:string|null}[]} sets
 * @param {Record<string,{url:string}>} sources manifest keyed by group id
 * @returns {{ downloads: {groupId:number, url:string}[],
 *             inherits: {groupId:number, parentGroupId:number}[] }}
 */
export function planSetLogos(sets, sources = {}) {
  const byName = new Map(sets.map((set) => [set.name, set]));
  const downloads = [];
  const inherits = [];

  for (const set of sets) {
    const current = set.logo_url || null;
    const replaceable = current === null || isInheritedLogo(current, set.group_id);
    if (!replaceable) continue;

    const source = sources[String(set.group_id)]?.url;
    if (source) {
      downloads.push({ groupId: set.group_id, url: source });
      continue;
    }
    if (current !== null) continue;

    const parent = byName.get(parentSetName(set.name));
    if (parent && parent.group_id !== set.group_id) {
      inherits.push({ groupId: set.group_id, parentGroupId: parent.group_id });
    }
  }
  return { downloads, inherits };
}
