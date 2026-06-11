"""
Script de benchmark para evaluar estrategias de retrieval en MyBrain.

Ejecuta diferentes estrategias de recuperación contra un conjunto de preguntas
de prueba, mide métricas de calidad (usando LLM-as-judge) y latencia, y genera
un reporte Markdown detallado con los resultados.

Métricas evaluadas:
- Context Relevance: ¿El retriever retorna chunks relevantes?
- Answer Correctness: ¿La respuesta generada es correcta?
- Faithfulness: ¿La respuesta se basa solo en el contexto?
- Latency: Tiempo de recuperación en milisegundos

Uso:
    python -m evaluation.benchmark
    python -m evaluation.benchmark --test-set evaluation/custom_test_set.json
"""

import sys
import os

# Agregar el directorio padre al path para importar módulos del backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import argparse
import json
import time
from datetime import datetime
from typing import Any

from openai import OpenAI
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from config import settings
from retriever import get_retrieval_strategy, VectorOnlyStrategy, HybridStrategy
from query import _get_openai_client, _build_context_prompt
from prompts import (
    SYSTEM_PROMPT,
    CONTEXT_RELEVANCE_PROMPT,
    ANSWER_CORRECTNESS_PROMPT,
    FAITHFULNESS_PROMPT,
)



# --- Consola global de Rich ---
console = Console()

# --- Modelo usado para las evaluaciones LLM-as-judge ---
JUDGE_MODEL = "gpt-4o-mini"


def load_test_set(path: str) -> list[dict]:
    """Carga y valida el conjunto de pruebas desde un archivo JSON.

    Filtra entradas que contengan claves de metadatos como `_comment` o
    `_instructions`, que no representan preguntas reales.

    Args:
        path: Ruta al archivo JSON del test set.

    Returns:
        Lista de diccionarios con las preguntas de prueba válidas.

    Raises:
        FileNotFoundError: Si el archivo no existe.
        json.JSONDecodeError: Si el archivo no es JSON válido.
    """
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Filtrar entradas que son comentarios o instrucciones, no preguntas
    valid_entries: list[dict] = []
    for entry in data:
        if "_comment" in entry or "_instructions" in entry:
            continue
        # Validar que tenga los campos requeridos
        if "question" in entry and "ground_truth" in entry:
            valid_entries.append(entry)

    return valid_entries


def evaluate_llm_metric(
    client: OpenAI, metric_name: str, prompt: str
) -> tuple[float, str]:
    """Evalúa una métrica usando GPT-4o-mini como juez (LLM-as-judge).

    Envía el prompt de evaluación al modelo y parsea la respuesta JSON
    esperada con los campos 'score' y 'reasoning'.

    Args:
        client: Cliente de OpenAI configurado.
        metric_name: Nombre de la métrica (para logging en caso de error).
        prompt: Prompt completo de evaluación con la pregunta y contexto.

    Returns:
        Tupla (score, reasoning). Si hay error de parseo, retorna (0.5, error_msg).
    """
    try:
        response = client.chat.completions.create(
            model=JUDGE_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise evaluation judge. "
                        "Always respond with valid JSON only."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0,  # Temperatura 0 para evaluaciones consistentes
        )

        content = response.choices[0].message.content or ""

        # Intentar extraer JSON del response (a veces viene envuelto en markdown)
        json_str = content.strip()
        if json_str.startswith("```"):
            # Remover bloques de código markdown
            lines = json_str.split("\n")
            json_str = "\n".join(
                line for line in lines if not line.strip().startswith("```")
            )

        result = json.loads(json_str)
        score = float(result.get("score", 0.5))
        reasoning = str(result.get("reasoning", "No reasoning provided"))

        # Clamp del score entre 0.0 y 1.0
        score = max(0.0, min(1.0, score))

        return score, reasoning

    except json.JSONDecodeError as e:
        # Error al parsear la respuesta del LLM
        error_msg = (
            f"Error al parsear respuesta JSON para {metric_name}: {e}. "
            f"Respuesta raw: {content[:200] if 'content' in dir() else 'N/A'}"
        )
        return 0.5, error_msg

    except Exception as e:
        # Error general (API, red, etc.)
        error_msg = f"Error al evaluar {metric_name}: {e}"
        return 0.5, error_msg


def run_single_query(
    question: str, strategy: Any, client: OpenAI
) -> dict:
    """Ejecuta una pregunta individual a través del pipeline RAG completo.

    Realiza la recuperación de chunks con la estrategia dada, construye
    el prompt con contexto y genera la respuesta usando el LLM.

    Args:
        question: Pregunta del usuario.
        strategy: Instancia de una estrategia de retrieval (VectorOnlyStrategy, etc.).
        client: Cliente de OpenAI para generar embeddings y respuestas.

    Returns:
        Diccionario con: question, answer, contexts, sources, latency_ms.
    """
    # Paso 1-2: Medir la latencia y recuperar del retriever
    start_time = time.time()
    result = strategy.retrieve(question, top_k=5)
    end_time = time.time()
    latency_ms = (end_time - start_time) * 1000

    context_chunks = result.documents

    # Formatear las fuentes de la misma manera que en query.py
    sources = []
    for meta, score in zip(result.metadatas, result.scores):
        source_info = {
            "source": meta.get("source", "desconocido"),
            "chunk_index": meta.get("chunk_index", -1),
            "file_type": meta.get("file_type", ""),
            "relevance_score": round(score, 4),
        }
        sources.append(source_info)

    # Paso 3: Construir el prompt con el contexto recuperado
    context_text = _build_context_prompt(context_chunks, sources)
    user_message = (
        f"Contexto de mis documentos:\n\n{context_text}\n\n"
        f"---\n\n"
        f"Pregunta: {question}"
    )

    # Paso 4: Llamar al LLM para generar la respuesta
    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    answer = response.choices[0].message.content or ""

    return {
        "question": question,
        "answer": answer,
        "contexts": context_chunks,
        "sources": sources,
        "latency_ms": round(latency_ms, 2),
    }


def evaluate_question(
    query_result: dict, ground_truth: str, client: OpenAI
) -> dict:
    """Evalúa el resultado de una pregunta contra el ground truth.

    Calcula las tres métricas LLM-as-judge: context relevance,
    answer correctness y faithfulness.

    Args:
        query_result: Resultado de run_single_query().
        ground_truth: Respuesta esperada (verdad de terreno).
        client: Cliente de OpenAI para las evaluaciones.

    Returns:
        Diccionario con scores y razonamientos para cada métrica.
    """
    # Preparar el contexto como texto plano para los prompts de evaluación
    context_text = "\n\n---\n\n".join(query_result["contexts"])

    # --- Métrica 1: Context Relevance ---
    relevance_prompt = CONTEXT_RELEVANCE_PROMPT.format(
        question=query_result["question"],
        context=context_text,
    )
    relevance_score, relevance_reasoning = evaluate_llm_metric(
        client, "context_relevance", relevance_prompt
    )

    # Pequeña pausa para evitar rate limits
    time.sleep(0.5)

    # --- Métrica 2: Answer Correctness ---
    correctness_prompt = ANSWER_CORRECTNESS_PROMPT.format(
        question=query_result["question"],
        ground_truth=ground_truth,
        answer=query_result["answer"],
    )
    correctness_score, correctness_reasoning = evaluate_llm_metric(
        client, "answer_correctness", correctness_prompt
    )

    time.sleep(0.5)

    # --- Métrica 3: Faithfulness ---
    faithfulness_prompt = FAITHFULNESS_PROMPT.format(
        context=context_text,
        answer=query_result["answer"],
    )
    faithfulness_score, faithfulness_reasoning = evaluate_llm_metric(
        client, "faithfulness", faithfulness_prompt
    )

    time.sleep(0.5)

    return {
        "context_relevance": {
            "score": relevance_score,
            "reasoning": relevance_reasoning,
        },
        "answer_correctness": {
            "score": correctness_score,
            "reasoning": correctness_reasoning,
        },
        "faithfulness": {
            "score": faithfulness_score,
            "reasoning": faithfulness_reasoning,
        },
        "latency_ms": query_result["latency_ms"],
    }


def run_benchmark(
    strategies: list, test_set: list[dict]
) -> dict:
    """Ejecuta el benchmark completo: todas las estrategias contra todas las preguntas.

    Para cada estrategia, recorre todas las preguntas del test set, ejecuta
    el pipeline RAG, evalúa las métricas y acumula los resultados.

    Args:
        strategies: Lista de instancias de estrategias de retrieval.
        test_set: Lista de diccionarios con preguntas y ground truths.

    Returns:
        Diccionario estructurado con resultados por estrategia y promedios.
    """
    client = _get_openai_client()
    results: dict[str, Any] = {}

    for strategy in strategies:
        strategy_name = strategy.name
        console.print(
            f"\n[bold cyan]{'='*60}[/bold cyan]"
        )
        console.print(
            f"[bold cyan]📊 Evaluando estrategia: {strategy_name}[/bold cyan]"
        )
        console.print(
            f"[bold cyan]{'='*60}[/bold cyan]"
        )

        strategy_results: list[dict] = []

        for i, test_case in enumerate(test_set, 1):
            question = test_case["question"]
            ground_truth = test_case["ground_truth"]

            console.print(
                f"\n  [dim]Pregunta {i}/{len(test_set)}:[/dim] "
                f"[white]{question[:80]}{'...' if len(question) > 80 else ''}[/white]"
            )

            try:
                # Ejecutar la consulta RAG
                query_result = run_single_query(question, strategy, client)

                # Evaluar métricas con LLM-as-judge
                evaluation = evaluate_question(query_result, ground_truth, client)

                # Combinar resultado de consulta con evaluación
                combined = {
                    "question": question,
                    "ground_truth": ground_truth,
                    "answer": query_result["answer"],
                    "contexts": query_result["contexts"],
                    "sources": query_result["sources"],
                    "evaluation": evaluation,
                }
                strategy_results.append(combined)

                # Mostrar progreso con scores
                console.print(
                    f"    ✅ Context: [green]{evaluation['context_relevance']['score']:.2f}[/green] | "
                    f"Answer: [green]{evaluation['answer_correctness']['score']:.2f}[/green] | "
                    f"Faith: [green]{evaluation['faithfulness']['score']:.2f}[/green] | "
                    f"Latency: [yellow]{evaluation['latency_ms']:.0f}ms[/yellow]"
                )

            except Exception as e:
                console.print(f"    ❌ [red]Error: {e}[/red]")
                # Registrar el error con scores neutros
                strategy_results.append({
                    "question": question,
                    "ground_truth": ground_truth,
                    "answer": f"ERROR: {e}",
                    "contexts": [],
                    "sources": [],
                    "evaluation": {
                        "context_relevance": {"score": 0.0, "reasoning": str(e)},
                        "answer_correctness": {"score": 0.0, "reasoning": str(e)},
                        "faithfulness": {"score": 0.0, "reasoning": str(e)},
                        "latency_ms": 0.0,
                    },
                })

        # Calcular promedios para esta estrategia
        num_questions = len(strategy_results)
        avg_context = sum(
            r["evaluation"]["context_relevance"]["score"] for r in strategy_results
        ) / max(num_questions, 1)
        avg_correctness = sum(
            r["evaluation"]["answer_correctness"]["score"] for r in strategy_results
        ) / max(num_questions, 1)
        avg_faithfulness = sum(
            r["evaluation"]["faithfulness"]["score"] for r in strategy_results
        ) / max(num_questions, 1)
        avg_latency = sum(
            r["evaluation"]["latency_ms"] for r in strategy_results
        ) / max(num_questions, 1)

        results[strategy_name] = {
            "details": strategy_results,
            "averages": {
                "context_relevance": round(avg_context, 4),
                "answer_correctness": round(avg_correctness, 4),
                "faithfulness": round(avg_faithfulness, 4),
                "latency_ms": round(avg_latency, 2),
            },
        }

        # Resumen de la estrategia
        console.print(
            f"\n  [bold]Promedios {strategy_name}:[/bold] "
            f"Context={avg_context:.2f} | "
            f"Answer={avg_correctness:.2f} | "
            f"Faith={avg_faithfulness:.2f} | "
            f"Latency={avg_latency:.0f}ms"
        )

    return results


def generate_report(results: dict, output_dir: str) -> str:
    """Genera un reporte Markdown detallado con los resultados del benchmark.

    Incluye tabla resumen, ganador, mejoras vs baseline, y detalle por pregunta
    para cada estrategia evaluada.

    Args:
        results: Diccionario con resultados del benchmark (de run_benchmark()).
        output_dir: Directorio donde guardar el reporte.

    Returns:
        Ruta absoluta al archivo del reporte generado.
    """
    # Crear directorio de salida si no existe
    os.makedirs(output_dir, exist_ok=True)

    # Generar nombre del archivo con timestamp
    timestamp = datetime.now()
    filename = f"benchmark_{timestamp.strftime('%Y%m%d_%H%M%S')}.md"
    filepath = os.path.join(output_dir, filename)

    # Recopilar info del test set
    first_strategy = next(iter(results.values()))
    num_questions = len(first_strategy["details"])
    source_docs: set[str] = set()
    for detail in first_strategy["details"]:
        for src in detail.get("sources", []):
            source_name = src.get("source", "")
            if source_name:
                source_docs.add(source_name)

    # --- Determinar el ganador (mayor score promedio combinado) ---
    strategy_scores: dict[str, float] = {}
    for name, data in results.items():
        avg = data["averages"]
        # Score combinado: promedio de las tres métricas de calidad
        combined = (
            avg["context_relevance"]
            + avg["answer_correctness"]
            + avg["faithfulness"]
        ) / 3
        strategy_scores[name] = combined

    winner = max(strategy_scores, key=strategy_scores.get)  # type: ignore[arg-type]

    # --- Construir el reporte Markdown ---
    lines: list[str] = []

    # Encabezado
    lines.append("# MyBrain Benchmark Report\n")
    lines.append(f"**Fecha:** {timestamp.strftime('%Y-%m-%d %H:%M:%S')}  ")
    lines.append(f"**Test set:** {num_questions} preguntas  ")
    lines.append(
        f"**Documentos ingestados:** {', '.join(sorted(source_docs)) if source_docs else 'N/A'}  "
    )
    lines.append(f"**Modelo LLM:** {settings.llm_model}  ")
    lines.append(f"**Modelo Embeddings:** {settings.embedding_model}  ")
    lines.append(f"**Juez de evaluación:** {JUDGE_MODEL}  ")
    lines.append("")

    # --- Tabla resumen ---
    lines.append("## Resumen\n")
    lines.append(
        "| Estrategia | Context Relevance | Answer Correctness "
        "| Faithfulness | Latencia (ms) |"
    )
    lines.append("|---|---|---|---|---|")

    for name, data in results.items():
        avg = data["averages"]
        # Resaltar al ganador en negrita
        if name == winner:
            lines.append(
                f"| **{name}** "
                f"| **{avg['context_relevance']:.2f}** "
                f"| **{avg['answer_correctness']:.2f}** "
                f"| **{avg['faithfulness']:.2f}** "
                f"| **{avg['latency_ms']:.0f}** |"
            )
        else:
            lines.append(
                f"| {name} "
                f"| {avg['context_relevance']:.2f} "
                f"| {avg['answer_correctness']:.2f} "
                f"| {avg['faithfulness']:.2f} "
                f"| {avg['latency_ms']:.0f} |"
            )

    lines.append("")

    # --- Ganador ---
    lines.append(f"## 🏆 Ganador: {winner}\n")
    winner_avg = results[winner]["averages"]
    lines.append(
        f"La estrategia **{winner}** obtuvo el mejor rendimiento general "
        f"con un score combinado promedio de **{strategy_scores[winner]:.2f}**.\n"
    )
    lines.append(f"- Context Relevance: {winner_avg['context_relevance']:.2f}")
    lines.append(f"- Answer Correctness: {winner_avg['answer_correctness']:.2f}")
    lines.append(f"- Faithfulness: {winner_avg['faithfulness']:.2f}")
    lines.append(f"- Latencia promedio: {winner_avg['latency_ms']:.0f}ms")
    lines.append("")

    # --- Mejoras vs baseline (vector_only) ---
    baseline_name = "vector_only"
    if baseline_name in results:
        lines.append(f"## 📈 Mejoras vs Baseline ({baseline_name})\n")
        baseline_avg = results[baseline_name]["averages"]

        lines.append("| Estrategia | Context Δ | Answer Δ | Faith. Δ | Latencia Δ |")
        lines.append("|---|---|---|---|---|")

        for name, data in results.items():
            if name == baseline_name:
                continue
            avg = data["averages"]

            # Calcular deltas porcentuales
            ctx_delta = _pct_change(baseline_avg["context_relevance"], avg["context_relevance"])
            ans_delta = _pct_change(baseline_avg["answer_correctness"], avg["answer_correctness"])
            faith_delta = _pct_change(baseline_avg["faithfulness"], avg["faithfulness"])
            lat_delta = _pct_change(baseline_avg["latency_ms"], avg["latency_ms"])

            lines.append(
                f"| {name} "
                f"| {ctx_delta} "
                f"| {ans_delta} "
                f"| {faith_delta} "
                f"| {lat_delta} |"
            )

        lines.append("")

    # --- Detalle por pregunta ---
    lines.append("## 📋 Detalle por Pregunta\n")

    for name, data in results.items():
        lines.append(f"### Estrategia: {name}\n")
        lines.append("| # | Pregunta | Context | Answer | Faith. | Latencia |")
        lines.append("|---|---|---|---|---|---|")

        for i, detail in enumerate(data["details"], 1):
            question_short = detail["question"][:60]
            if len(detail["question"]) > 60:
                question_short += "..."

            ev = detail["evaluation"]
            lines.append(
                f"| {i} "
                f"| {question_short} "
                f"| {ev['context_relevance']['score']:.2f} "
                f"| {ev['answer_correctness']['score']:.2f} "
                f"| {ev['faithfulness']['score']:.2f} "
                f"| {ev['latency_ms']:.0f}ms |"
            )

        lines.append("")

        # Sección expandida con razonamientos
        lines.append(f"<details>\n<summary>Ver razonamientos detallados — {name}</summary>\n")
        for i, detail in enumerate(data["details"], 1):
            ev = detail["evaluation"]
            lines.append(f"**Pregunta {i}: {detail['question']}**\n")
            lines.append(f"- **Respuesta generada:** {detail['answer'][:200]}{'...' if len(detail['answer']) > 200 else ''}")
            lines.append(f"- **Context Relevance ({ev['context_relevance']['score']:.2f}):** {ev['context_relevance']['reasoning']}")
            lines.append(f"- **Answer Correctness ({ev['answer_correctness']['score']:.2f}):** {ev['answer_correctness']['reasoning']}")
            lines.append(f"- **Faithfulness ({ev['faithfulness']['score']:.2f}):** {ev['faithfulness']['reasoning']}")
            lines.append("")

        lines.append("</details>\n")

    # --- Footer ---
    lines.append("---\n")
    lines.append(
        f"*Reporte generado automáticamente por MyBrain Benchmark — "
        f"{timestamp.strftime('%Y-%m-%d %H:%M:%S')}*"
    )

    # Escribir el reporte
    report_content = "\n".join(lines)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(report_content)

    return filepath


def _pct_change(baseline: float, current: float) -> str:
    """Calcula el cambio porcentual entre baseline y current.

    Args:
        baseline: Valor de referencia.
        current: Valor actual.

    Returns:
        String formateado con el porcentaje de cambio (e.g., '+12.5%' o '-3.2%').
    """
    if baseline == 0:
        return "N/A"
    change = ((current - baseline) / baseline) * 100
    sign = "+" if change >= 0 else ""
    return f"{sign}{change:.1f}%"


def main() -> None:
    """Punto de entrada CLI del benchmark.

    Parsea argumentos, carga el test set, ejecuta todas las estrategias,
    genera el reporte y muestra un resumen en consola.
    """
    # --- Parseo de argumentos ---
    parser = argparse.ArgumentParser(
        description="🧠 MyBrain Benchmark — Evaluación de estrategias de retrieval",
    )
    parser.add_argument(
        "--test-set",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "test_set.json"),
        help="Ruta al archivo JSON del test set (default: evaluation/test_set.json)",
    )
    args = parser.parse_args()

    # --- Banner de bienvenida ---
    banner = (
        "🧪 [bold cyan]MyBrain Benchmark[/bold cyan]\n\n"
        "Evaluación automatizada de estrategias de retrieval\n"
        "usando LLM-as-judge (GPT-4o-mini) para métricas de calidad.\n\n"
        f"[dim]Modelo LLM:[/dim] {settings.llm_model}\n"
        f"[dim]Modelo Embeddings:[/dim] {settings.embedding_model}\n"
        f"[dim]Juez de evaluación:[/dim] {JUDGE_MODEL}"
    )
    console.print(
        Panel(
            banner,
            title="[bold blue]MyBrain Benchmark v0.1[/bold blue]",
            border_style="blue",
            padding=(1, 2),
        )
    )

    # --- Cargar test set ---
    console.print(f"\n📂 Cargando test set desde: [cyan]{args.test_set}[/cyan]")

    try:
        test_set = load_test_set(args.test_set)
    except FileNotFoundError:
        console.print(
            f"\n❌ [bold red]Error:[/bold red] No se encontró el test set en "
            f"[red]{args.test_set}[/red]\n"
            "Crea el archivo o especifica la ruta con --test-set"
        )
        sys.exit(1)
    except json.JSONDecodeError as e:
        console.print(
            f"\n❌ [bold red]Error:[/bold red] El test set no es JSON válido: {e}"
        )
        sys.exit(1)

    if not test_set:
        console.print(
            "\n⚠️  [yellow]El test set está vacío o no contiene preguntas válidas.[/yellow]"
        )
        sys.exit(1)

    console.print(f"   ✅ {len(test_set)} preguntas cargadas\n")

    # --- Definir estrategias a evaluar ---
    strategies = [
        VectorOnlyStrategy(),
        HybridStrategy(bm25_weight=0.3),
        HybridStrategy(bm25_weight=0.4),
        HybridStrategy(bm25_weight=0.5),
    ]

    strategy_names = [s.name for s in strategies]
    console.print(f"📋 Estrategias a evaluar: [cyan]{', '.join(strategy_names)}[/cyan]\n")

    # --- Ejecutar benchmark ---
    start_time = time.time()
    results = run_benchmark(strategies, test_set)
    total_time = time.time() - start_time

    console.print(
        f"\n⏱️  Benchmark completado en [bold]{total_time:.1f}[/bold] segundos\n"
    )

    # --- Generar reporte ---
    reports_dir = os.path.join(os.path.dirname(__file__), "reports")
    report_path = generate_report(results, reports_dir)
    console.print(
        f"📄 Reporte guardado en: [bold green]{report_path}[/bold green]\n"
    )

    # --- Tabla resumen en consola ---
    summary_table = Table(
        title="📊 Resumen del Benchmark",
        show_header=True,
        header_style="bold magenta",
        border_style="blue",
    )
    summary_table.add_column("Estrategia", style="cyan", min_width=15)
    summary_table.add_column("Context Rel.", justify="center", style="green")
    summary_table.add_column("Answer Corr.", justify="center", style="green")
    summary_table.add_column("Faithfulness", justify="center", style="green")
    summary_table.add_column("Latencia", justify="center", style="yellow")

    # Determinar ganador para resaltarlo
    best_combined = 0.0
    winner = ""
    for name, data in results.items():
        avg = data["averages"]
        combined = (
            avg["context_relevance"]
            + avg["answer_correctness"]
            + avg["faithfulness"]
        ) / 3
        if combined > best_combined:
            best_combined = combined
            winner = name

    for name, data in results.items():
        avg = data["averages"]
        style = "bold green" if name == winner else ""
        prefix = "🏆 " if name == winner else "   "

        summary_table.add_row(
            f"{prefix}{name}",
            f"{avg['context_relevance']:.2f}",
            f"{avg['answer_correctness']:.2f}",
            f"{avg['faithfulness']:.2f}",
            f"{avg['latency_ms']:.0f}ms",
            style=style,
        )

    console.print(summary_table)
    console.print(
        f"\n🏆 [bold green]Ganador: {winner}[/bold green] "
        f"(score combinado: {best_combined:.2f})\n"
    )


if __name__ == "__main__":
    main()
