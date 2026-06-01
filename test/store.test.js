import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeBase, tokenize, chunkDocument } from '../src/store.js';

const DOCS = [
  { id: 'hours', title: 'Hours', text: 'We are open Monday to Friday from 7 AM to 8 PM. On weekends we open later.' },
  { id: 'parking', title: 'Parking', text: 'Free customer parking is available for two hours in the lot behind the cafe.' },
  { id: 'wifi', title: 'Wi-Fi', text: 'Free high-speed wifi is available. The password is printed on your receipt.' },
];

test('tokenize lowercases, strips punctuation and stopwords', () => {
  const toks = tokenize('We are OPEN, Monday-to-Friday!');
  assert.ok(toks.includes('open'));
  assert.ok(toks.includes('monday'));
  assert.ok(!toks.includes('we'));
  assert.ok(!toks.includes('are'));
});

test('chunkDocument keeps short blocks whole', () => {
  const chunks = chunkDocument({ id: 'd', title: 'D', text: 'Short paragraph one.\n\nShort paragraph two.' });
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].docId, 'd');
  assert.match(chunks[0].id, /^d#0$/);
});

test('chunkDocument windows long blocks', () => {
  const text = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
  const chunks = chunkDocument({ id: 'long', title: 'Long', text });
  assert.ok(chunks.length > 1, 'long block should be split');
});

test('ingest builds an index and reports chunk count', () => {
  const kb = new KnowledgeBase();
  const n = kb.ingest(DOCS);
  assert.equal(n, 3);
  assert.equal(kb.size, 3);
});

test('search returns the most relevant chunk first', () => {
  const kb = new KnowledgeBase();
  kb.ingest(DOCS);
  const hits = kb.search('what time do you open?');
  assert.ok(hits.length > 0);
  assert.equal(hits[0].docId, 'hours');
});

test('search ranks wifi question to the wifi doc', () => {
  const kb = new KnowledgeBase();
  kb.ingest(DOCS);
  const hits = kb.search('what is the wifi password');
  assert.equal(hits[0].docId, 'wifi');
});

test('search on irrelevant query returns no positive matches', () => {
  const kb = new KnowledgeBase();
  kb.ingest(DOCS);
  const hits = kb.search('zzzqqq nonexistent quantum spaceship');
  assert.equal(hits.length, 0);
});

test('empty KB returns empty results', () => {
  const kb = new KnowledgeBase();
  assert.deepEqual(kb.search('anything'), []);
});

test('ingest skips empty documents', () => {
  const kb = new KnowledgeBase();
  const n = kb.ingest([{ id: 'a', title: 'A', text: 'real content here' }, { id: 'b', title: 'B', text: '' }]);
  assert.equal(n, 1);
});

test('scores are attached and sorted descending', () => {
  const kb = new KnowledgeBase();
  kb.ingest(DOCS);
  const hits = kb.search('free parking lot');
  assert.ok(typeof hits[0].score === 'number');
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1].score >= hits[i].score);
});
