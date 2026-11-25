import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRss, stripTags, decodeEntities } from '../server/rss.mjs';
const FIX = '<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title><![CDATA[Show &amp; Co]]></title><itunes:author>Auteur</itunes:author><description><![CDATA[<p>Desc</p>]]></description><itunes:image href="https://x/img.jpg"/><item><title><![CDATA[Ep <b>1</b>]]></title><guid>g1</guid><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate><itunes:duration>12:34</itunes:duration><enclosure url="https://x/e1.mp3" type="audio/mpeg"/></item><item><title>Sans enclosure</title></item><item><title>Video</title><enclosure url="https://x/v.mp4" type="video/mp4"/></item><item><title>Bad date</title><guid>g3</guid><pubDate>pas une date</pubDate><itunes:duration>3600</itunes:duration><enclosure url="http://x/e3.mp3" type="audio/mpeg"/></item></channel></rss>';
test('parse canal + items, ignore sans-enclosure et video', () => {
  const r = parseRss(FIX);
  assert.equal(r.title, 'Show & Co');
  assert.equal(r.author, 'Auteur');
  assert.equal(r.description, 'Desc');
  assert.equal(r.image, 'https://x/img.jpg');
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].duration, 754);
  assert.equal(r.items[0].pubDate, '2026-11-02T10:00:00.000Z');
  assert.equal(r.items[1].pubDate, null);
  assert.equal(r.items[1].duration, 3600);
  assert.equal(r.items[1].enclosureUrl, 'http://x/e3.mp3');
});
test('guid fallback = hash enclosure', () => {
  const r = parseRss('<rss><channel><item><title>t</title><enclosure url="https://x/a.mp3" type="audio/mpeg"/></item></channel></rss>');
  assert.ok(r.items[0].guid.startsWith('h'));
});
test('Atom et JSON rejetés typés', () => {
  assert.throws(() => parseRss('<feed xmlns="http://www.w3.org/2005/Atom"></feed>'), (e) => e.code === 'unsupported_feed');
  assert.throws(() => parseRss('{"version":"https://jsonfeed.org/version/1"}'), (e) => e.code === 'unsupported_feed');
});
test('stripTags neutralise script et entités hex', () => {
  assert.equal(stripTags('<script>alert(1)</script>Bonjour &#x26; &#38;'), 'alert(1) Bonjour & &');
  assert.equal(decodeEntities('&#x41;&#66;'), 'AB');
});
test('BOM retiré', () => {
  const r = parseRss('\uFEFF' + FIX);
  assert.equal(r.title, 'Show & Co');
});
