import test from 'node:test';
import assert from 'node:assert/strict';
import { internals } from '../server/musique.mjs';

const { melanger, uniques, FILTRE_MIXTE, RECOS_VERSION } = internals;

test('filter rejects slowed versions and compilations', () => {
  for (const titre of [
    'DYGO - MONTAGEM BUDA (Slowed + Reverb)',
    'faouzia - peace & violence // slowed & reverb',
    'Best of 2026 (1 hour)',
    'Nightcore - Into You',
    'Track (8D Audio)',
    'Full Album Playlist',
    'Some song (lyrics video)',
  ]) {
    assert.equal(FILTRE_MIXTE.test(titre), true, titre);
  }
});

test('filter keeps normal titles', () => {
  for (const titre of ['Instant Crush (feat. Julian Casablancas)', 'PEACE AND VIOLENCE live version', 'Obsessed', 'FUNK INFERNAL']) {
    assert.equal(FILTRE_MIXTE.test(titre), false, titre);
  }
});

test('uniques deduplicates by videoId preserving order', () => {
  const items = [
    { videoId: 'a' }, { videoId: 'b' }, { videoId: 'a' }, { videoId: 'c' }, null, { videoId: '' },
  ];
  assert.deepEqual(uniques(items).map((x) => x.videoId), ['a', 'b', 'c']);
});

test('shuffle keeps all items', () => {
  const base = Array.from({ length: 40 }, (_, i) => ({ videoId: 'v' + i }));
  const out = melanger(base.slice());
  assert.equal(out.length, 40);
  assert.deepEqual(out.map((x) => x.videoId).sort(), base.map((x) => x.videoId).sort());
});

test('recos cache version is an integer', () => {
  assert.equal(Number.isInteger(RECOS_VERSION), true);
  assert.ok(RECOS_VERSION >= 4);
});
