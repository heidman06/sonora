/* Sonora — service worker maison, scope /musique/. Aucune dépendance.
 * Versionnage sans outillage : hash des URLs précachées (les hashes Vite des
 * assets changent à chaque build ⇒ nouveau cache ⇒ nouveau SW actif).
 * Allowlist stricte (design F4 / I3) : navigations (network-first, timeout 3 s,
 * repli cache) + /musique/assets/* (cache-first, immuables par hash).
 * TOUT le reste (api, subsonic, dl, hls, manifest, icônes, cross-origin)
 * n'est JAMAIS intercepté : pas de 206 en Cache API, pas de données auth.
 * Pas de skipWaiting automatique : message SKIP_WAITING → skipWaiting().
 */
const SCOPE = '/musique/'
const PREFIX = 'sonora-shell-'
let currentCache = ''

function hashUrls(urls) {
  const s = urls.join('|')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const res = await fetch(SCOPE, { cache: 'no-store' })
    if (!res.ok) throw new Error('sonora sw: shell HTTP ' + res.status)
    const html = await res.clone().text()
    const assets = new Set()
    const re = /assets\/index-[^"']+\.(?:js|css)/g
    let m
    while ((m = re.exec(html)) !== null) assets.add(SCOPE + m[0])
    const urls = [SCOPE].concat(Array.from(assets), [
      SCOPE + 'manifest.webmanifest',
      SCOPE + 'icon-180.png',
      SCOPE + 'icon-192.png',
      SCOPE + 'icon-512.png',
      SCOPE + 'favicon.svg',
      SCOPE + 'icon-maskable-512.png',
    ])
    currentCache = PREFIX + hashUrls(urls)
    try { const meta = await caches.open('sonora-meta'); await meta.put('current', new Response(currentCache)) } catch (e) { /* meta optionnel */ }
    const cache = await caches.open(currentCache)
    await cache.put(SCOPE, res)
    // Extension additive (S5) : scan des CSS précachés pour les woff2 Inter.
    const woff2 = new Set()
    await Promise.all(urls.slice(1).map(async (u) => {
      try {
        const r = await fetch(u, { cache: 'no-store' })
        if (!r.ok) return
        const rc = r.clone()
        await cache.put(u, r)
        if (/\.css(?:\?|$)/.test(u)) {
          const text = await rc.text()
          const re = /assets\/[^"')]+\.woff2/g
          let m
          while ((m = re.exec(text)) !== null) woff2.add(SCOPE + m[0])
        }
      } catch (e) { /* asset optionnel : le shell reste utilisable */ }
    }))
    await Promise.all(Array.from(woff2).map(async (u) => {
      try {
        const r = await fetch(u, { cache: 'no-store' })
        if (r.ok) await cache.put(u, r)
      } catch (e) { /* police optionnelle : repli stack system */ }
    }))
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const name = await activeName()
    if (!name) { await self.clients.claim(); return } // meta absent : ne jamais purger à l'aveugle
    const keys = await caches.keys()
    await Promise.all(keys
      .filter((k) => k.indexOf(PREFIX) === 0 && k !== name)
      .map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

async function networkFirst(req) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    let res
    try { res = await fetch(req, { signal: ctrl.signal }) } finally { clearTimeout(timer) }
    return res
  } catch (e) {
    const hit = (await caches.match(req, { ignoreSearch: true })) || (await caches.match(SCOPE))
    if (hit) return hit
    return new Response('Sonora hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}

async function activeName() {
  if (currentCache) return currentCache
  try {
    const meta = await caches.open('sonora-meta')
    const r = await meta.match('current')
    if (r) { currentCache = await r.text(); return currentCache }
  } catch (e) { /* pas de meta : pas de purge agressive */ }
  return ''
}

async function cacheFirst(req) {
  const hit = await caches.match(req)
  if (hit) return hit
  const res = await fetch(req)
  const name = await activeName()
  if (res.ok && name) {
    const cache = await caches.open(name)
    await cache.put(req, res.clone())
  }
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  let url
  try { url = new URL(req.url) } catch (e) { return }
  if (url.origin !== self.location.origin) return
  if (url.pathname === SCOPE + 'share') {
    const params = url.searchParams
    const cible = new URL(SCOPE, self.location.origin)
    cible.searchParams.set('share', JSON.stringify({ title: params.get('title') || '', text: params.get('text') || '', url: params.get('url') || '' }))
    event.respondWith(Response.redirect(cible.href, 303))
    return
  }
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req))
    return
  }
  if (url.pathname.indexOf(SCOPE + 'assets/') === 0) {
    event.respondWith(cacheFirst(req))
    return
  }
  // api, subsonic, dl, hls, manifest, icônes… → network-only, jamais intercepté.
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
