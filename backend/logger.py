"""
Módulo de registro (logging) de consultas para My Brain LM.

Permite registrar el historial de chat de manera estructurada y eficiente.
Genera dos archivos por sesión de chat:
1. Un archivo Markdown (.md) para lectura humana y monitoreo visual.
2. Un archivo JSON Lines (.jsonl) para posterior análisis o evaluación automatizada.
"""

import os
import json
from datetime import datetime
from typing import List, Dict, Any


class ChatSessionLogger:
    """Clase encargada de registrar la sesión de chat activa.

    Crea archivos de registro en el directorio especificado al iniciar la sesión
    y permite añadir turnos secuencialmente.
    """

    def __init__(self, logs_dir: str = "logs"):
        """Inicializa el logger y crea el archivo con la cabecera correspondiente.

        Args:
            logs_dir: Directorio donde se almacenarán los logs.
        """
        self.logs_dir = logs_dir
        # Asegurarse de que el directorio existe
        os.makedirs(self.logs_dir, exist_ok=True)

        # Generar un nombre base único basado en la fecha y hora de inicio de la sesión
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.md_log_path = os.path.join(self.logs_dir, f"session_{timestamp}.md")
        self.jsonl_log_path = os.path.join(self.logs_dir, f"session_{timestamp}.jsonl")

        self._write_header()

    def _write_header(self) -> None:
        """Escribe la cabecera informativa inicial de la sesión en los archivos."""
        from config import settings

        # Cabecera para el log Markdown (.md)
        header_md = f"""# 🧠 Registro de Sesión de Chat — My Brain LM
- **Fecha de Inicio**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
- **Estrategia RAG**: `{settings.retrieval_strategy}` (BM25 Weight: `{settings.retrieval_bm25_weight}`)
- **Modelo LLM**: `{settings.llm_model}`
- **Modelo Embeddings**: `{settings.embedding_model}`

---
"""
        with open(self.md_log_path, "w", encoding="utf-8") as f:
            f.write(header_md)

        # Cabecera para el log JSON Lines (.jsonl)
        header_jsonl = {
            "session_start": datetime.now().isoformat(),
            "config": {
                "retrieval_strategy": settings.retrieval_strategy,
                "retrieval_bm25_weight": settings.retrieval_bm25_weight,
                "llm_model": settings.llm_model,
                "embedding_model": settings.embedding_model,
                "chunk_size": settings.chunk_size,
                "chunk_overlap": settings.chunk_overlap,
            }
        }
        with open(self.jsonl_log_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(header_jsonl, ensure_ascii=False) + "\n")

    def log_turn(
        self,
        question: str,
        answer: str,
        sources: List[Dict[str, Any]],
        context_chunks: List[str]
    ) -> None:
        """Registra un turno completo (pregunta, respuesta y contexto) en ambos archivos.

        Args:
            question: La pregunta realizada por el usuario.
            answer: La respuesta generada por el LLM.
            sources: Lista de fuentes con metadatos y scores de relevancia.
            context_chunks: Textos de los fragmentos de contexto inyectados.
        """
        timestamp = datetime.now().strftime("%H:%M:%S")

        # 1. Registrar en el archivo Markdown (.md)
        turn_md = f"""
## 💬 Turno [{timestamp}]

### 🧑 Usuario
> {question}

### 🤖 Asistente (My Brain LM)
{answer}

### 🔍 Contexto Recuperado ({len(context_chunks)} fragmentos)
"""
        for i, (chunk, src) in enumerate(zip(context_chunks, sources), 1):
            source_name = src.get("source", "desconocido")
            relevance = src.get("relevance_score", 0.0)
            chunk_idx = src.get("chunk_index", -1)
            turn_md += f"""
#### 📄 Fragmento {i}
- **Fuente**: `{source_name}` (Índice: {chunk_idx})
- **Score Relevancia/Similitud**: `{relevance:.4f}`
```text
{chunk.strip()}
```
"""
        turn_md += "\n---\n"

        with open(self.md_log_path, "a", encoding="utf-8") as f:
            f.write(turn_md)

        # 2. Registrar en el archivo JSON Lines (.jsonl)
        turn_json = {
            "timestamp": datetime.now().isoformat(),
            "query": question,
            "answer": answer,
            "sources": sources,
            "context_chunks": context_chunks
        }
        with open(self.jsonl_log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(turn_json, ensure_ascii=False) + "\n")
