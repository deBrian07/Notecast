"""
Script to fix the podcasts table schema by removing the user_id column
since we now use project_id for the project-based organization.
"""

import os
from models.database import SessionLocal, engine
from sqlalchemy import text

def fix_podcasts_schema():
    """Fix the podcasts table schema by removing user_id column"""
    
    print("🔄 Fixing podcasts table schema...")
    
    db = SessionLocal()
    
    try:
        # Check current schema
        print("📋 Checking current podcasts table schema...")
        schema_info = db.execute(text("PRAGMA table_info(podcasts)")).fetchall()
        
        print("Current columns:")
        for col in schema_info:
            print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
        
        # Check if user_id column exists
        has_user_id = any(col[1] == 'user_id' for col in schema_info)
        has_project_id = any(col[1] == 'project_id' for col in schema_info)
        
        if not has_user_id:
            print("✅ Podcasts table already migrated (no user_id column)")
            return
            
        if not has_project_id:
            print("❌ Podcasts table missing project_id column")
            print("🔄 Adding project_id column...")
            db.execute(text("ALTER TABLE podcasts ADD COLUMN project_id INTEGER"))
            db.commit()
            print("✅ Added project_id column")
        
        # SQLite doesn't support dropping columns directly, so we need to recreate the table
        print("🔄 Recreating podcasts table without user_id column...")
        
        # Create new table with correct schema
        db.execute(text("""
            CREATE TABLE podcasts_new (
                id INTEGER PRIMARY KEY,
                title VARCHAR NOT NULL,
                description TEXT,
                audio_filename VARCHAR,
                project_id INTEGER NOT NULL,
                document_id INTEGER,
                script_text TEXT,
                duration INTEGER,
                created_at DATETIME,
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(document_id) REFERENCES documents(id)
            )
        """))
        
        # Copy data from old table to new table
        print("📋 Copying data to new table...")
        db.execute(text("""
            INSERT INTO podcasts_new (id, title, description, audio_filename, project_id, document_id, script_text, duration)
            SELECT id, title, description, audio_filename, project_id, document_id, script_text, duration
            FROM podcasts
            WHERE project_id IS NOT NULL
        """))
        
        # Drop old table and rename new table
        print("🔄 Replacing old table...")
        db.execute(text("DROP TABLE podcasts"))
        db.execute(text("ALTER TABLE podcasts_new RENAME TO podcasts"))
        
        # Commit all changes
        db.commit()
        print("✅ Successfully fixed podcasts table schema!")
        
        # Show final schema
        print("\n📋 Final podcasts table schema:")
        final_schema = db.execute(text("PRAGMA table_info(podcasts)")).fetchall()
        for col in final_schema:
            print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
        
    except Exception as e:
        print(f"❌ Error fixing schema: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    fix_podcasts_schema() 