// Garde anti-SSRF : https strict, IP privées rejetées, pin DNS anti-rebinding.
import { lookup } from 'node:dns/promises';
import https from 'node:https';

const V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
];
function long(ip) { const p = ip.split('.').map(Number); return (((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0; }
function inV4(ip, base, bits) { const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0; return (long(ip) & mask) === (long(base) & mask); }
export function isPrivateIp(ip) {
  if (!ip) return true;
  const l = String(ip).toLowerCase();
  if (l.includes(':')) {
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fd7a:115c:a1e0')) return true;
    if (l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd')) return true;
    const m = l.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/); if (m) return isPrivateIp(m[1]);
    return false;
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(l)) return true;
  return V4.some(([b, bits]) => inV4(l, b, bits));
}
function err(code, msg) { return Object.assign(new Error(msg || code), { code }); }
export async function guardUrl(raw) {
  let u; try { u = new URL(raw); } catch (e) { throw err('bad_url'); }
  if (u.protocol !== 'https:') throw err('not_https');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|.*\.lan)$/i.test(host)) throw err('private');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw err('private');
    return { url: u, ip: host };
  }
  let addrs; try { addrs = await lookup(host, { all: true }); } catch (e) { throw err('dns'); }
  if (!addrs.length) throw err('dns');
  for (const a of addrs) if (isPrivateIp(a.address)) throw err('private');
  return { url: u, ip: addrs[0].address };
}
// Requête épinglée sur l'IP résolue (SNI/Host = hostname) : anti-rebinding.
export function pinnedRequest(url, ip, timeoutMs, extraHeaders) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: ip, servername: url.hostname, port: 443,
      path: url.pathname + url.search, method: 'GET',
      headers: Object.assign({ Host: url.host, 'user-agent': 'Sonora/1.0 (+podcasts)' }, extraHeaders || {}),
      timeout: timeoutMs,
    }, (res) => resolve(res));
    req.on('timeout', () => { req.destroy(err('timeout')); });
    req.on('error', reject);
    req.end();
  });
}
// Fetch borné avec redirects suivis manuellement et re-gardés à chaque saut.
export async function safeFetchBuffer(raw, { maxBytes = 5 * 1024 * 1024, timeoutMs = 15000, redirects = 5 } = {}) {
  let current = raw;
  for (let i = 0; i <= redirects; i++) {
    const { url, ip } = await guardUrl(current);
    const res = await pinnedRequest(url, ip, timeoutMs);
    if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
      const loc = res.headers.location; res.resume();
      if (!loc) throw err('bad_redirect');
      const next = new URL(loc, url);
      if (next.protocol !== 'https:') throw err('downgrade');
      current = next.href; continue;
    }
    const chunks = []; let total = 0;
    await new Promise((resolve, reject) => {
      res.on('data', (c) => { total += c.length; if (total > maxBytes) { res.destroy(err('too_large')); return; } chunks.push(c); });
      res.on('end', resolve); res.on('error', reject); res.on('close', () => resolve());
    });
    return { status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) };
  }
  throw err('too_many_redirects');
}
// Suit les redirects en streaming, re-gardé à chaque saut (https strict, anti-SSRF).
export async function pinnedFollow(raw, extraHeaders, timeoutMs, redirects = 12) {
  let current = raw;
  for (let i = 0; i <= redirects; i++) {
    const { url, ip } = await guardUrl(current);
    const res = await pinnedRequest(url, ip, timeoutMs, extraHeaders);
    if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
      const loc = res.headers.location; res.resume();
      if (!loc) throw Object.assign(new Error('bad_redirect'), { code: 'bad_redirect' });
      const next = new URL(loc, url);
      if (next.protocol !== 'https:') throw Object.assign(new Error('downgrade'), { code: 'downgrade' });
      current = next.href; continue;
    }
    return res;
  }
  throw Object.assign(new Error('too_many_redirects'), { code: 'too_many_redirects' });
}
