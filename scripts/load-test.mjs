#!/usr/bin/env node
// Simple load test: SONORA_BASE, SONORA_USER and SONORA_PASSWORD are required.
const BASE = (process.env.SONORA_BASE || 'http://127.0.0.1:3011').replace(/\/$/, '');
const USER = process.env.SONORA_USER;
const PASS = process.env.SONORA_PASSWORD;
if (!USER || !PASS) { console.error('SONORA_USER et SONORA_PASSWORD requis'); process.exit(2); }
const login = await fetch(BASE + '/api/mus/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) }).then((r) => r.json());
if (!login.token) { console.error('login rejected'); process.exit(2); }
const H = { Authorization: 'Bearer ' + login.token };
async function run(nom, n, conc, fn) {
  const lat = []; let ok = 0, ko = 0;
  let i = 0;
  async function worker() {
    while (i < n) {
      const j = i++;
      const t0 = performance.now();
      try { const r = await fn(j); if (r.status === 200 || r.status === 206 || r.status === 302) ok++; else ko++; }
      catch (e) { ko++; }
      lat.push(performance.now() - t0);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  lat.sort((a, b) => a - b);
  const p = (q) => Math.round(lat[Math.floor(lat.length * q)] || 0);
  console.log(JSON.stringify({ nom, n, conc, ok, ko, p50: p(0.5), p95: p(0.95), max: Math.round(lat[lat.length - 1] || 0) }));
}
await run('health', 300, 50, () => fetch(BASE + '/api/mus/health'));
await run('playlists', 200, 40, () => fetch(BASE + '/api/mus/playlists', { headers: H }));
await run('recos', 200, 40, () => fetch(BASE + '/api/mus/recos?n=20', { headers: H }));
await run('mix', 150, 30, () => fetch(BASE + '/api/mus/mix?n=30', { headers: H }));
await run('mixes', 150, 30, () => fetch(BASE + '/api/mus/mixes', { headers: H }));
