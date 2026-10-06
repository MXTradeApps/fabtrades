/**
 * Build-time catalog snapshot for FAB Trades.
 *
 * The app needs the whole card catalog — every printing and its current price —
 * before search or trade math can work. Read live, that is ~17 paginated
 * PostgREST requests that the browser is not allowed to cache, because Supabase
 * returns no `Cache-Control` header. Every visit re-downloaded the lot.
 *
 * This script runs BEFORE `vite build` and freezes the catalog into a single
 * content-hashed file, which is the fast path between deploys. The pipeline can
 * publish newer prices without a rebuild; `fetchCatalog()` notices that from
 * `fab_card_prices.updated_at` and reads the database when the file is behind.
 *
 *   public/catalog/catalog-<hash>.json  -> copied verbatim into dist/ by Vite
 *   .catalog-snapshot.json              -> build metadata (gitignored)
 *
 * The hash in the filename is what makes it safe for netlify.toml to serve the
 * file `immutable`: new prices produce a new name, so nothing has to expire.
 * `vite.config.js` reads the metadata file and substitutes the URL into the
 * bundle, and `generateSeoPages.js` reads the snapshot off disk instead of
 * querying Supabase a second time.
 *
 * When it fails the build still proceeds: the app falls back to reading the
 * database directly, which is merely slow rather than broken.
 */

import { writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// Its own directory so netlify.toml can cache the whole prefix immutably
// without that rule ever reaching another public/ asset.
const OUTPUT_DIR = path.join(ROOT, 'public', 'catalog');

export const SNAPSHOT_METADATA_FILE = path.join(ROOT, '.catalog-snapshot.json');

// `vite build` reads .env itself; this script is plain Node and does not, so the
// same file is loaded here. On Netlify there is no .env and the variables are
// already in the environment, which is why existing values win.
Object.assign(process.env, {
    ...loadEnv('production', ROOT, 'VITE_'),
    ...process.env
});

// Imported after the environment is populated: fabDb resolves credentials lazily
// per request, but keeping the order explicit avoids a trap for the next reader.
const { fetchCatalogFromDatabase } = await import('../src/services/fabDb.js');

/** Delete snapshots from previous builds so public/ doesn't accumulate them. */
const removeStaleSnapshots = async (keep) => {
    const entries = await readdir(OUTPUT_DIR).catch(() => []);
    const stale = entries.filter((f) => /^catalog-[0-9a-f]+\.json$/.test(f) && f !== keep);
    await Promise.all(stale.map((f) => unlink(path.join(OUTPUT_DIR, f))));
    return stale;
};

const main = async () => {
    const startedAt = Date.now();
    const catalog = await fetchCatalogFromDatabase();

    if (!catalog.rows.length) {
        throw new Error('the catalog came back empty');
    }

    // Hashing the payload rather than the clock keeps the filename — and so every
    // client's cached copy — stable across rebuilds that change no data.
    const json = JSON.stringify(catalog);
    const hash = createHash('sha256').update(json).digest('hex').slice(0, 12);
    const filename = `catalog-${hash}.json`;

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(path.join(OUTPUT_DIR, filename), json, 'utf8');
    const removed = await removeStaleSnapshots(filename);

    await writeFile(
        SNAPSHOT_METADATA_FILE,
        JSON.stringify(
            {
                file: `catalog/${filename}`,
                url: `/catalog/${filename}`,
                rowCount: catalog.rows.length,
                setCount: catalog.sets.length,
                pricesUpdatedAt: catalog.pricesUpdatedAt,
                bytes: Buffer.byteLength(json),
                builtAt: new Date().toISOString()
            },
            null,
            2
        ) + '\n',
        'utf8'
    );

    const mb = (Buffer.byteLength(json) / 1048576).toFixed(2);
    console.log(
        `[catalog] ${catalog.rows.length} printings across ${catalog.sets.length} sets ` +
        `-> public/catalog/${filename} (${mb} MB, ${Date.now() - startedAt} ms)`
    );
    if (removed.length) console.log(`[catalog] Removed stale snapshot(s): ${removed.join(', ')}`);
};

main().catch(async (err) => {
    // A missing snapshot is a performance regression, not an outage, so the build
    // carries on. Clearing the metadata is what tells vite.config.js to leave the
    // snapshot URL unset and the app to read the database directly.
    console.warn(`[catalog] Snapshot generation failed (${err.message}).`);
    console.warn('[catalog] Building without one; the app will read Supabase directly.');
    await unlink(SNAPSHOT_METADATA_FILE).catch(() => {});
});
