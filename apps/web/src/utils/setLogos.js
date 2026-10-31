// Loads official FAB set logo URLs scraped from fabtcg.com marketing assets.
// Missing entries intentionally return null so the UI can fall back to the set name.

let logosCache = null;
let logosByNameCache = {};
let logosPromise = null;

const loadSetLogosCached = async () => {
    if (logosCache) return logosCache;
    if (logosPromise) return logosPromise;
    logosPromise = (async () => {
        try {
            const response = await fetch('/setLogos.json');
            if (!response.ok) {
                logosPromise = null;
                logosCache = {};
                return logosCache;
            }
            const data = await response.json();
            const logos = data?.logos && typeof data.logos === 'object' ? data.logos : {};
            // Normalize to groupId string -> logoUrl string
            const map = {};
            const byName = {};
            for (const [groupId, entry] of Object.entries(logos)) {
                const url = typeof entry === 'string' ? entry : entry?.logoUrl;
                if (url) map[String(groupId)] = url;
                if (entry?.name && (url || entry.abbreviation)) {
                    byName[entry.name] = { logoUrl: url || null, abbreviation: entry.abbreviation || '' };
                }
            }
            logosByNameCache = byName;
            logosCache = map;
            return logosCache;
        } catch (err) {
            console.warn('Failed to load set logos:', err);
            logosPromise = null;
            logosCache = {};
            return logosCache;
        }
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
