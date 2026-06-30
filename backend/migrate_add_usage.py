"""
Script de migración para agregar campos de usage a la tabla message en SQLite.
"""
from sqlmodel import Session, text
from api.database import engine

def migrate():
    columns_to_add = [
        ("input_tokens", "INTEGER DEFAULT 0"),
        ("output_tokens", "INTEGER DEFAULT 0"),
        ("cost_usd", "REAL DEFAULT 0.0"),
        ("model_used", "TEXT")
    ]
    
    with Session(engine) as session:
        for col_name, col_type in columns_to_add:
            try:
                # Comprobar si la columna ya existe en la tabla message
                # SQLite no tiene un método directo IF NOT EXISTS para ADD COLUMN,
                # por lo que capturamos la excepción si ya existe.
                stmt = f"ALTER TABLE message ADD COLUMN {col_name} {col_type}"
                session.execute(text(stmt))
                session.commit()
                print(f"Columna '{col_name}' agregada con éxito.")
            except Exception as e:
                # Si la columna ya existe, SQLite lanzará un error del tipo "duplicate column name"
                session.rollback()
                if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                    print(f"Columna '{col_name}' ya existe, omitiendo.")
                else:
                    print(f"Error al agregar columna '{col_name}': {e}")

if __name__ == "__main__":
    migrate()
