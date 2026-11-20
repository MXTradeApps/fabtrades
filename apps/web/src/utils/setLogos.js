// Set logos come from two places, merged here so every caller sees one map:
//   1. `fab_sets.logo_url` in the database (our own copies in Storage, filled by
//      the price pipeline). New logos arrive without a deploy.
//   2. `/setLogos.json`, the bundled list of fabtcg.com links. It covers a set the
//      database has no logo for, and everything when the database is unreachable.
// Missing entries intentionally return null so the UI can fall back to the set name.

let logosCache = null;
let logosByNameCache = {};
let logosPromise = null;

const loadBundledLogos = async () => {
    try {
        const response = await fetch('/setLogos.json');
        if (!response.ok) return {};
        const data = await response.json();
        return data?.logos && typeof data.logos === 'object' ? data.logos : {};
    } catch (err) {
        console.warn('Failed to load bundled set logos:', err);
        return {};
    }
};

// Never throws: a database without the column (or no database at all) leaves the
// bundled list in charge, which is how the site behaved before logos moved.
const loadStoredLogos = async () => {
    try {
        // Bounded, so a slow database cannot hold back the bundled logos.
        const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(5000) : undefined;
        // Loaded on demand so this module stays importable where the database
        // client is not configured; that case lands in the catch below.
        const { fetchSetLogos } = await import('../services/fabDb.js');
        return await fetchSetLogos({ signal });
    } catch (err) {
        console.warn('Failed to load set logos from the database:', err);
        return [];
    }
};

/**
 * Combine the bundled list with database rows. A database logo wins; the bundled
 * entry still supplies the abbreviation and fills any set the database lacks.
 *
 * @param {Record<string, string|{name?:string, abbreviation?:string, logoUrl?:string}>} bundled
 * @param {{groupId:number|string, name?:string, logoUrl?:string|null}[]} stored
 * @returns {{ map: Record<string,string>, byName: Record<string,{logoUrl:string|null, abbreviation:string}> }}
 */
export const mergeSetLogos = (bundled = {}, stored = []) => {
    const map = {};
    const byName = {};
    for (const [groupId, entry] of Object.entries(bundled || {})) {
        const url = typeof entry === 'string' ? entry : entry?.logoUrl;
        if (url) map[String(groupId)] = url;
        if (entry?.name && (url || entry.abbreviation)) {
            byName[entry.name] = { logoUrl: url || null, abbreviation: entry.abbreviation || '' };
        }
    }
    for (const row of stored || []) {
        if (!row?.logoUrl || row.groupId == null) continue;
        map[String(row.groupId)] = row.logoUrl;
        if (row.name) {
            byName[row.name] = { logoUrl: row.logoUrl, abbreviation: byName[row.name]?.abbreviation || '' };
        }
    }
    return { map, byName };
};

const loadSetLogosCached = async () => {
    if (logosCache) return logosCache;
    if (logosPromise) return logosPromise;
    logosPromise = (async () => {
        const [bundled, stored] = await Promise.all([loadBundledLogos(), loadStoredLogos()]);
        const { map, byName } = mergeSetLogos(bundled, stored);
        logosByNameCache = byName;
        logosCache = map;
        return logosCache;
    })();
    return logosPromise;
};

/**
 * React-friendly loader: returns { logoByGroupId, loading }.
 * logoByGroupId maps String(groupId) -> logo URL.
 */
export const loadSetLogoMap = loadSetLogosCached;

export const getSetLogoUrl = (logoByGroupId, groupId) => {
    if (!logoByGroupId || groupId == null) return null;
    return logoByGroupId[String(groupId)] || null;
};

/**
 * Set name -> { logoUrl, abbreviation } from the same file, for cards whose
 * catalog row (and so groupId) is missing. Empty until `loadSetLogoMap` resolves.
 */
export const getSetLogosByName = () => logosByNameCache;
