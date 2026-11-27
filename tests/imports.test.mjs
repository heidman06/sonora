import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceDeUrl, parseCsv } from '../server/imports.mjs';

test('sourceDeUrl détecte les 4 sources', () => {
  assert.deepEqual(sourceDeUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x'), { kind: 'spotify', id: '37i9dQZF1DXcBWIGoYBM5M' });
  assert.equal(sourceDeUrl('https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb').kind, 'apple');
  assert.deepEqual(sourceDeUrl('https://www.deezer.com/playlist/908622995'), { kind: 'deezer', id: '908622995' });
  assert.deepEqual(sourceDeUrl('https://www.youtube.com/playlist?list=PL1234567890'), { kind: 'youtube', id: 'PL1234567890' });
  assert.equal(sourceDeUrl('https://example.com/x'), null);
});

test('parseCsv déduplique et garde la playlist', () => {
  const r = parseCsv('Track name,Artist name,Playlist name\nBlinding Lights,The Weeknd,Hits\nBlinding Lights,The Weeknd,Hits\nOne More Time,Daft Punk,Party\n');
  assert.equal(r.source, 'csv');
  assert.equal(r.tracks.length, 2);
  assert.deepEqual(r.tracks[0], { title: 'Blinding Lights', artist: 'The Weeknd', playlist: 'Hits' });
  assert.equal(r.tracks[1].playlist, 'Party');
});
