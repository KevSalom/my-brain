# 🚀 Guía de Optimizaciones y Mejoras Futuras para My Brain LM RAG

Este documento recopila las estrategias avanzadas de optimización para nuestro sistema RAG (Retrieval-Augmented Generation), ordenadas por complejidad y área de impacto. Está pensado como una hoja de ruta técnica a considerar a medida que el proyecto My Brain LM transicione de una PoC a un sistema de nivel de producción.

---

## 📊 Resumen de Estrategias y Nivel de Impacto

| Estrategia | Fase Sugerida | Dificultad | Impacto en Calidad | Impacto en Latencia |
| :--- | :---: | :---: | :---: | :---: |
| **1. Caché del Índice BM25** | Fase 1 (FastAPI) | Baja | Ninguno | **Mejora Crítica (⬇️ ms)** |
| **2. Búsqueda Jerárquica (Parent Document)** | Fase 1.5 | Media | **Alto (⬆️ Precisión)** | Neutro |
| **3. Reranking (Re-ordenación)** | Fase 2 | Media-Alta | **Muy Alto (⬆️ Calidad)** | Leve Incremento (⬆️ ms) |
| **4. Compresión de Contexto** | Fase 2 | Media | **Alto (⬇️ Ruido / Tokens)** | Leve Incremento (⬆️ ms) |
| **5. Query Expansion / Multi-Query** | Fase 3 | Media | **Medio-Alto** | Incremento (Más llamadas LLM) |
| **6. Filtrado Dinámico de Metadatos (Self-Query)**| Fase 3+ | Alta | **Alto** | Neutro |

---

## 🛠️ Detalles de Implementación de cada Estrategia

### 1. Caché del Índice BM25 (Prioridad Inmediata)
En nuestra PoC actual, el índice BM25 se reconstruye leyendo y tokenizando **todos** los documentos de ChromaDB en cada consulta de usuario. Esto añade una penalización de latencia lineal a medida que crece la base de conocimientos.

*   **Cómo funciona:**
    *   Al inicializar el servidor FastAPI, se lee toda la base de datos una sola vez para construir y almacenar el índice `BM25Okapi` en la memoria del servidor.
    *   Las consultas subsiguientes acceden directamente a este índice en memoria (latencia < 5ms).
    *   El índice solo se reconstruye o actualiza incrementalmente cuando se detecta una nueva ingesta a través del endpoint `/ingest`.
*   **Cuándo implementarlo:** Al inicio de la **Fase 1 (FastAPI)**.

---

### 2. Recuperación Jerárquica (Parent Document Retriever)
A menudo, para entender código de programación o documentación técnica, se requiere contexto amplio (por ejemplo, una función completa o una clase). Sin embargo, buscar chunks muy grandes con embeddings diluye su significado semántico.

```
                   [ Documento Fuente ]
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      [ Chunk Padre 1 ]           [ Chunk Padre 2 ]   <-- Contiene contexto amplio (ej. 2000 chars)
        (Id: Parent_A)              (Id: Parent_B)
              │                           │
         ┌────┴────┐                 ┌────┴────┐
         ▼         ▼                 ▼         ▼
     [ Child1 ] [ Child2 ]       [ Child3 ] [ Child4 ] <-- Chunks pequeños (ej. 400 chars) para Embeddings
```

*   **Cómo funciona:**
    *   Dividimos el documento original en **Chunks Padres** (1500–3000 caracteres) y luego subdividimos cada uno en **Chunks Hijos** pequeños (300–500 caracteres).
    *   Generamos embeddings y realizamos la búsqueda vectorial únicamente sobre los **Chunks Hijos**.
    *   Cuando el retriever encuentra un Chunk Hijo relevante, en lugar de pasar este fragmento incompleto al LLM, hace un lookup en la base de datos utilizando el ID del padre y pasa el **Chunk Padre completo**.
*   **Beneficio:** La búsqueda semántica es muy precisa (hijos pequeños) pero la respuesta al LLM es rica y coherente (padre grande).

---

### 3. Reranking (Re-ordenación de Resultados)
El retriever inicial (híbrido) recupera un conjunto de candidatos amplio (ej. 15-20 chunks) usando métodos rápidos (BM25 y similitud coseno). Un modelo **Re-ranker** evalúa la relación exacta de relevancia semántica profunda de cada candidato con la pregunta y los vuelve a ordenar.

```
 Query ──→ [ Retriever Híbrido ] ──→ Top-20 Chunks ──→ [ Re-ranker ] ──→ Top-5 Chunks ──→ LLM
```

*   **Opciones de Implementación:**
    *   **Servicio Externo:** API de Cohere Rerank (`cohere.rerank`). Muy potente y rápido de implementar, pero añade costo por query y dependencia de internet.
    *   **Local / Lightweight:** Librerías como `flashrank` que utilizan modelos de Deep Learning pequeños tipo ONNX (ej. MS-MARCO MiniLM) directamente en la CPU del servidor.
*   **Beneficio:** Reduce drásticamente el ruido que entra al LLM. Resuelve el problema de "lost in the middle" (donde los LLMs ignoran información relevante colocada a la mitad del contexto).

---

### 4. Compresión de Contexto (Contextual Compression)
Incluso con buenos recuperadores, los chunks pueden contener mucho "ruido" o prosa irrelevante junto con el código que realmente responde la pregunta.

*   **Cómo funciona:**
    *   Un mini-modelo extractor o un LLM rápido analiza cada chunk recuperado y extrae **únicamente** las oraciones o líneas que son directamente relevantes para responder la consulta.
    *   En lugar de inyectar 5 chunks de 1000 caracteres (5000 caracteres en total), se le inyectan al LLM 5 fragmentos altamente condensados de 150 caracteres cada uno.
*   **Beneficio:** Ahorro significativo de tokens de entrada y respuestas del LLM más enfocadas y rápidas.

---

### 5. Query Expansion / Multi-Query
Los desarrolladores a menudo preguntan de manera diferente a como está escrita la documentación (ej. usando sinónimos o lenguaje natural en vez de nombres exactos de funciones).

*   **Cómo funciona:**
    *   Se utiliza un LLM rápido para generar 3 o 4 variaciones o formulaciones diferentes de la pregunta original.
    *   Se ejecuta el retrieval para todas las variaciones.
    *   Se combinan los resultados eliminando duplicados.
*   **Beneficio:** Supera el problema de la redacción deficiente del usuario y recupera información que de otro modo se habría omitido.

---

### 6. Filtrado Dinámico de Metadatos (Self-Querying)
Si el usuario hace una pregunta como: *"¿Cómo se usa useCallback en React v18?"*, un retriever común buscará "React v18" semánticamente. Un retriever auto-consultable (Self-Querying) extrae el metadato estructurado.

*   **Cómo funciona:**
    *   El LLM parsea la query y la separa en:
        *   Consulta semántica: *"useCallback"*
        *   Filtro estructurado: `{"framework": "React", "version": "18"}`
    *   ChromaDB ejecuta una consulta filtrada directamente por metadatos antes o durante la búsqueda semántica.
*   **Beneficio:** Evita mezclar documentación de diferentes tecnologías o versiones incompatibles en el contexto.
