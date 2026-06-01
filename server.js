import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { KnowledgeBase } from './src/store.js';
import { answer, llmAvailable } from './src/rag.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json({ limit: '1mb' }));
// Allow the widget to be embedded / called from any origin (it's a public bot).
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(join(__dirname, 'public')));

// Load the bundled sample knowledge base on boot.
const kb = new KnowledgeBase();
let businessName = 'our business';
try {
  const raw = JSON.parse(readFileSync(join(__dirname, 'data', 'knowledge-base.json'), 'utf8'));
  businessName = raw.businessName || businessName;
  const count = kb.ingest(raw.documents || []);
  console.log(`  📚 Loaded knowledge base for "${businessName}" (${count} chunks)`);
} catch (err) {
  console.warn('  ⚠️  Could not load data/knowledge-base.json:', err.message);
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', llm: llmAvailable() ? 'enabled' : 'fallback', businessName, chunks: kb.size });
});

// Replace the knowledge base at runtime (admin/demo use).
app.post('/api/ingest', (req, res) => {
  const { documents, businessName: name } = req.body || {};
  if (!Array.isArray(documents) || !documents.length) {
    return res.status(400).json({ error: 'Provide a non-empty "documents" array of { id, title, text }.' });
  }
  const count = kb.ingest(documents);
  if (name) businessName = name;
  res.json({ ok: true, chunks: count, businessName });
});

// Ask the bot a question.
app.post('/api/chat', async (req, res) => {
  const question = (req.body?.question ?? '').toString().trim();
  if (!question) return res.status(400).json({ error: 'Please provide a "question".' });
  if (question.length > 2000) return res.status(413).json({ error: 'Question too long.' });

  try {
    const result = await answer(kb, question, { businessName });
    res.json(result);
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: 'Something went wrong answering that.' });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`\n  💬  Business RAG Chatbot on http://localhost:${PORT}`);
    console.log(`      LLM answers: ${llmAvailable() ? 'ENABLED (Claude)' : 'fallback/extractive mode'}\n`);
  });
}

export default app;
