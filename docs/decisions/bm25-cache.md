# Decisión de Arquitectura: Caché en Memoria RAM Local para el Índice BM25

---

## 1. Contexto

En el RAG híbrido actual de My Brain LM, la búsqueda léxica BM25 en la clase `HybridStrategy` requiere:
1. Recuperar la totalidad de documentos de la colección actual de ChromaDB usando `collection.get()`.
2. Tokenizar todos los documentos desde cero usando el tokenizador de código `_tokenize_for_bm25`.
3. Instanciar y construir el índice `BM25Okapi` completo.

Este proceso es linealmente costoso en tiempo de CPU y llamadas a base de datos. En las pruebas de benchmark del sistema, se detectaron picos de latencia de hasta 5.4 segundos en la búsqueda léxica debido a esta reconstrucción repetitiva.

## 2. Decisión de Diseño

Se ha decidido implementar una **caché local en la memoria RAM** a nivel del backend de FastAPI para almacenar el índice BM25 procesado de cada área de manera persistente durante el ciclo de vida del proceso del servidor.

### ¿Por qué local en RAM y no un servicio de terceros (ej. Redis / Elasticsearch)?

1. **Tamaño del corpus personal:** My Brain LM es un RAG enfocado a desarrolladores para sus notas y código personal. La escala del corpus por área es de pequeña a mediana (generalmente menos de 10,000 chunks). A este nivel, el índice BM25 completo ocupa apenas unos pocos megabytes (5 - 80 MB de RAM), lo cual es despreciable para cualquier máquina de desarrollo o VPS económico.
2. **Simplicidad arquitectónica:** Introducir Redis o Elasticsearch introduce dependencias externas de infraestructura que complican el despliegue del proyecto en local y en producción (Fase 5). Un objeto en memoria de Python es rápido de implementar y no tiene coste operativo.
3. **Persistencia por área:** Al estructurar la caché por el nombre de colección o ID del área, soportamos eficientemente el modelo multi-área (namespaces) del proyecto sin cruzar contextos.

---

## 3. Arquitectura del Sistema de Caché

### Componente Singleton: `BM25CacheManager`

Implementaremos un administrador de caché con patrón Singleton (`BM25CacheManager`) en el backend que exponga la interfaz para recuperar y actualizar los índices en memoria.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BM25CacheManager                              │
├────────────────────────────────────────────────────────────────────────┤
│ - _cache: dict[str, dict]                                              │
├────────────────────────────────────────────────────────────────────────┤
│ + get_bm25_index(collection_name: str, collection) -> BM25Okapi        │
│ + invalidate_cache(collection_name: str) -> None                       │
│ + clear_all() -> None                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

Cada entrada en la caché mapeada por `collection_name` almacenará:
```python
{
    "bm25_index": BM25Okapi,
    "documents": list[str],
    "metadatas": list[dict]
}
```

### Flujo de Operación

1. **Lectura (Query / Chat):**
   * Al ejecutar una query híbrida, la estrategia solicita el índice al `BM25CacheManager`.
   * Si el índice existe en caché, se utiliza directamente (búsqueda instantánea).
   * Si no existe, se hace fetch a ChromaDB, se construye, se almacena en caché y se retorna.

2. **Escritura e Ingesta:**
   * Cuando se sube un nuevo archivo o se re-ingesta un directorio, el endpoint de ingesta notificará al `BM25CacheManager` para invalidar (`invalidate_cache(collection_name)`) la caché de esa área específica.
   * La siguiente query forzará la reconstrucción del índice con los nuevos documentos incorporados.

---

## 4. Consecuencias y Mitigaciones

### Positivas
* **Reducción drástica de latencia:** La búsqueda léxica pasa de segundos a menos de 5ms en llamadas subsecuentes.
* **Menos lecturas de base de datos:** Reducción de I/O en el disco al evitar hacer `collection.get()` de miles de elementos repetidamente.

### Negativas / Mitigaciones
* **Pérdida de caché en reinicios:** Si el proceso de FastAPI se reinicia, la caché se vacía.
  * *Mitigación:* Aceptable, ya que la reconstrucción inicial toma solo segundos y ocurre de manera perezosa en la primera query de cada área.
* **Inconsistencia de caché por múltiples workers:** Si en producción se despliega con múltiples procesos worker de Uvicorn, cada worker mantendrá su caché local y la invalidación en un worker no afectará a los otros.
  * *Mitigación:* En esta fase el despliegue es de un solo worker (local). En la Fase 5 (Producción), se evaluará transicionar esta implementación de caché en memoria RAM de Python hacia un almacén persistente de clave-valor compartido como Redis, o migrar a una base de datos híbrida (como Postgres con extensiones de texto o Meilisearch).
