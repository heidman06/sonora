import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, guardUrl } from '../server/netguard.mjs';
test('isPrivateIp bloque loopback/prive/link-local/CGNAT/tailscale', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.52', '169.254.169.254', '100.91.72.87', '::1', 'fd7a:115c:a1e0::c2c:4858', 'fe80::1', '::ffff:127.0.0.1']) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '142.250.1.1', '2606:4700::1111']) assert.equal(isPrivateIp(ip), false, ip);
});
test('guardUrl refuse http et IP privées littérales', async () => {
  await assert.rejects(() => guardUrl('http://example.com/x'), (e) => e.code === 'not_https');
  await assert.rejects(() => guardUrl('https://127.0.0.1:3011/'), (e) => e.code === 'private');
  await assert.rejects(() => guardUrl('https://100.91.72.87/'), (e) => e.code === 'private');
  await assert.rejects(() => guardUrl('https://localhost/'), (e) => e.code === 'private');
  await assert.rejects(() => guardUrl('pas une url'), (e) => e.code === 'bad_url');
});
test('guardUrl accepte une IP publique littérale sans DNS', async () => {
  const g = await guardUrl('https://8.8.8.8/feed');
  assert.equal(g.ip, '8.8.8.8');
});
