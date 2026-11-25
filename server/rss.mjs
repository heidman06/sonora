// Parseur RSS pur (sans fetch, sans dep). Atom/JSON Feed rejetés typés.
function fnv(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
export function stripTags(s) { return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function unwrap(s) { const m = String(s || '').match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/); return m ? m[1] : String(s || ''); }
function tag(block, name) {
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i');
  const m = String(block || '').match(re);
  return m ? unwrap(m[1]).trim() : '';
}
const OPEN_RE = /<([A-Za-z][\w:.-]*)\b([^>]*)>/g;
function attr(block, name, a) {
  const re = new RegExp(OPEN_RE.source, 'g');
  const want = name.toLowerCase();
  let m;
  while ((m = re.exec(String(block || '')))) {
    if (m[1].toLowerCase() !== want) continue;
    const am = m[2].match(new RegExp(a + '="([^"]*)"'));
    if (am) return decodeEntities(am[1]);
  }
  return '';
}
function parseDuration(s) {
  const t = String(s || '').trim(); if (!t) return 0;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const p = t.split(':').map(Number); if (p.some(isNaN)) return 0;
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return 0;
}
function parseDate(s) { const d = new Date(String(s || '').trim()); return isNaN(d.getTime()) ? null : d.toISOString(); }
export function parseRss(text) {
  let t = String(text || '').replace(/^\uFEFF/, '');
  if (/^\s*\{/.test(t)) throw Object.assign(new Error('unsupported_feed'), { code: 'unsupported_feed' });
  if (/<feed[\s>]/i.test(t) && /xmlns="http:\/\/www.w3.org\/2005\/Atom"/i.test(t)) throw Object.assign(new Error('unsupported_feed'), { code: 'unsupported_feed' });
  const chanM = t.match(/<channel[\s\S]*?<\/channel>/i);
  const chan = chanM ? chanM[0] : t;
  const image = attr(chan, 'itunes:image', 'href') || tag(tag(chan, 'image'), 'url') || '';
  const items = [];
  const re = /<item\b[\s\S]*?<\/item>/gi; let m;
  while ((m = re.exec(t))) {
    const b = m[0];
    const encUrl = attr(b, 'enclosure', 'url');
    if (!encUrl) continue;
    const encType = attr(b, 'enclosure', 'type') || '';
    if (encType && !/^audio\//i.test(encType)) continue;
    const title = stripTags(tag(b, 'title'));
    const guid = tag(b, 'guid') || ('h' + fnv(encUrl));
    const desc = stripTags(tag(b, 'description') || tag(b, 'itunes:summary')).slice(0, 2000);
    items.push({ guid, title, description: desc, pubDate: parseDate(tag(b, 'pubDate')), duration: parseDuration(tag(b, 'itunes:duration')), enclosureUrl: encUrl, enclosureType: encType });
  }
  return {
    title: stripTags(tag(chan, 'title')),
    author: stripTags(tag(chan, 'itunes:author') || tag(chan, 'managingEditor')),
    description: stripTags(tag(chan, 'description')).slice(0, 2000),
    image, items,
  };
}
