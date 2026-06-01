// In-memory knowledge base with BM25 retrieval.
//
// Why BM25 (not vector embeddings)? It needs no external embedding API, runs
// instantly offline, and is a genuinely strong baseline for FAQ/short-doc
// retrieval. The RAG layer then feeds the top chunks to the LLM for a grounded
// answer. Swapping in embeddings later is a localized change to search().

const STOPWORDS = new Set(
  ('a an the and or but if then else of to in on at by for with about as into ' +
   'is are was were be been being do does did have has had i you he she it we they ' +
   'this that these those my your our their what which who whom how when where why ' +
   'can could should would will shall may might must not no yes so than too very ' +
   'just from up down out over under again here there all any both each more most ' +
   'other some such only own same s t').split(/\s+/),
);

const K1 = 1.5; // BM25 term-frequency saturation
const B = 0.75; // BM25 length normalisation

export function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Split a document into retrieval chunks. FAQ-style "Q: ... A: ..." blocks and
// blank-line-separated paragraphs are respected; long paragraphs are windowed.
export function chunkDocument(doc, { maxWords = 140 } = {}) {
  const blocks = doc.text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const chunks = [];
  for (const block of blocks) {
    const words = block.split(/\s+/);
    if (words.length <= maxWords) {
      chunks.push(block);
    } else {
      // Window long blocks with a small overlap to preserve context.
      const step = maxWords - 25;
      for (let i = 0; i < words.length; i += step) {
        chunks.push(words.slice(i, i + maxWords).join(' '));
        if (i + maxWords >= words.length) break;
      }
    }
  }
  return chunks.map((text, i) => ({
    id: `${doc.id}#${i}`,
    docId: doc.id,
    title: doc.title || doc.id,
    text,
  }));
}

export class KnowledgeBase {
  constructor() {
    this.reset();
  }

  reset() {
    this.chunks = [];
    this.df = new Map(); // term -> document (chunk) frequency
    this.avgLen = 0;
    this._tokenCache = [];
  }

  get size() {
    return this.chunks.length;
  }

  // Replace the whole KB with a fresh set of documents.
  ingest(documents) {
    this.reset();
    for (const doc of documents) {
      if (!doc || !doc.text || !doc.text.trim()) continue;
      const docChunks = chunkDocument(doc);
      this.chunks.push(...docChunks);
    }
    this._buildIndex();
    return this.size;
  }

  _buildIndex() {
    this.df = new Map();
    this._tokenCache = [];
    let totalLen = 0;
    for (const chunk of this.chunks) {
      // Index the title alongside the body - section titles ("Opening Hours")
      // are strong relevance signals for FAQ-style retrieval.
      const tokens = [...tokenize(chunk.title), ...tokenize(chunk.text)];
      this._tokenCache.push(tokens);
      totalLen += tokens.length;
      const seen = new Set(tokens);
      for (const term of seen) this.df.set(term, (this.df.get(term) || 0) + 1);
    }
    this.avgLen = this.chunks.length ? totalLen / this.chunks.length : 0;
  }

  _idf(term) {
    const n = this.chunks.length;
    const df = this.df.get(term) || 0;
    // BM25 idf with +1 smoothing to stay non-negative.
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  // Return the top-k chunks for a query, scored by BM25.
  search(query, k = 4) {
    if (!this.size) return [];
    const qTerms = tokenize(query);
    if (!qTerms.length) return [];

    const scored = this.chunks.map((chunk, idx) => {
      const tokens = this._tokenCache[idx];
      const len = tokens.length || 1;
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

      let score = 0;
      for (const term of qTerms) {
        const f = tf.get(term);
        if (!f) continue;
        const idf = this._idf(term);
        const denom = f + K1 * (1 - B + (B * len) / (this.avgLen || 1));
        score += idf * ((f * (K1 + 1)) / denom);
      }
      return { chunk, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => ({ ...s.chunk, score: Number(s.score.toFixed(3)) }));
  }
}
