import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// URL of the catalog snapshot written by `scripts/generateCatalog.js`, which the
// build runs just before this config is evaluated. Baking the hashed filename
// into the bundle means the app fetches the catalog in one request with no
// manifest lookup first. Absent in `vite dev`, and absent when generation failed
// — either way src/services/fabDb.js falls back to reading Supabase directly.
const catalogUrl = () => {
  try {
    return JSON.parse(readFileSync(new URL('./.catalog-snapshot.json', import.meta.url), 'utf8')).url
  } catch {
    return null
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // Only bake the snapshot into `vite build`. `vite dev` must read Supabase
  // live, or a leftover `.catalog-snapshot.json` freezes the "prices updated"
  // stamp (and the prices themselves) at the last generateCatalog run.
  const url = command === 'build' ? catalogUrl() : null
  if (url) console.log(`[vite] Catalog snapshot: ${url}`)

  return {
    plugins: [react()],
    // Allow importing shared brand tokens from packages/contracts.
    server: {
      fs: {
        allow: ['..', '../..'],
      },
    },
    define: {
      __CATALOG_URL__: JSON.stringify(url)
    }
  }
})
