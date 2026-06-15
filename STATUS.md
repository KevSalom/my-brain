# 🧠 My Brain LM — Estado Actual del Proyecto

> **Última actualización:** 2026-06-12
> **Fase actual:** Fase 2 (MVP Frontend con React + Tailwind + assistant-ui) — COMPLETADA ✅
> **Próxima fase:** Fase 3 (Multi-Cerebro)

---

## TL;DR para LLMs

My Brain LM es un sistema RAG personal para desarrolladores.
- **Backend (Python + FastAPI)**: API funcional con endpoints para estado (`/api/status`), ingesta de archivos (`/api/ingest/file`), directorios (`/api/ingest/directory`), y chat síncrono/stream RAG por SSE. Usa ChromaDB local y fusiona embeddings de OpenAI (`text-embedding-3-small`) con BM25 léxico mediante RRF.
- **Frontend (React + Vite + TypeScript)**: SPA funcional conectada al backend local en `http://localhost:8000`. Usa Tailwind CSS v4 para diseño oscuro premium, la librería headless `assistant-ui` con un custom parser SSE para renderizar las respuestas token por token, e integra referencias/fuentes con porcentajes de relevancia y carga Drag & Drop.
- **No existe aún**: CRUD multi-usuario, autenticación avanzada, namespaces (multi-cerebro), web scraping.

---

## Mapa de Fases (ver [guia-estrategica.md](guia-estrategica.md) para detalles completos)

| Fase | Estado | Descripción |
|------|--------|-------------|
| **Fase 0: PoC CLI** | ✅ Completada | RAG funcional por terminal |
| **Fase 1: MVP Backend** | ✅ Completada | FastAPI + API REST + SSE streaming |
| **Fase 2: MVP Frontend** | ✅ Completada | React + Vite + Tailwind CSS v4, Chat UI, Upload, Referencias |
| **Fase 3: Multi-Cerebro** | 🔜 Siguiente | CRUD de cerebros, namespaces en vector DB |
| Fase 4: Features Avanzadas | ⬜ Pendiente | Web scraping, artefactos de código, sandboxed preview |
| Fase 5: Producción | ⬜ Pendiente | Auth (JWT), PostgreSQL, cloud deployment |

---

## Estructura de Archivos del Proyecto

```
my-brain/
├── backend/                   # Backend API REST (FastAPI)
│   ├── api/                   # Rutas de la API (status, ingest, chat), app y esquemas
│   ├── run_api.py             # Script de arranque
│   ├── config.py              # Variables de entorno y configuración
│   ├── main.py                # CLI entrypoint original
│   ├── ingest.py              # Pipeline de ingesta (TXT, PDF, MD)
│   ├── chunking.py            # Estrategias Basic y Smart Chunking
│   ├── retriever.py           # Búsqueda híbrida (BM25 + Vector) con RRF
│   ├── query.py               # Lógica RAG y generador de stream
│   ├── prompts.py             # Prompts del sistema y de evaluación
│   └── evaluation/            # Benchmarks de evaluación automatizada (LLM-as-judge)
├── frontend/                  # [NUEVO] Frontend SPA (React + TS + Vite)
│   ├── src/
│   │   ├── components/        # ChatArea (primitives), Sidebar, UploadZone y StatusPanel
│   │   ├── api.ts             # Cliente fetch de la API
│   │   ├── types.ts           # Tipos TypeScript de API
│   │   ├── App.tsx            # Setup de useLocalRuntime y layout principal
│   │   └── index.css          # Tailwind CSS v4 + estilos personalizados
│   ├── package.json           # Dependencias y scripts (typecheck: tsc -b)
│   └── vite.config.ts         # Integración de Tailwind v4 en Vite
├── guia-estrategica.md        # Planificación y decisiones tecnológicas
├── README.md                  # Documentación principal
└── STATUS.md                  # ← Este archivo
```

---

## Componentes Implementados en Detalle

### 1. Ingesta y Recuperación (Backend)
- Lee TXT, MD y PDFs (con parser consciente de sintaxis de código en MD).
- Recuperación Híbrida: RRF que pondera búsqueda léxica (BM25) y semántica (embeddings de OpenAI).

### 2. Cliente y Streaming (Frontend)
- Drag & Drop para subir archivos con visualización de estado y chunks creados.
- Chat con auto-scroll inteligente y flujo SSE usando `useLocalRuntime` de `assistant-ui`.
- Visualización interactiva de fuentes de ChromaDB con nivel de confianza.
- Dashboard oscuro premium con efecto glassmorphism.

---

## Cómo Ejecutar todo el Proyecto

1. **Backend**:
   ```bash
   cd backend
   .venv\Scripts\activate
   python run_api.py
   ```
2. **Frontend**:
   ```bash
   cd frontend
   pnpm install
   pnpm run dev
   ```
   *(Frontend disponible en http://localhost:5173 e interactuando con el backend)*
