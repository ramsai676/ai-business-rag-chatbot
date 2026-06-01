// RAG orchestration: retrieve relevant chunks, then generate a grounded answer.
//
// With an ANTHROPIC_API_KEY, Claude writes a natural answer constrained to the
// retrieved context (and is told to say "I don't know" rather than hallucinate).
// Without a key, we fall back to an extractive answer built from the best chunk.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const MIN_SCORE = 0.5; // below this, treat retrieval as "no good match"

let client = null;
function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

export function llmAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function buildSystemPrompt(businessName) {
  return `You are a friendly, concise customer-support assistant for "${businessName}".

You answer ONLY using the CONTEXT provided with each question (excerpts from the business's own FAQ/knowledge base).

Rules:
- If the answer is in the context, give it warmly and briefly (1-4 sentences).
- If the context does NOT contain the answer, say you don't have that information and suggest contacting the business directly. NEVER invent hours, prices, policies, or contact details.
- Do not mention "context", "chunks", or that you are an AI model. Just be a helpful rep.
- Keep a natural, on-brand tone. No markdown headings.`;
}

function extractiveFallback(hits, businessName) {
  if (!hits.length) {
    return `I'm sorry, I don't have information about that. Please contact ${businessName} directly and the team will be happy to help.`;
  }
  // Return the best chunk, lightly cleaned, as a direct quote-style answer.
  const best = hits[0];
  return `Here's what I found in our information:\n\n"${best.text}"\n\nIf you need more detail, please reach out to ${businessName} directly.`;
}

/**
 * Answer a question against a KnowledgeBase.
 * @returns {{answer:string, sources:Array, grounded:boolean, source:'llm'|'fallback', model?:string}}
 */
export async function answer(kb, question, { businessName = 'our business', k = 4 } = {}) {
  const hits = kb.search(question, k);
  const goodHits = hits.filter((h) => h.score >= MIN_SCORE);
  const sources = goodHits.map((h) => ({ title: h.title, snippet: truncate(h.text, 160), score: h.score }));

  const c = getClient();
  if (!c) {
    return {
      answer: extractiveFallback(goodHits, businessName),
      sources,
      grounded: goodHits.length > 0,
      source: 'fallback',
    };
  }

  if (!goodHits.length) {
    return {
      answer: `I'm sorry, I don't have information about that. Please contact ${businessName} directly and the team will be happy to help.`,
      sources: [],
      grounded: false,
      source: 'llm',
      model: MODEL,
    };
  }

  const context = goodHits
    .map((h, i) => `[Source ${i + 1}: ${h.title}]\n${h.text}`)
    .join('\n\n---\n\n');

  const userPrompt = `CONTEXT:\n"""\n${context}\n"""\n\nCUSTOMER QUESTION: ${question}\n\nAnswer using only the context above.`;

  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: buildSystemPrompt(businessName),
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return {
      answer: text || extractiveFallback(goodHits, businessName),
      sources,
      grounded: true,
      source: 'llm',
      model: MODEL,
    };
  } catch (err) {
    return {
      answer: extractiveFallback(goodHits, businessName),
      sources,
      grounded: goodHits.length > 0,
      source: 'fallback',
      error: err.message,
    };
  }
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n).trim()}…` : s;
}
