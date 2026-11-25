#!/usr/bin/env node
// Passerelle publique Sonora-only : allowlist de chemins + rate-limit par IP.
// Le hub (3011) sert aussi d'autres apps (/libros, /mavie...) : cette passerelle garantit
// que l'exposition publique (Tailscale Funnel) ne donne acces QU'A Sonora.
import http from 'node:http'

const PORT = Number(process.env.GATEWAY_PORT || 3012)
const HOST = process.env.GATEWAY_HOST || '127.0.0.1'
const TARGET = new URL(process.env.GATEWAY_TARGET || 'http://127.0.0.1:3011')

const ALLOW = [/^\/musique\//, /^\/musique-legacy\//, /^\/api\/mus\//, /^\/api\/piped\//, /^\/api\/img\//, /^\/subsonic\//, /^\/api\/pod\//, /^\/podcast\/ep\//]
const LIMITS = [
  { re: /^\/api\/mus\/login$/, n: 10, w: 60000 },
  { re: /^\/api\/mus\/register$/, n: 5, w: 3600000 },
  { re: /^\/musique\/dl\//, n: 240, w: 60000 },
  { re: /^\/api\/img\//, n: 1200, w: 60000 },
  { re: /^\/api\/piped\//, n: 120, w: 60000 },
  { re: /^\/subsonic\//, n: 180, w: 60000 },
  { re: /^\/podcast\/ep\//, n: 120, w: 60000 },
]
const BUCKETS = new Map()
setInterval(() => { const now = Date.now(); for (const [k, b] of BUCKETS) if (now - b.at > 3600000) BUCKETS.delete(k) }, 300000).unref()

function ipDe(req) {
  const x = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return x || req.socket.remoteAddress || 'unknown'
}
function retryAfter(req, path) {
  const ip = ipDe(req)
  for (const L of LIMITS) {
    if (!L.re.test(path)) continue
    const key = ip + '|' + L.re.source
    const now = Date.now()
    let b = BUCKETS.get(key)
    if (!b || now - b.at > L.w) { b = { at: now, c: 0 }; BUCKETS.set(key, b) }
    b.c++
    if (b.c > L.n) return Math.max(1, Math.ceil((L.w - (now - b.at)) / 1000))
  }
  return 0
}

http.createServer((req, res) => {
  let url
  try { url = new URL(req.url, 'http://gw') } catch (e) { res.writeHead(400).end('bad request'); return }
  const path = url.pathname
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Frame-Options', 'DENY')
  if (path === '/' ) { res.writeHead(302, { Location: '/musique/' }).end(); return }
  if (!ALLOW.some((re) => re.test(path))) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return }
  const retry = retryAfter(req, path)
  if (retry > 0) { res.writeHead(429, { 'Retry-After': String(retry), 'Content-Type': 'application/json' }).end('{"error":"rate limit"}'); return }
  const headers = Object.assign({}, req.headers)
  headers.host = TARGET.host
  headers['x-forwarded-for'] = (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] + ', ' : '') + (req.socket.remoteAddress || '')
  headers['x-forwarded-proto'] = 'https'
  const up = http.request({ hostname: TARGET.hostname, port: TARGET.port || 80, path: req.url, method: req.method, headers }, (ur) => {
    res.writeHead(ur.statusCode || 502, ur.headers)
    ur.pipe(res)
  })
  up.on('error', () => { try { res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"upstream"}') } catch (e) { /* noop */ } })
  req.pipe(up)
}).listen(PORT, HOST, () => console.log('[gateway] http://' + HOST + ':' + PORT + ' -> ' + TARGET.href + ' (Sonora-only)'))
