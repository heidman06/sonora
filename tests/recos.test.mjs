import test from 'node:test';
import assert from 'node:assert/strict';
import { internals } from '../server/musique.mjs';

const { melanger, uniques, FILTRE_MIXTE, RECOS_VERSION } = internals;

test('le filtre rejette les versions ralenties et les compilations', () => {
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

test('le filtre garde les titres normaux', () => {
  for (const titre of ['Instant Crush (feat. Julian Casablancas)', 'PEACE AND VIOLENCE live version', 'Obsessed', 'FUNK INFERNAL']) {
    assert.equal(FILTRE_MIXTE.test(titre), false, titre);
  }
});

test('uniques déduplique par videoId en conservant l ordre', () => {
  const items = [
    { videoId: 'a' }, { videoId: 'b' }, { videoId: 'a' }, { videoId: 'c' }, null, { videoId: '' },
  ];
  assert.deepEqual(uniques(items).map((x) => x.videoId), ['a', 'b', 'c']);
});

test('melanger conserve tous les éléments sans perte', () => {
  const base = Array.from({ length: 40 }, (_, i) => ({ videoId: 'v' + i }));
  const out = melanger(base.slice());
  assert.equal(out.length, 40);
  assert.deepEqual(out.map((x) => x.videoId).sort(), base.map((x) => x.videoId).sort());
});

test('la version du cache recos est un entier', () => {
  assert.equal(Number.isInteger(RECOS_VERSION), true);
  assert.ok(RECOS_VERSION >= 4);
});
