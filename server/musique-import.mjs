#!/usr/bin/env node
// Spotify CSV import ("My Spotify Library" export) -> pending (background YouTube resolution)
import { ouvrirBase } from './musique.mjs';
import { readFileSync } from 'node:fs';

const [, , csvPath, username] = process.argv;
if (!csvPath || !username) { console.error('usage: musique-import.mjs <csv> <username>'); process.exit(1); }

function parseLigne(l) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const db = ouvrirBase();
const u = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (!u) { console.error('utilisateur inconnu:', username); process.exit(1); }

const lignes = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
const head = parseLigne(lignes[0]);
const iT = head.indexOf('Track name'), iA = head.indexOf('Artist name'), iP = head.indexOf('Playlist name');
const deja = new Set();
let likes = 0, ajouts = 0, playlists = new Map();

const insPending = db.prepare('INSERT INTO pending (user_id, playlist_id, title, artist) VALUES (?, ?, ?, ?)');
const trouver = db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?');
const creer = db.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)');

db.exec('BEGIN');
for (const l of lignes.slice(1)) {
  const r = parseLigne(l);
  const titre = (r[iT] || '').trim(), artiste = (r[iA] || '').trim(), liste = (r[iP] || '').trim();
  if (!titre) continue;
  const cle = (liste + '|' + titre + '|' + artiste).toLowerCase();
  if (deja.has(cle)) continue;
  deja.add(cle);
  if (!liste || /^favorite songs$/i.test(liste)) {
    insPending.run(u.id, null, titre, artiste);
    likes++;
  } else {
    let p = trouver.get(u.id, liste);
    if (!p) { creer.run(u.id, liste); p = trouver.get(u.id, liste); }
    playlists.set(liste, (playlists.get(liste) || 0) + 1);
    insPending.run(u.id, p.id, titre, artiste);
    ajouts++;
  }
}
db.exec('COMMIT');
console.log(JSON.stringify({ likes, playlistTracks: ajouts, playlists: Object.fromEntries(playlists) }, null, 1));
