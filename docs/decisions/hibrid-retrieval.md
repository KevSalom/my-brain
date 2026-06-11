# Explicación Técnica: Retrieval Híbrido + Benchmark

---

## 1. ¿Qué es el Retrieval Híbrido y por qué lo implementamos?

### El problema con búsqueda solo por embeddings

Cuando haces una pregunta como *"¿Qué hace la función `create_deep_agent`?"*, un sistema RAG básico (solo vectorial) convierte tu pregunta en un vector numérico y busca los chunks más "similares" semánticamente en ChromaDB.

Esto funciona bien para preguntas conceptuales (*"¿Qué ventajas tienen los subagentes?"*), pero tiene una debilidad: **los embeddings capturan significado, no presencia literal de palabras**. Si tu documentación menciona `create_deep_agent` como nombre de función, un retriever puramente semántico podría devolver chunks que hablan de "crear agentes" en general pero que no contienen el código exacto de esa función.

### La solución: combinar dos enfoques

Implementamos un **retriever híbrido** que fusiona dos técnicas complementarias:

```
                    Pregunta del usuario
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌──────────────────┐    ┌──────────────────────┐
    │   BM25 (Léxico)  │    │ Embeddings (Semántico)│
    │                  │    │                       │
    │ Busca coincidencia│    │ Busca similitud de    │
    │ exacta de palabras│    │ significado via        │
    │ y tokens          │    │ vectores numéricos     │
    └────────┬─────────┘    └────────┬──────────────┘
             │                       │
             │    Ranked results     │
             └───────────┬───────────┘
                         ▼
              ┌─────────────────────┐
              │ Reciprocal Rank     │
              │ Fusion (RRF)        │
              │                     │
              │ Combina ambos       │
              │ rankings con pesos  │
              │ configurables       │
              └──────────┬──────────┘
                         ▼
                  Top K resultados
                    fusionados
```

**BM25** (Best Matching 25) es un algoritmo clásico de Information Retrieval que rankea documentos por la frecuencia y distribución de los términos de búsqueda. Es especialmente bueno para:
- Nombres de funciones: `create_deep_agent`, `write_todos`
- Identificadores de código: `StateBackend`, `BM25Okapi`
- Términos técnicos exactos: `QuickJS`, `LangGraph`

**Embeddings** (vía OpenAI) capturan el significado semántico. Son buenos para:
- Preguntas conceptuales: *"¿Cómo manejan los agentes contextos grandes?"*
- Paráfrasis: *"filesystem storage"* encuentra chunks que hablan de *"backend de archivos"*
- Relaciones abstractas entre conceptos

---

## 2. Cómo está implementado en el código

### Archivo: [retriever.py](file:///c:/Users/PC1/Documents/Kevin/Dev/my-brain/backend/retriever.py)

#### Arquitectura (Patrón Strategy)

```python
# Clase base abstracta — define la interfaz común
class RetrieverStrategy(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def retrieve(self, query: str, top_k: int = 5) -> RetrievalResult: ...
```

Ambas estrategias implementan esta interfaz, lo que permite intercambiarlas sin cambiar nada en el resto del código.

#### VectorOnlyStrategy (líneas ~189-213)

Es la estrategia base. Hace exactamente lo que hacía nuestro `query.py` original:

1. Genera el embedding de la pregunta con OpenAI
2. Consulta ChromaDB por similitud coseno
3. Devuelve los top_k chunks con sus scores (1 - distancia)

#### HybridStrategy (líneas ~220-425)

Esta es la estrategia nueva. Su método `retrieve()` hace tres cosas:

**Paso A — Búsqueda BM25** (`_bm25_search`):
1. Obtiene **todos** los documentos de ChromaDB (`collection.get()`)
2. Tokeniza cada documento con nuestro tokenizador personalizado
3. Construye un índice `BM25Okapi` de la librería `rank_bm25`
4. Tokeniza la query y obtiene scores BM25 para cada documento
5. Devuelve los top_k ordenados por score

**Paso B — Búsqueda Vectorial** (`_vector_search`):
- Misma lógica que VectorOnlyStrategy

**Paso C — Fusión RRF** (`_reciprocal_rank_fusion`):
- Para cada documento en cualquiera de las dos listas, calcula:
  ```
  score_rrf = bm25_weight × (1 / (60 + rank_bm25))
            + vector_weight × (1 / (60 + rank_vector))
  ```
- La constante `k=60` es estándar en la literatura de RRF (suaviza el impacto del ranking)
- Ordena por score RRF descendente y devuelve top_k

#### Tokenizador de código (líneas ~167-182)

Un detalle crítico: el tokenizador de BM25 determina qué se considera un "término". Si usáramos un tokenizador genérico, rompería `create_deep_agent` en tres palabras separadas (`create`, `deep`, `agent`), perdiendo la conexión entre ellas.

Nuestro tokenizador usa una regex que **preserva identificadores de código**:

```python
re.findall(r"[a-zA-Z_][a-zA-Z0-9_.]*|\d+", text.lower())
```

Esto significa que:
- `create_deep_agent` → `["create_deep_agent"]` (un solo token)
- `BM25Retriever.from_documents` → `["bm25retriever.from_documents"]`
- `useCallback` → `["usecallback"]`

#### Factoría (líneas ~439-466)

```python
strategy = get_retrieval_strategy()  # usa settings.retrieval_strategy
# o
strategy = get_retrieval_strategy("hybrid")  # fuerza una específica
```

### Integración en [query.py](file:///c:/Users/PC1/Documents/Kevin/Dev/my-brain/backend/query.py)

El `query.py` original tenía la lógica de embedding y búsqueda ChromaDB directamente. Lo refactorizamos para que delegue todo al retriever:

```python
# Antes (acoplado):
embedding = openai.embeddings.create(...)
results = collection.query(query_embeddings=[embedding], ...)

# Después (desacoplado):
strategy = get_retrieval_strategy(strategy_name)
result = strategy.retrieve(question, top_k=top_k)
```

La función `_retrieve_and_build_sources()` (líneas 103-130) es el puente: llama al retriever, formatea los metadatos, y devuelve chunks + fuentes listos para construir el prompt.

---

## 3. El Framework de Benchmark (LLM-as-Judge)

### ¿Por qué NO usamos RAGAS?

Aunque instalamos `ragas` como dependencia, **el benchmark funciona sin ella**. Implementamos evaluación custom porque:

1. **RAGAS cambia mucho entre versiones** — Los breaking changes son frecuentes y dificultan la reproducibilidad
2. **Es más educativo** — Entiendes exactamente cómo se evalúa cada métrica
3. **Más control** — Puedes ajustar los prompts de evaluación según tu dominio

### Archivo: [benchmark.py](file:///c:/Users/PC1/Documents/Kevin/Dev/my-brain/backend/evaluation/benchmark.py)

#### Flujo de ejecución

```
1. Cargar test_set.json (15 preguntas con ground_truth)
         │
2. Para cada estrategia (vector_only, hybrid_30_70, hybrid_40_60, hybrid_50_50):
         │
    3. Para cada pregunta:
         │
         ├── run_single_query():
         │     a) strategy.retrieve(question)     → obtener chunks
         │     b) _build_context_prompt(chunks)    → construir contexto
         │     c) openai.chat.completions.create() → generar respuesta
         │     d) Medir latencia del paso (a)
         │
         └── evaluate_question():
               a) Context Relevance  → ¿Los chunks son relevantes para la pregunta?
               b) Answer Correctness → ¿La respuesta coincide con el ground truth?
               c) Faithfulness       → ¿La respuesta solo usa info del contexto?
               (Cada métrica es evaluada por GPT-4o-mini con temperature=0)
         │
4. Calcular promedios por estrategia
         │
5. generate_report() → Markdown con tabla resumen, ganador, deltas, detalle
```

#### Las 3 métricas LLM-as-judge

Cada métrica envía un prompt específico a GPT-4o-mini pidiéndole que devuelva un JSON `{"score": 0.85, "reasoning": "..."}`.

| Métrica | ¿Qué evalúa? | Prompt clave |
|---------|---------------|--------------|
| **Context Relevance** | ¿El retriever trajo chunks útiles? | "Rate how relevant these chunks are to answer this question" |
| **Answer Correctness** | ¿La respuesta es correcta? | "Compare generated answer vs ground truth" |
| **Faithfulness** | ¿Hay alucinaciones? | "Does the answer ONLY contain info from the context?" |

#### Test Set: [test_set.json](file:///c:/Users/PC1/Documents/Kevin/Dev/my-brain/backend/evaluation/test_set.json)

15 preguntas divididas en categorías:
- **Generales**: "What is Deep Agents?"
- **Específicas de código**: "Which parameter in create_deep_agent controls filesystem access?"
- **Implementación**: "How do you implement a weather tool?"
- **Pregunta trampa (irrespondible)**: "How much does it cost to run gpt-5.4?" — la respuesta correcta es "No tengo esa información"

---

## 4. Conclusiones del Benchmark

### Resultados

| Estrategia | Context Relevance | Answer Correctness | Faithfulness | Latencia |
|---|:---:|:---:|:---:|:---:|
| `vector_only` | 0.77 | 0.84 | 0.70 | 987ms |
| `hybrid_30_70` | 0.74 | 0.84 | 0.70 | 1744ms |
| `hybrid_40_60` | **0.80** | **0.85** | 0.67 | **885ms** |
| 🏆 `hybrid_50_50` | 0.71 | **0.85** | **0.89** | 993ms |

### Análisis

**1. `hybrid_50_50` ganó en Faithfulness (+27.6% vs baseline)**

El BM25 al 50% forzó que los chunks devueltos contengan más palabras exactas de la pregunta. Esto hizo que el LLM tuviera contexto más preciso y alucinara menos. Sin embargo, su Context Relevance bajó (-7.8%) porque a veces priorizó matches léxicos sobre chunks semánticamente relevantes.

**2. `hybrid_40_60` fue el más balanceado**

Mejor Context Relevance (0.80, +3.9% vs baseline) y menor latencia (885ms), lo que sugiere que con 40% BM25 y 60% vector obtienes lo mejor de ambos mundos sin sacrificar mucho en ninguna métrica.

**3. El BM25 es costoso en latencia cuando se reconstruye el índice**

`hybrid_30_70` tuvo latencias de hasta 5.4 segundos en algunas preguntas. Esto ocurre porque el índice BM25 se reconstruye desde cero en cada consulta (lee TODOS los documentos de ChromaDB). En la Fase 1 (FastAPI) esto se resuelve cacheando el índice en memoria.

**4. Un bug interesante del LLM-as-judge con preguntas irrespondibles**

Para las 3 preguntas trampa (cuya respuesta correcta es "no tengo información"), el sistema RAG respondió correctamente: *"No tengo suficiente información..."*. Sin embargo, el LLM juez le dio **Faithfulness = 0.00** porque interpretó que esa frase de abstención "no se encuentra en el contexto", marcándola como alucinación.

> [!IMPORTANT]
> **Lección clave**: Los sistemas de evaluación automática tienen sus propios sesgos. Un LLM-as-judge necesita prompts especializados para manejar edge cases como respuestas de abstención. En producción, se añadiría un pre-filtro: si la respuesta contiene frases de abstención típicas, asignar Faithfulness = 1.0 automáticamente.

---

## 5. Cómo Probarlo Manualmente (Paso a Paso)

### Prerequisitos

```bash
cd backend
.venv\Scripts\activate    # Windows
# source .venv/bin/activate  # Mac/Linux
```

### A) Probar el Chat con diferentes estrategias

Cambia la estrategia en el archivo `.env`:

```env
# Opción 1: Solo vectorial (baseline)
RETRIEVAL_STRATEGY=vector_only

# Opción 2: Híbrido (recomendado)
RETRIEVAL_STRATEGY=hybrid
RETRIEVAL_BM25_WEIGHT=0.4
```

Luego ejecuta:

```bash
python main.py chat
```

Prueba preguntas como:
- `What is create_deep_agent?` (beneficia de BM25 por el nombre exacto)
- `How do agents handle large contexts?` (beneficia de embeddings por el concepto)
- `What is the cost of running GPT-5.4?` (debe responder que no tiene esa info)

### B) Probar el retriever directamente en Python

```python
# Desde backend/
from retriever import get_retrieval_strategy

# Vector only
vector = get_retrieval_strategy("vector_only")
result = vector.retrieve("create_deep_agent", top_k=3)
for doc, score in zip(result.documents, result.scores):
    print(f"[{score:.4f}] {doc[:100]}...")

# Híbrido
hybrid = get_retrieval_strategy("hybrid")
result = hybrid.retrieve("create_deep_agent", top_k=3)
for doc, score in zip(result.documents, result.scores):
    print(f"[{score:.6f}] {doc[:100]}...")
```

### C) Ejecutar el benchmark completo

```bash
# Benchmark con test set por defecto (evaluation/test_set.json)
python -m evaluation.benchmark

# Benchmark con test set personalizado
python -m evaluation.benchmark --test-set evaluation/mi_test_custom.json
```

El reporte se genera automáticamente en `evaluation/reports/benchmark_YYYYMMDD_HHMMSS.md`.

### D) Crear tu propio test set

Crea un JSON con este formato:

```json
[
  {
    "question": "¿Qué hace la función X?",
    "ground_truth": "La función X hace Y y Z...",
    "source_doc": "mi-documento.md"
  }
]
```

> [!TIP]
> Incluye al menos 2-3 preguntas que **no se puedan responder** con tus documentos. Esto te ayuda a evaluar si el sistema sabe decir "no sé" en lugar de alucinar.

### E) Re-ingestar documentos después de cambios

Si modificas la estrategia de chunking o agregas nuevos documentos:

```bash
# Ingestar un directorio completo
python main.py ingest documents

# Ingestar un archivo específico
python main.py ingest documents/mi-nuevo-doc.pdf

# Verificar el estado de la base de datos
python main.py status
```

> [!NOTE]
> La re-ingesta es segura (usa `upsert`). Si ingestas el mismo archivo dos veces, los chunks se actualizan en lugar de duplicarse.
