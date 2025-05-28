"""
Script to add project_id columns to existing documents and podcasts tables.
This handles the schema migration for existing databases.
"""

import os
from models.database import SessionLocal, engine
from sqlalchemy import text

def add_project_columns():
    """Add project_id columns to documents and podcasts tables"""
    
    print("🔄 Adding project_id columns to existing tables...")
    
    db = SessionLocal()
    
    try:
        # Check if documents table has project_id column
        try:
            db.execute(text("SELECT project_id FROM documents LIMIT 1")).fetchone()
            print("  ℹ️  Documents table already has project_id column")
        except Exception:
            print("  📄 Adding project_id column to documents table...")
            db.execute(text("ALTER TABLE documents ADD COLUMN project_id INTEGER"))
            print("  ✅ Added project_id column to documents table")
        
        # Check if podcasts table has project_id column
        try:
            db.execute(text("SELECT project_id FROM podcasts LIMIT 1")).fetchone()
            print("  ℹ️  Podcasts table already has project_id column")
        except Exception:
            print("  🎙️  Adding project_id column to podcasts table...")
            db.execute(text("ALTER TABLE podcasts ADD COLUMN project_id INTEGER"))
            print("  ✅ Added project_id column to podcasts table")
        
        # Commit the changes
        db.commit()
        print("✅ Successfully added project_id columns!")
        
    except Exception as e:
        print(f"❌ Error adding columns: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    add_project_columns() 