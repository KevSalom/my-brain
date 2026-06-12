# 🧠 MyBrain — Estado Actual del Proyecto

> **Última actualización:** 2026-06-12
> **Fase actual:** Fase 1 (MVP Backend con FastAPI) — COMPLETADA ✅
> **Próxima fase:** Fase 2 (MVP Frontend con React)

---

## TL;DR para LLMs

MyBrain es un sistema RAG personal para desarrolladores. El **backend en Python** está funcional tanto como CLI como a través de una API REST con FastAPI:
- **API REST con FastAPI**: Endpoints para estado (`/api/status`), ingesta de archivos individuales (`/api/ingest/file`), ingesta de directorio (`/api/ingest/directory`), consultas síncronas (`/api/chat`) y streaming vía SSE (`/api/chat/stream`).
- Ingesta de documentos (TXT, PDF, MD) con **Smart Chunking** (consciente de código).
- **Recuperación híbrida** (BM25 léxico + Embeddings semántico con Reciprocal Rank Fusion).
- Chat interactivo por terminal y vía API con streaming en tiempo real.
- Framework de **evaluación automatizada** (LLM-as-judge, NO RAGAS).
- Base vectorial: ChromaDB local.
- LLM: OpenAI (gpt-4o-mini) | Embeddings: text-embedding-3-small.

**No existe aún:** Frontend React, multi-usuario, autenticación avanzada, web scraping.

---

## Mapa de Fases (ver [guia-estrategica.md](guia-estrategica.md) para detalles completos)

| Fase | Estado | Descripción |
|------|--------|-------------|
| **Fase 0: PoC CLI** | ✅ Completada | RAG funcional por terminal |
| **Fase 1: MVP Backend** | ✅ Completada | FastAPI + API REST + SSE streaming |
| **Fase 2: MVP Frontend** | 🔜 Siguiente | React + Vite, Chat UI, Upload |
| Fase 3: Multi-Cerebro | ⬜ Pendiente | Namespaces, CRUD de secciones |
| Fase 4: Features Avanzadas | ⬜ Pendiente | Web scraping, artefactos de código |
| Fase 5: Producción | ⬜ Pendiente | Auth, PostgreSQL, deployment |

---

## Qué Existe Hoy (Estructura de Archivos)

```
my-brain/
├── backend/
│   ├── api/                   # 🧠 NUEVO: Paquete de la API REST (FastAPI)
│   │   ├── routes/            # 🛣️ Rutas de la API (status, ingest, chat)
│   │   ├── app.py             # ⚙️ Configuración global de FastAPI y CORS
│   │   ├── schemas.py         # 📋 Modelos de Pydantic (request/response)
│   │   └── dependencies.py    # 🛠️ Dependencias compartidas
│   ├── run_api.py             # ⚡ Script de arranque de la API REST
│   ├── config.py              # Configuración centralizada (Settings dataclass, .env)
│   ├── main.py                # CLI entry point (ingest / chat / status)
│   ├── ingest.py              # Pipeline: leer archivo → chunk → embed → almacenar en ChromaDB
│   ├── chunking.py            # 2 estrategias: BasicChunking y SmartChunking (detecta código, headings)
│   ├── retriever.py           # Abstracción de retrieval con 2 estrategias intercambiables:
│   │                          #   - VectorOnlyStrategy (embeddings + cosine similarity)
│   │                          #   - HybridStrategy (BM25 + Vector con RRF ponderado)
│   ├── query.py               # Pipeline de consulta (importa prompts de prompts.py)
│   ├── prompts.py             # Módulo centralizado de prompts (sistema y LLM-as-judge)
│   ├── requirements.txt       # Dependencias Python
│   ├── .env / .env.example    # Variables de entorno (OPENAI_API_KEY, modelos, estrategias)
│   ├── documents/             # Carpeta de documentos fuente
│   │   ├── deep-agents.md     # Documentación técnica de prueba (165K chars, 141 chunks)
│   │   └── cv.pdf             # PDF de prueba (3 chunks)
│   ├── chroma_db/             # Base de datos vectorial persistente (auto-generado)
│   └── evaluation/
│       ├── test_set.json      # 25 preguntas de evaluación (incluye preguntas de abstención)
│       ├── benchmark.py       # Framework de benchmark con LLM-as-judge (GPT-4o-mini)
│       └── reports/           # Reportes Markdown generados automáticamente
├── guia-estrategica.md        # Guía completa de fases, decisiones técnicas y roadmap
├── retrievers-langchain.md    # Investigación sobre técnicas de retrieval
├── README.md                  # Documentación principal del proyecto
├── STATUS.md                  # ← Este archivo
```

---

## Componentes Implementados en Detalle

### 1. Ingesta (`ingest.py`)
- Lee archivos `.txt`, `.md`, `.pdf` (con `pypdf`)
- Divide en chunks usando la estrategia configurada (`CHUNKING_STRATEGY`):
  - `basic`: Separadores genéricos (párrafos, líneas)
  - `smart` (default): Separadores conscientes de código (```), detecta lenguajes, extrae section headings de Markdown, metadata enriquecida por chunk
- Genera embeddings con OpenAI `text-embedding-3-small`
- Almacena en ChromaDB con upsert (re-ingesta segura por hash determinístico)

### 2. Retrieval (`retriever.py`)
- **Patrón Strategy** con clase abstracta `RetrieverStrategy` y factoría `get_retrieval_strategy()`
- **VectorOnlyStrategy**: Embedding de la query → ChromaDB query por similitud coseno
- **HybridStrategy**: Fusión de BM25 (léxico) + Vector (semántico)
  - BM25 con tokenizador personalizado que preserva identificadores de código
  - Reciprocal Rank Fusion (RRF) con pesos configurables (`RETRIEVAL_BM25_WEIGHT`)
  - El nombre de la estrategia incluye sus pesos (ej: `hybrid_40_60`)
- Configurable vía `.env`: `RETRIEVAL_STRATEGY=hybrid`, `RETRIEVAL_BM25_WEIGHT=0.4`

### 3. Consulta (`query.py`)
- Delega retrieval a la estrategia configurada
- Importa `SYSTEM_PROMPT` de `prompts.py` y construye el contexto
- Llama al LLM con system prompt estricto (responder SOLO con contexto)
- Soporta modo normal y streaming (generator)
- Muestra fuentes con scores de relevancia

### 4. Evaluación (`evaluation/benchmark.py`)
- **NO usa RAGAS** — implementa evaluación custom con patrón LLM-as-judge
- Importa prompts de evaluación optimizados desde `prompts.py` para evitar falsos negativos en respuestas de abstención ("No sé")
- Métricas evaluadas por GPT-4o-mini (temperature=0):
  - Context Relevance (¿los chunks recuperados son relevantes?)
  - Answer Correctness (¿la respuesta coincide con el ground truth?)
  - Faithfulness (¿la respuesta se basa solo en el contexto, sin alucinar?)
  - Latencia (medida directa en ms)
- Genera reporte Markdown con tabla comparativa, ganador, deltas vs baseline, y detalle por pregunta
- CLI con `--test-set` para test sets personalizados

### 5. Configuración (`config.py`)
Variables de entorno relevantes:
```env
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
CHUNKING_STRATEGY=smart          # basic | smart
RETRIEVAL_STRATEGY=hybrid        # vector_only | hybrid
RETRIEVAL_BM25_WEIGHT=0.4        # 0.0 a 1.0 (peso de BM25 en híbrido)
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

---

## Historial y Reportes de Benchmarks

Los reportes detallados del benchmark de evaluación se generan de forma dinámica y automática después de cada corrida. 

Para ver y comparar los últimos reportes detallados (incluyendo scores por pregunta, ganador, latencias y análisis de deltas), accede directamente al directorio:
👉 [backend/evaluation/reports/](file:///c:/Users/PC1/Documents/Kevin/Dev/my-brain/backend/evaluation/reports/)

---

## Cómo Ejecutar

```bash
cd backend
.venv\Scripts\activate        # Activar entorno virtual

# Ingestar documentos
python main.py ingest documents

# Chat interactivo
python main.py chat

# Ver estadísticas
python main.py status

# Ejecutar benchmark
python -m evaluation.benchmark
```

---

## Para Continuar: Fase 2 (MVP Frontend)

La siguiente fase consiste en construir la interfaz de usuario web utilizando **React + Vite + TypeScript**:

1. **Estructura del Frontend**: Inicializar proyecto en la carpeta `frontend/`.
2. **Interfaz de Chat**: Un diseño responsivo y moderno con burbujas de chat y soporte para respuestas en streaming en tiempo real (consumiendo `/api/chat/stream`).
3. **Sección de Ingesta**: UI interactiva con drag & drop para subir archivos PDF, TXT y MD directamente al backend (consumiendo `/api/ingest/file`).
4. **Visor de Estado**: Componente para monitorear el estado actual del sistema (documentos ingestados, configuración del modelo, tamaño de chunks, etc., consumiendo `/api/status`).

Ver [guia-estrategica.md](guia-estrategica.md) sección "Fase 2: MVP Frontend" para el contexto completo.
