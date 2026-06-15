# 🧠 My Brain LM

**your docs, your local intelligence** — Una aplicación multi-tema que te permite consultar y tomar decisiones basándote en tus propios documentos, utilizando RAG (Retrieval Augmented Generation).

> Carga documentos en "secciones de cerebro", chatea con un LLM que prioriza la información de esos documentos, y obtén respuestas precisas y contextualizadas.

---

## 📋 Descripción

My Brain LM es una herramienta diseñada **principalmente para desarrolladores** que necesitan consultar documentación técnica, tomar decisiones arquitectónicas o simplemente tener un asistente que "conozca" sus documentos.

### ¿Qué hace My Brain LM?

- 🗂️ **Carga documentos** en "secciones de cerebro" o proyectos independientes
- 💬 **Chat con LLM** que prioriza y referencia la información de tus documentos cargados
- 📄 **Soporte multi-formato**: PDF, TXT y MD
- 🌐 **Web scraping** para auto-generar documentos desde documentación pública
- 🎨 **Artefactos de código** y previews HTML directamente en el chat
- ⚡ **Respuestas con streaming** para una experiencia fluida

---

## 🗺️ Roadmap del Proyecto

### 🟢 Fase 0: Proof of Concept (PoC) — CLI + RAG Básico — COMPLETADA ✅

> El objetivo es validar el flujo completo de RAG con la menor complejidad posible.

- [x] Script Python con CLI interactivo
- [x] Cargar documentos TXT y PDF
- [x] Chunking + Embeddings con OpenAI (`text-embedding-3-small`)
- [x] Almacenamiento vectorial en ChromaDB (local)
- [x] Chat interactivo por terminal con contexto de documentos
- [x] Comando de status para verificar el estado de la base de datos

**Stack:** Python + OpenAI API + ChromaDB

---

### 🔵 Fase 1: MVP Backend (API REST) — COMPLETADA ✅

> Migrar la lógica del PoC a una API robusta y extensible con FastAPI.

- [x] Migrar de CLI a **FastAPI**
- [x] API endpoints: upload de documentos, chat, gestión de colecciones
- [x] **Streaming de respuestas** con Server-Sent Events (SSE)
- [x] Soporte para archivos **Markdown (.md)**
- [x] Mejor estrategia de chunking (overlap, tamaño adaptativo con smart chunking)
- [x] Validación y manejo de errores robusto

---

### 🟣 Fase 2: MVP Frontend — COMPLETADA ✅

> Crear una interfaz web moderna para interactuar con My Brain LM.

- [x] **React + Vite + TypeScript**
- [x] Chat UI con streaming en tiempo real
- [x] Upload de documentos con drag & drop
- [x] Conectar con backend API (REST)
- [x] Indicadores de fuentes/referencias en las respuestas

---

### 🟣 Fase 3: Multi-Cerebro — COMPLETADA ✅

> Permitir múltiples "cerebros" independientes para distintos proyectos o temas.

- [x] CRUD de secciones/cerebros (Áreas)
- [x] **Namespaces en ChromaDB** por sección
- [x] UI para gestionar cerebros y sus documentos
- [x] Historial de conversaciones persistente
- [x] Cambio rápido entre cerebros

---

### 🟠 Fase 4: Features Avanzadas

> Funcionalidades que elevan My Brain LM a una herramienta profesional.

- [ ] **Web scraping** → generación automática de documentos desde URLs
- [ ] Artefactos de código en chat (syntax highlighting)
- [ ] **Preview HTML sandboxed** dentro del chat
- [ ] Migración a **LangChain** para document loaders avanzados
- [ ] Explorar **LangGraph** para flujos conversacionales complejos
- [ ] Búsqueda híbrida (semántica + keyword)

---

### 🔴 Fase 5: Producción

> Preparar My Brain LM para uso en producción con múltiples usuarios.

- [ ] **Autenticación de usuarios** (JWT / OAuth)
- [ ] PostgreSQL para metadata y gestión de usuarios
- [ ] **Pinecone o Chroma Cloud** para vectores en la nube
- [ ] Deployment con **Docker + cloud** (AWS/GCP/Railway)
- [ ] Optimización de performance y caché
- [ ] Rate limiting y monitoreo

---

## 🛠️ Tech Stack

| Capa | Fase 0 (PoC) | Fase 1-2 (MVP) | Fase 3+ (Avanzado) |
|---|---|---|---|
| **Frontend** | CLI | React + Vite | React + Vite |
| **Backend** | Script Python | FastAPI | FastAPI |
| **AI / LLM** | OpenAI API directa | LangChain | LangGraph |
| **Embeddings** | `text-embedding-3-small` | `text-embedding-3-small` | `text-embedding-3-small` |
| **Vector DB** | ChromaDB (local) | ChromaDB (local) | Pinecone / Chroma Cloud |
| **DB Relacional** | — | SQLite | PostgreSQL |

---

## 🚀 Inicio Rápido (CLI y API REST)

### Pre-requisitos

- Python 3.10+
- Una API key de [OpenAI](https://platform.openai.com/api-keys)

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/my-brain.git
cd my-brain

# 2. Ir al directorio del backend
cd backend

# 3. Crear entorno virtual
python -m venv .venv

# 4. Activar entorno virtual
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

# 5. Instalar dependencias
pip install -r requirements.txt

# 6. Configurar variables de entorno
copy .env.example .env
# Editar .env y agregar tu OPENAI_API_KEY y la configuración de API
```

### Uso

#### Ejecución del Servidor API (Recomendado)

```bash
# 🧠 Iniciar el servidor API REST (FastAPI)
python run_api.py
```
El servidor se iniciará en `http://127.0.0.1:8000` con documentación interactiva Swagger disponible en `http://127.0.0.1:8000/docs`.

#### Ejecución del CLI Original

```bash
# 📥 Ingestar documentos (cargar al vector store)
python main.py ingest ./documents

# 💬 Iniciar chat interactivo
python main.py chat

# 📊 Ver estado de la base de datos
python main.py status
```

### Ejemplo de Chat

```
🧠 My Brain LM Chat (escribe 'salir' para terminar)
──────────────────────────────────────────────

Tú: ¿Cuáles son las mejores prácticas para autenticación en APIs REST?

My Brain LM: Según tus documentos cargados, las mejores prácticas incluyen...
```

---

## 📁 Estructura del Proyecto

```
my-brain/
├── backend/
│   ├── api/                # 🧠 Paquete de la API REST (FastAPI)
│   │   ├── routes/         # 🛣️ Rutas de la API (status, ingest, chat)
│   │   ├── app.py          # ⚙️ Configuración global de FastAPI y CORS
│   │   ├── schemas.py      # 📋 Modelos de Pydantic (request/response)
│   │   └── dependencies.py # 🛠️ Dependencias compartidas
│   ├── documents/          # 📄 Documentos para ingestar
│   ├── chroma_db/          # 🗄️ Base de datos vectorial (auto-generado)
│   ├── config.py           # ⚙️ Configuración y variables de entorno
│   ├── ingest.py           # 📥 Pipeline de ingesta de documentos
│   ├── query.py            # 🔍 Motor de consultas RAG
│   ├── main.py             # 🚀 CLI entry point
│   ├── run_api.py          # ⚡ Script de arranque de la API REST
│   ├── requirements.txt    # 📦 Dependencias Python
│   ├── .env.example        # 📋 Template de variables de entorno
│   └── .env                # 🔐 Variables de entorno (no versionado)
├── frontend/               # 🖥️ (Fase 2+)
├── README.md               # 📖 Este archivo
└── MyBrain.txt             # 📝 Especificación original del proyecto
```

---

## 🤝 Contribuir

Este proyecto está en fase de **Proof of Concept**. Si tienes ideas o sugerencias, abre un issue o envía un PR.

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

<p align="center">
  Hecho con ❤️ y mucho ☕ por un dev que quería su propio cerebro local de documentos
</p>
