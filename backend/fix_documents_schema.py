"""
Script to fix the documents table schema by removing the user_id column
since we now use project_id for the project-based organization.
"""

import os
from models.database import SessionLocal, engine
from sqlalchemy import text

def fix_documents_schema():
    """Fix the documents table schema by removing user_id column"""
    
    print("🔄 Fixing documents table schema...")
    
    db = SessionLocal()
    
    try:
        # Check current schema
        print("📋 Checking current documents table schema...")
        schema_info = db.execute(text("PRAGMA table_info(documents)")).fetchall()
        
        print("Current columns:")
        for col in schema_info:
            print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
        
        # Check if user_id column exists
        has_user_id = any(col[1] == 'user_id' for col in schema_info)
        has_project_id = any(col[1] == 'project_id' for col in schema_info)
        
        if not has_user_id:
            print("✅ Documents table already migrated (no user_id column)")
            return
            
        if not has_project_id:
            print("❌ Documents table missing project_id column")
            print("🔄 Adding project_id column...")
            db.execute(text("ALTER TABLE documents ADD COLUMN project_id INTEGER"))
            db.commit()
            print("✅ Added project_id column")
        
        # SQLite doesn't support dropping columns directly, so we need to recreate the table
        print("🔄 Recreating documents table without user_id column...")
        
        # Create new table with correct schema
        db.execute(text("""
            CREATE TABLE documents_new (
                id INTEGER PRIMARY KEY,
                project_id INTEGER NOT NULL,
                orig_filename VARCHAR NOT NULL,
                stored_filename VARCHAR NOT NULL UNIQUE,
                file_type VARCHAR NOT NULL,
                upload_date DATETIME,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )
        """))
        
        # Copy data from old table to new table
        print("📋 Copying data to new table...")
        db.execute(text("""
            INSERT INTO documents_new (id, project_id, orig_filename, stored_filename, file_type, upload_date)
            SELECT id, project_id, orig_filename, stored_filename, file_type, upload_date
            FROM documents
            WHERE project_id IS NOT NULL
        """))
        
        # Drop old table and rename new table
        print("🔄 Replacing old table...")
        db.execute(text("DROP TABLE documents"))
        db.execute(text("ALTER TABLE documents_new RENAME TO documents"))
        
        # Commit all changes
        db.commit()
        print("✅ Successfully fixed documents table schema!")
        
        # Show final schema
        print("\n📋 Final documents table schema:")
        final_schema = db.execute(text("PRAGMA table_info(documents)")).fetchall()
        for col in final_schema:
            print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
        
    except Exception as e:
        print(f"❌ Error fixing schema: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    fix_documents_schema() 