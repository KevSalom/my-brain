

"""
Punto de entrada CLI de MyBrain.

Proporciona tres subcomandos:
- ingest: Ingesta archivos o directorios en ChromaDB
- chat: Modo de chat interactivo con streaming
- status: Muestra estadísticas de la colección
"""

import argparse
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown
from rich.table import Table
from rich.text import Text
from rich.live import Live

from config import settings

console = Console()

# Banner ASCII del proyecto
BANNER = r"""
  __  __       ____            _
 |  \/  |_   _| __ ) _ __ __ _(_)_ __
 | |\/| | | | |  _ \| '__/ _` | | '_ \
 | |  | | |_| | |_) | | | (_| | | | | |
 |_|  |_|\__, |____/|_|  \__,_|_|_| |_|
         |___/
"""


def cmd_ingest(args: argparse.Namespace) -> None:
    """Ejecuta la ingestión de un archivo o directorio.

    Si la ruta es un archivo, ingesta ese archivo individual.
    Si es un directorio, ingesta todos los archivos soportados dentro.

    Args:
        args: Argumentos parseados de argparse con 'path'.
    """
    # Importación diferida para que la validación de config ocurra en el momento justo
    from ingest import ingest_file, ingest_directory

    target = Path(args.path).resolve()

    if target.is_file():
        try:
            chunks = ingest_file(str(target))
            console.print(
                f"\n🎉 [bold green]Ingestión completada:[/bold green] "
                f"{chunks} chunks generados desde [cyan]{target.name}[/cyan]"
            )
        except Exception as e:
            console.print(f"\n❌ [bold red]Error:[/bold red] {e}")
            sys.exit(1)

    elif target.is_dir():
        results = ingest_directory(str(target))
        total = sum(results.values())
        if total > 0:
            console.print(
                f"\n🎉 [bold green]Ingestión completada:[/bold green] "
                f"{total} chunks totales desde {len(results)} archivo(s)"
            )
        else:
            console.print("\n⚠️  No se ingestaron documentos.")

    else:
        console.print(f"\n❌ La ruta no existe: [red]{target}[/red]")
        sys.exit(1)


def cmd_status(args: argparse.Namespace) -> None:
    """Muestra estadísticas de la colección de ChromaDB.

    Incluye número total de chunks, documentos únicos y configuración actual.

    Args:
        args: Argumentos parseados (no se usa, pero necesario para argparse).
    """
    from query import get_collection_stats

    stats = get_collection_stats()

    # Tabla de estadísticas
    table = Table(
        title="📊 Estado de MyBrain",
        show_header=True,
        header_style="bold magenta",
        border_style="blue",
    )
    table.add_column("Propiedad", style="cyan", width=25)
    table.add_column("Valor", style="green")

    table.add_row("Colección", stats["collection_name"])
    table.add_row("Total de chunks", str(stats["total_chunks"]))
    table.add_row("Documentos únicos", str(len(stats["sources"])))
    table.add_row("Modelo de embeddings", settings.embedding_model)
    table.add_row("Modelo LLM", settings.llm_model)
    table.add_row("Tamaño de chunk", str(settings.chunk_size))
    table.add_row("Solapamiento", str(settings.chunk_overlap))
    table.add_row("Directorio ChromaDB", str(settings.chroma_persist_path))
    table.add_row("Directorio documentos", str(settings.documents_path))

    console.print()
    console.print(table)

    # Listar documentos si hay alguno
    if stats["sources"]:
        console.print("\n📄 [bold]Documentos ingestados:[/bold]")
        for source in stats["sources"]:
            console.print(f"   • {source}")
    else:
        console.print(
            "\n📭 No hay documentos ingestados aún. "
            "Usa [bold cyan]python main.py ingest <ruta>[/bold cyan] para comenzar."
        )

    console.print()


def cmd_chat(args: argparse.Namespace) -> None:
    """Inicia el modo de chat interactivo con streaming.

    Muestra un mensaje de bienvenida, luego entra en un bucle donde:
    - Lee la entrada del usuario
    - Realiza la consulta RAG con streaming
    - Muestra la respuesta y las fuentes utilizadas

    Args:
        args: Argumentos parseados (no se usa, pero necesario para argparse).
    """
    from query import query_stream, get_collection_stats

    # Verificar que hay documentos ingestados
    stats = get_collection_stats()
    if stats["total_chunks"] == 0:
        console.print(
            Panel(
                "⚠️  No hay documentos ingestados.\n\n"
                "Primero ingesta documentos usando:\n"
                "  [bold cyan]python main.py ingest <ruta>[/bold cyan]\n\n"
                "Ejemplo:\n"
                "  [dim]python main.py ingest ./documents[/dim]",
                title="[bold yellow]MyBrain - Sin Documentos[/bold yellow]",
                border_style="yellow",
            )
        )
        return

    # Mensaje de bienvenida
    welcome_text = (
        f"🧠 [bold]Bienvenido a MyBrain[/bold]\n\n"
        f"Tienes [bold cyan]{stats['total_chunks']}[/bold cyan] chunks "
        f"de [bold cyan]{len(stats['sources'])}[/bold cyan] documento(s) cargados.\n\n"
        f"[dim]Comandos disponibles:[/dim]\n"
        f"  • Escribe tu pregunta y presiona Enter\n"
        f"  • [bold]exit[/bold] o [bold]quit[/bold] — Salir del chat\n"
        f"  • [bold]clear[/bold] — Limpiar la pantalla\n"
        f"  • [bold]status[/bold] — Ver estadísticas"
    )
    console.print(
        Panel(
            welcome_text,
            title="[bold blue]MyBrain Chat[/bold blue]",
            border_style="blue",
            padding=(1, 2),
        )
    )

    # Bucle principal del chat
    while True:
        try:
            console.print()
            question = console.input("[bold green]🧑 Tú:[/bold green] ").strip()

            # Comandos especiales
            if not question:
                continue

            if question.lower() in ("exit", "quit", "salir"):
                console.print("\n👋 [bold]¡Hasta luego![/bold]\n")
                break

            if question.lower() in ("clear", "limpiar"):
                console.clear()
                console.print(
                    Panel(
                        "🧠 [bold]MyBrain Chat[/bold] — Pantalla limpiada",
                        border_style="blue",
                    )
                )
                continue

            if question.lower() == "status":
                cmd_status(args)
                continue

            # Realizar la consulta con streaming
            console.print("\n[bold blue]🤖 MyBrain:[/bold blue] ", end="")

            result = None
            try:
                for token, final_result in query_stream(question):
                    if token:
                        # Imprimir cada token en tiempo real sin salto de línea
                        console.print(token, end="", highlight=False)
                    if final_result is not None:
                        result = final_result

                console.print()  # Salto de línea al terminar la respuesta

                # Mostrar las fuentes utilizadas
                if result and result.sources:
                    _print_sources(result.sources)

            except ValueError as e:
                console.print(f"\n⚠️  [yellow]{e}[/yellow]")
            except Exception as e:
                console.print(f"\n❌ [red]Error al procesar la consulta:[/red] {e}")

        except KeyboardInterrupt:
            console.print("\n\n👋 [bold]¡Hasta luego![/bold]\n")
            break
        except EOFError:
            console.print("\n\n👋 [bold]¡Hasta luego![/bold]\n")
            break


def _print_sources(sources: list[dict]) -> None:
    """Muestra las fuentes utilizadas en la respuesta de forma compacta.

    Args:
        sources: Lista de metadatos de las fuentes.
    """
    # Agrupar por fuente única
    unique_sources: dict[str, float] = {}
    for src in sources:
        name = src.get("source", "desconocido")
        score = src.get("relevance_score", 0.0)
        # Quedarse con la mejor relevancia por archivo
        if name not in unique_sources or score > unique_sources[name]:
            unique_sources[name] = score

    console.print("\n  [dim]📚 Fuentes consultadas:[/dim]")
    for name, score in sorted(unique_sources.items(), key=lambda x: -x[1]):
        # Barra visual de relevancia
        bar_length = int(score * 10)
        bar = "█" * bar_length + "░" * (10 - bar_length)
        console.print(f"    [dim]•[/dim] [cyan]{name}[/cyan] [dim]{bar} {score:.0%}[/dim]")


def main() -> None:
    """Función principal — configura argparse y despacha al subcomando."""
    parser = argparse.ArgumentParser(
        description="🧠 MyBrain — Tu segundo cerebro con RAG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ejemplos de uso:\n"
            "  python main.py ingest ./documents       # Ingestar un directorio\n"
            "  python main.py ingest archivo.pdf        # Ingestar un archivo\n"
            "  python main.py chat                      # Iniciar chat interactivo\n"
            "  python main.py status                    # Ver estadísticas\n"
        ),
    )
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponibles")

    # Subcomando: ingest
    ingest_parser = subparsers.add_parser(
        "ingest",
        help="Ingestar archivos o directorios de documentos",
    )
    ingest_parser.add_argument(
        "path",
        help="Ruta al archivo o directorio a ingestar",
    )
    ingest_parser.set_defaults(func=cmd_ingest)

    # Subcomando: chat
    chat_parser = subparsers.add_parser(
        "chat",
        help="Iniciar modo de chat interactivo",
    )
    chat_parser.set_defaults(func=cmd_chat)

    # Subcomando: status
    status_parser = subparsers.add_parser(
        "status",
        help="Mostrar estadísticas de la colección",
    )
    status_parser.set_defaults(func=cmd_status)

    # Parsear argumentos
    args = parser.parse_args()

    if not args.command:
        # Sin subcomando — mostrar banner y ayuda
        console.print(
            Panel(
                BANNER,
                title="[bold blue]MyBrain v0.1 — Proof of Concept[/bold blue]",
                border_style="blue",
                padding=(0, 2),
            )
        )
        parser.print_help()
        return

    # Ejecutar el subcomando correspondiente
    args.func(args)


if __name__ == "__main__":
    main()
