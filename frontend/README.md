# 🧠 My Brain LM — Frontend SPA

This directory contains the premium web interface (Single Page Application) for interacting with **My Brain LM**, built using React, TypeScript, Vite, and Tailwind CSS.

---

## 🗺️ Project Features

Here is the list of key features implemented in this frontend client:

* **Knowledge Areas (Multi-Brain)**: Separate and organize documents and conversations into independent thematic areas (namespaces backed by ChromaDB).
* **Interactive Chat**: High-performance streaming interface utilizing Server-Sent Events (SSE) via `@assistant-ui/react`.
* **Context & Cost Tracking**: Dynamic context window meter in the header and precise real-time cost estimation per message queried from OpenRouter metadata.
* **Document Ingestion**: Drag & drop zones supporting PDF, TXT, and Markdown files, alongside custom web links (URLs) and raw text input.
* **Semantic RAG References**: Clickable, categorized relevance badges (High, Medium, Additional Context) for retrieved chunks.
* **Premium Dark Mode**: Highly responsive dashboard styling featuring smooth transition effects and custom color-coded area bubbles.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (version 18+)
* [pnpm](https://pnpm.io/) package manager

### Installation & Run
```bash
# 1. Install dependencies
pnpm install

# 2. Start the Vite development server
pnpm run dev
```

The web interface will be available at `http://localhost:5173`. Make sure you have the backend running at `http://localhost:8000`.

---

## 🛠️ Stack & Dependencies
* **Core**: React 19, Vite, TypeScript.
* **Routing & State**: React Router DOM.
* **RAG UI Primitive**: `@assistant-ui/react` & `@assistant-ui/react-markdown`.
* **Styling**: Tailwind CSS v4.
* **Icons**: `lucide-react`.
