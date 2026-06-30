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
        # Obtener columnas existentes en la tabla message
        try:
            result = session.execute(text("PRAGMA table_info(message)")).fetchall()
            existing_columns = {row[1] for row in result}
        except Exception as e:
            existing_columns = set()
            
        for col_name, col_type in columns_to_add:
            if col_name in existing_columns:
                continue  # Omitir silenciosamente si ya existe
                
            try:
                stmt = f"ALTER TABLE message ADD COLUMN {col_name} {col_type}"
                session.execute(text(stmt))
                session.commit()
                print(f"Columna '{col_name}' agregada con éxito.")
            except Exception as e:
                session.rollback()
                print(f"Error al agregar columna '{col_name}': {e}")

if __name__ == "__main__":
    migrate()
