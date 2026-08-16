/**
 * Read-only access to the shared Supabase card/price database (see
 * docs/mobile/DATABASE.md). This replaces the old committed CSV/JSON price
 * files under public/price-guide — the daily "Update FAB Prices" GitHub
 * Action ingests TCGCSV data straight into the database, and every surface
 * (web, mobile, build scripts) reads from there.
 *
 * Dependency-free on purpose: it runs both in the browser (Vite bundle) and
 * in Node 18+ (scripts/generateCatalog.js and scripts/generateSeoPages.js at
 * build time).
 *
 * At runtime the browser normally reads none of this: `fetchCatalog()` prefers
 * the static snapshot the build produces, and only falls back to these queries.
 * See the bottom of this file.
 */

// The publishable key is safe to ship in clients: all card/price tables are
// public read-only via RLS. Only the pipeline's service_role key can write. Which
// project it points at is what matters, so it comes from the environment.
import { requireSupabaseConfig } from '../config/env.js';

const PAGE_SIZE = 1000; // PostgREST caps a single response at 1000 rows.

const restFetch = async (pathAndQuery, headers = {}) => {
    // Resolved per request rather than at import, so a misconfigured deploy reports
    // the missing variable instead of failing to load the module.
    const { url, key } = requireSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            ...headers
        }
    });
    if (!response.ok) {
        throw new Error(`FAB database request failed (${response.status}): ${pathAndQuery}`);
    }
    return response;
};

const restGet = async (pathAndQuery) => (await restFetch(pathAndQuery)).json();

// Only the columns the web app actually consumes. Note the absences: the view
// also exposes clean_name, tcgplayer_url and modified_on, but nothing renders
// them, and across ~17k printings they are a fifth of the payload.
const CARD_COLUMNS = [
    'id', 'product_id', 'set_id', 'name', 'image_url',
    'sub_type_name', 'rarity', 'collector_number',
    'card_type', 'card_sub_type', 'card_class', 'talent', 'pitch', 'cost',
    'power', 'defense', 'life', 'intellect', 'set_name',
    'tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market', 'tcg_direct_low',
    'cm_avg', 'cm_low', 'cm_trend', 'cm_avg_foil', 'cm_low_foil', 'cm_trend_foil'
].join(',');

const catalogPage = (offset) =>
    `fab_cards_with_prices?select=${CARD_COLUMNS}` +
    `&is_sealed=eq.false&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`;

/**
 * Map a fab_cards_with_prices row to the row shape the app has always used
 * (the old consolidated-data.json / TCGCSV column names), so downstream code
 * (card objects, set grouping, SEO pages) is source-agnostic.
 */
const mapRowToLegacyShape = (row) => ({
    productId: row.product_id,
    name: row.name || '',
    groupId: row.set_id,
    imageUrl: row.image_url || '',
    lowPrice: row.tcg_low,
    midPrice: row.tcg_mid,
    highPrice: row.tcg_high,
    marketPrice: row.tcg_market,
    directLowPrice: row.tcg_direct_low,
    cardmarketTrend: row.cm_trend,
    cardmarketLow: row.cm_low,
    cardmarketAvg: row.cm_avg,
    cardmarketTrendFoil: row.cm_trend_foil,
    cardmarketLowFoil: row.cm_low_foil,
    cardmarketAvgFoil: row.cm_avg_foil,
    subTypeName: row.sub_type_name || '',
    extRarity: row.rarity || '',
    extNumber: row.collector_number || '',
    extCardType: row.card_type || '',
    extCardSubType: row.card_sub_type || '',
    extClass: row.card_class || '',
    extIntellect: row.intellect,
    extLife: row.life,
    extCost: row.cost,
    extPitchValue: row.pitch,
    extPower: row.power,
    extDefenseValue: row.defense,
    extTalent: row.talent || '',
    // The per-printing DB primary key ("<productId>-<subtype>") — stable
    // across ingests, used for card lookups and share-URL encoding.
    _uniqueId: row.id,
    _setName: row.set_name || ''
});

/**
 * All (non-sealed) card printings with current prices, in legacy row shape.
 *
 * The catalog is ~17 pages, and discovering the end by walking them one at a
 * time costs a full round trip per page. Asking PostgREST to report the total
 * in `Content-Range` on the first request turns the remaining sixteen into a
 * single parallel batch.
 */
export const fetchCatalogRows = async () => {
    const response = await restFetch(catalogPage(0), { Prefer: 'count=exact' });
    const firstPage = await response.json();
    const pages = [firstPage];

    if (firstPage.length === PAGE_SIZE) {
        const total = Number(String(response.headers.get('content-range') || '').split('/')[1]);
        let nextOffset = PAGE_SIZE;

        if (Number.isFinite(total) && total > PAGE_SIZE) {
            const offsets = [];
            for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) offsets.push(offset);
            pages.push(...await Promise.all(offsets.map((offset) => restGet(catalogPage(offset)))));
            nextOffset = PAGE_SIZE + offsets.length * PAGE_SIZE;
        }

        // Either the count header was missing, or rows were inserted after it was
        // taken. Walk whatever is left the slow way rather than truncate.
        for (; pages[pages.length - 1].length === PAGE_SIZE; nextOffset += PAGE_SIZE) {
            pages.push(await restGet(catalogPage(nextOffset)));
        }
    }

    return pages.flat().map(mapRowToLegacyShape);
};

/** All sets (TCGplayer groups) with browse metadata. */
export const fetchSetGroups = async () => {
    const rows = await restGet(
        'fab_sets?select=group_id,name,set_number,abbreviation,published_on,is_supplemental,modified_on' +
        '&order=group_id.asc'
    );
    return rows.map((row) => ({
        groupId: row.group_id,
        name: row.name || '',
        setNumber: row.set_number,
        abbreviation: row.abbreviation || '',
        publishedOn: row.published_on || null,
        isSupplemental: !!row.is_supplemental,
        modifiedOn: row.modified_on || null
    }));
};

/** ISO timestamp of the most recent price ingest, or null when unavailable. */
export const fetchPricesUpdatedAt = async () => {
    const rows = await restGet(
        'fab_card_prices?select=updated_at&order=updated_at.desc&limit=1'
    );
    return rows[0]?.updated_at || null;
};

/**
 * Shape of the prebuilt snapshot described below. Bumping it makes a deploy
 * ignore any snapshot written by an older build rather than misread it.
 */
export const CATALOG_SNAPSHOT_VERSION = 1;

/** Everything the app needs at startup, with `_setNumber` joined onto cards. */
export const fetchCatalogFromDatabase = async () => {
    const [rows, sets, pricesUpdatedAt] = await Promise.all([
        fetchCatalogRows(),
        fetchSetGroups(),
        fetchPricesUpdatedAt()
    ]);
    const setNumberByGroupId = new Map(
        sets.map((s) => [String(s.groupId), s.setNumber])
    );
    for (const row of rows) {
        row._setNumber = setNumberByGroupId.get(String(row.groupId)) || 0;
    }
    return { version: CATALOG_SNAPSHOT_VERSION, rows, sets, pricesUpdatedAt };
};

/**
 * URL of the catalog snapshot baked into this build, or null when there isn't
 * one. `vite.config.js` substitutes the literal; under plain Node (the SEO
 * generator) and Jest the identifier is simply absent, hence the `typeof`.
 */
const snapshotUrl = () =>
    (typeof __CATALOG_URL__ === 'undefined' ? null : __CATALOG_URL__);

const fetchCatalogSnapshot = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Catalog snapshot request failed (${response.status})`);
    }
    const snapshot = await response.json();
    if (snapshot?.version !== CATALOG_SNAPSHOT_VERSION || !Array.isArray(snapshot.rows)) {
        throw new Error('Catalog snapshot is malformed or from an incompatible build');
    }
    return snapshot;
};

/**
 * The catalog, preferring the snapshot `scripts/generateCatalog.js` writes at
 * build time.
 *
 * Reading it live costs seventeen paginated requests against PostgREST, none of
 * which the browser is allowed to cache — Supabase sends no `Cache-Control`, so
 * every visit paid for the whole catalog again. The snapshot is one immutable,
 * CDN-served file instead.
 *
 * Falling back to the database keeps `vite dev` working without a build step,
 * and covers a client whose cached bundle outlived the deploy its snapshot
 * shipped in.
 */
export const fetchCatalog = async () => {
    const url = snapshotUrl();
    if (url) {
        try {
            return await fetchCatalogSnapshot(url);
        } catch (error) {
            console.warn('[catalog] Falling back to a direct database read.', error);
        }
    }
    return fetchCatalogFromDatabase();
};
