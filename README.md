# 🧠 My Brain LM

**your docs, your local intelligence** — A multi-area knowledge base application that allows you to query and make decisions based on your own documents using RAG (Retrieval Augmented Generation).

---

## 📋 Description

My Brain LM is a developer-focused, open-source alternative to tools like **Google's NotebookLM**, designed to query technical documentation, analyze research articles, study academic papers, make architectural decisions, or simply have an AI assistant that "knows" your local documents.

Unlike Google's NotebookLM, you are **not locked into Gemini models** or any single provider. The application is built using the standard OpenAI client interface but recommends routing through **OpenRouter**, giving you the complete freedom to use any state-of-the-art model available (such as **DeepSeek-V4**). It is a storage-local, custom-tailored workspace designed for deep studying, research, and learning. See [Privacy & Data](#-privacy--data) for details on how your data is handled.

### Key Features

*   🗂️ **Knowledge Areas (Multi-Brain)**: Organize documents and chats into separate, isolated thematic areas (namespaces in ChromaDB).
*   💬 **Interactive Chat**: High-performance streaming interface utilizing Server-Sent Events (SSE) via `@assistant-ui/react`.
*   🌐 **Model Freedom (via OpenRouter)**: Compatible with the standard OpenAI API specification but recommends OpenRouter out-of-the-box, letting you swap models on the fly (DeepSeek, Claude, GPT, etc.) without code changes.
*   📊 **Context & Cost Tracking**: Live context window occupancy meter and real-time cost estimation per conversation turn (using OpenRouter metrics).
*   📥 **Multi-Format Ingestion**: Supports Drag & Drop uploads for PDF, TXT, and Markdown files, alongside custom web link (URL) downloading and raw text pasting.
*   🔍 **Hybrid Search**: RAG query engine utilizing semantic embedding search combined with keyword retrieval (BM25) for accurate context matching. The retrieval weights can be customized via the backend configuration settings (defaults to a 70% semantic / 30% BM25 weight balance) to experiment and find the optimal retrieval blend.

### 🔒 Privacy & Data

Your **source files, chat histories (SQLite), and vector databases (ChromaDB) are always stored 100% locally** on your machine. No cloud database ever has your original documents.

However, your **level of inference privacy depends entirely on the provider you choose**:

| Provider | Storage | Inference Prompts | Privacy Level |
|---|---|---|---|
| **Local model** (Ollama, LM Studio) | 🟢 Local | 🟢 Local — nothing leaves your machine | **Full offline privacy** |
| **Trusted API** (OpenRouter, OpenAI, Anthropic) | 🟢 Local | 🟡 Sent to provider servers for processing | **Storage-private** — review your provider's data retention policy |

> **Important:** When using any external API, the text chunks retrieved from your documents and your questions are sent to the provider's servers for inference. Most reputable providers (OpenRouter, OpenAI, Anthropic) do **not** train on API data and have strict short-term retention policies, but your prompts do temporarily leave your machine. If you need **100% air-gapped privacy**, point the backend to a local model engine like [Ollama](https://ollama.com).

## 🛠️ Project Structure

```
my-brain/
├── backend/
│   ├── api/                # REST API Package (FastAPI)
│   │   ├── routes/         # Endpoints (status, ingest, chat, areas)
│   │   ├── app.py          # FastAPI application configuration
│   │   ├── models.py       # SQLModel database schemas
│   │   ├── schemas.py      # Pydantic validation schemas
│   │   └── database.py     # SQLite connection & database setup
│   ├── config.py           # Settings and environment loaders
│   ├── ingest.py           # Document chunking & embedding pipeline
│   ├── pricing.py          # OpenRouter pricing & context length metadata cache
│   ├── query.py            # RAG query engine & LLM stream executor
│   ├── migrate_add_usage.py# SQLite usage columns migration script
│   ├── run_api.py          # Uvicorn launcher
│   └── requirements.txt    # Python dependencies
├── frontend/               # React SPA Web Client
└── README.md               # General documentation (this file)
```

---

## 🚀 Getting Started

### 1. Backend Setup

#### Prerequisites
*   Python 3.10+
*   An API Key from [OpenRouter](https://openrouter.ai/) (or OpenAI)

#### Installation & Run
```bash
# 1. Navigate to backend directory
cd backend

# 2. Create virtual environment
python -m venv .venv

# 3. Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Setup environment variables
copy .env.example .env
# Edit .env and set your OPENAI_API_KEY and VITE_API_BASE_URL config

# 6. Start the API server
python run_api.py
```
The server will run on `http://127.0.0.1:8000`. You can inspect the Swagger documentation at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

#### Prerequisites
*   Node.js (version 18+)
*   pnpm package manager

#### Installation & Run
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm run dev
```
The client will run on `http://localhost:5173`.

---

## 🤝 Contributing

Contributions are welcome! If you have any suggestions or bug reports, please open an issue or submit a pull request.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
