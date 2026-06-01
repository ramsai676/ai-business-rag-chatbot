# 💬 Business RAG Chatbot - embeddable AI support agent

> Feed it a business's FAQs and it answers customer questions **grounded in that content**, with **citations**, and honestly says *"I don't know"* instead of making things up. Drop it onto any website with **one script tag**.

A production-style **Retrieval-Augmented Generation (RAG)** chatbot: **BM25 retrieval** (no external embedding API) finds the relevant FAQ chunks, then **Claude** writes a natural, on-brand answer constrained to that context.

![status](https://img.shields.io/badge/status-production--ready-2ecc71)
![node](https://img.shields.io/badge/node-%3E%3D18-6c5ce7)
![license](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Why this project

A RAG chatbot is one of the most **in-demand and sellable** AI builds for small businesses. This one stands out because it is:

- **Grounded & honest** - answers come *only* from the business's own content; the model is instructed (and the pipeline enforces a relevance threshold) to refuse to invent hours, prices, or policies.
- **Cited** - every answer shows which FAQ section it used, so customers (and you) can trust it.
- **Dependency-light & offline-capable** - retrieval is **BM25 in pure JavaScript**: no vector database, no embedding API, no cost. Claude is optional and **falls back to extractive answers** without a key.
- **Truly embeddable** - a self-contained `widget.js` injects a floating chat bubble into any site without clashing with the host page's styles.

---

## 🖥️ Live demo

`npm start`, open <http://localhost:3002>, and click the 💬 bubble. It's pre-loaded with **Brew Haven Café**'s FAQ - try:

- *"What are your opening hours?"* · *"Do you have vegan options?"* · *"What's the Wi-Fi password?"* · *"Can I book for a group of 10?"*

### Screenshots

| Landing page | Answering from the FAQ (with citations) |
| :---: | :---: |
| ![Home screen](docs/01-home.png) | ![Chat widget answering a question](docs/02-result.png) |

---

## 🧠 How RAG works here

```
                    ┌──────────────────────────────┐
  customer Q ─────► │  BM25 retrieval (store.js)    │  ranks FAQ chunks
                    └───────────────┬──────────────┘
                                    │ top-k relevant chunks (+ scores)
                                    ▼
                    ┌──────────────────────────────┐
                    │  relevance threshold gate     │  no good match → "I don't know"
                    └───────────────┬──────────────┘
                                    ▼
                    ┌──────────────────────────────┐
                    │  Claude, constrained to       │  → grounded answer + citations
                    │  the retrieved context (rag.js)│     (extractive fallback w/o key)
                    └──────────────────────────────┘
```

---

## 🚀 Quick start

```bash
git clone https://github.com/<you>/ai-business-rag-chatbot.git
cd ai-business-rag-chatbot
npm install

cp .env.example .env       # optional: add ANTHROPIC_API_KEY for natural answers

npm start                  # → http://localhost:3002
npm test                   # 10 unit tests (retrieval + chunking), no network
```

---

## 🧩 Embed on any website

Host the app, then add **one tag** to your site:

```html
<script src="https://your-host/widget.js"
        data-api="https://your-host"
        data-name="Brew Haven Café"
        data-accent="#6c5ce7"></script>
```

The widget self-injects its own scoped styles and a floating launcher - no build step, no framework, no CSS conflicts.

---

## 🔌 API

| Endpoint | Body | Purpose |
| --- | --- | --- |
| `POST /api/chat` | `{ "question": "..." }` | Ask the bot. Returns `{ answer, sources[], grounded, source }`. |
| `POST /api/ingest` | `{ businessName, documents: [{id,title,text}] }` | Replace the knowledge base at runtime. |
| `GET /api/health` | - | `{ status, llm, businessName, chunks }`. |

### Use your own knowledge base
Either edit [`data/knowledge-base.json`](data/knowledge-base.json) and restart, or `POST /api/ingest` with your documents. Each document is `{ id, title, text }`; the engine chunks long text automatically.

---

## 🏗️ Tech stack

- **Retrieval:** custom **BM25** index + tokenizer (stopwords, length-normalised), pure JS
- **Generation:** Anthropic Claude (optional) with grounded-answer system prompt + extractive fallback
- **Backend:** Node.js + Express, CORS-enabled for cross-site embedding
- **Frontend:** zero-dependency embeddable widget + demo landing page
- **Tests:** `node:test` - chunking & retrieval ranking

## 📜 License

MIT - see [LICENSE](LICENSE).
