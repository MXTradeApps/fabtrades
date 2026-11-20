import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { HTTP_HEADERS } from './config.js';
import { LOGO_BUCKET, planSetLogos } from './setLogoPlan.js';

const MANIFEST_URL = new URL('../set-logos.json', import.meta.url);
// Logos render at a few hundred pixels at most; the originals run to several MB.
const MAX_EDGE = 640;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

async function loadSources() {
  const manifest = JSON.parse(await readFile(MANIFEST_URL, 'utf8'));
  return manifest.sources || {};
}

async function downloadLogo(url) {
  const res = await fetch(url, { headers: { ...HTTP_HEADERS, Accept: 'image/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'no content-type'})`);
  const source = Buffer.from(await res.arrayBuffer());
  if (source.length > MAX_SOURCE_BYTES) throw new Error(`too large (${source.length} bytes)`);
  return sharp(source)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function setLogoUrl(supabase, groupId, logoUrl) {
  const { error } = await supabase.from('fab_sets').update({ logo_url: logoUrl }).eq('group_id', groupId);
  if (error) throw new Error(error.message);
}

/**
 * Fill fab_sets.logo_url: copy each listed source into Storage once, then let
 * decks and kits without a logo of their own borrow their parent set's.
 * One set failing never stops the others, and the caller treats the whole step
 * as optional so logos can never fail a price run.
 */
export async function syncSetLogos(supabase) {
  const sources = await loadSources();
  const { data: sets, error } = await supabase.from('fab_sets').select('group_id,name,logo_url');
  if (error) throw new Error(`Reading fab_sets failed: ${error.message}`);

  const logoById = new Map(sets.map((set) => [set.group_id, set.logo_url || null]));
  const stats = { copied: 0, inherited: 0, failed: 0 };

  for (const { groupId, url } of planSetLogos(sets, sources).downloads) {
    try {
      const png = await downloadLogo(url);
      // The hash keeps a replaced logo from being served out of a stale cache.
      const hash = createHash('sha256').update(png).digest('hex').slice(0, 10);
      const path = `${groupId}-${hash}.png`;
      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, png, { contentType: 'image/png', cacheControl: '31536000', upsert: true });
      if (uploadError) throw new Error(uploadError.message);
      const publicUrl = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
      await setLogoUrl(supabase, groupId, publicUrl);
      logoById.set(groupId, publicUrl);
      stats.copied += 1;
    } catch (err) {
      stats.failed += 1;
      console.warn(`   ⚠ Logo for group ${groupId} skipped: ${err.message}`);
    }
  }

  // Re-plan with the fresh URLs so a parent copied a moment ago can be borrowed
  // in the same run.
  const current = sets.map((set) => ({ ...set, logo_url: logoById.get(set.group_id) }));
  for (const { groupId, parentGroupId } of planSetLogos(current, sources).inherits) {
    const parentUrl = logoById.get(parentGroupId);
    if (!parentUrl) continue;
    try {
      await setLogoUrl(supabase, groupId, parentUrl);
      stats.inherited += 1;
    } catch (err) {
      stats.failed += 1;
      console.warn(`   ⚠ Logo for group ${groupId} skipped: ${err.message}`);
    }
  }
  return stats;
}
