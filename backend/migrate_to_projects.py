"""
Migration script to transition from user-based to project-based organization.

This script will:
1. Create the new projects table
2. Create a default project for each user
3. Migrate existing documents and podcasts to the default project
4. Update the schema
"""

import os
import sqlite3
from datetime import datetime
from models.database import SessionLocal, engine
from models.user import User
from models.project import Project, create_project
from models.document import Document
from models.podcast import Podcast
from sqlalchemy import text

def table_exists(db, table_name):
    """Check if a table exists in the database"""
    try:
        result = db.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"),
            {"table_name": table_name}
        ).fetchone()
        return result is not None
    except Exception:
        return False

def migrate_to_projects():
    """Migrate existing data to the new project-based structure"""
    
    print("🔄 Starting migration to project-based structure...")
    
    # Create new tables first
    from models.database import Base
    Base.metadata.create_all(bind=engine)
    print("✅ Created new tables")
    
    db = SessionLocal()
    
    try:
        # Check if we need to migrate using raw SQL
        users_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        
        # Check if projects table has any data
        projects_count = 0
        if table_exists(db, "projects"):
            projects_count = db.execute(text("SELECT COUNT(*) FROM projects")).scalar()
        
        if users_count == 0:
            print("ℹ️  No users found, no migration needed")
            return
            
        if projects_count > 0:
            print("ℹ️  Projects already exist, migration may have been run before")
            return
        
        print(f"📊 Found {users_count} users to migrate")
        
        # Get all users using ORM (now that we know the table exists)
        users = db.query(User).all()
        
        # For each user, create a default project and migrate their data
        for user in users:
            print(f"👤 Migrating user: {user.username}")
            
            # Create a default project for this user
            default_project = create_project(
                user_id=user.id,
                name=f"{user.username}'s Project",
                description="Default project created during migration"
            )
            print(f"  ✅ Created default project: {default_project.name}")
            
            # Check if we need to migrate documents
            try:
                # Check if documents table has user_id column (old schema)
                has_user_id_column = False
                try:
                    db.execute(text("SELECT user_id FROM documents LIMIT 1")).fetchone()
                    has_user_id_column = True
                except Exception:
                    pass
                
                if has_user_id_column:
                    # Try to find documents with old schema (user_id column)
                    old_documents = db.execute(
                        text("SELECT id, user_id, orig_filename, stored_filename, file_type, upload_date FROM documents WHERE user_id = :user_id"),
                        {"user_id": user.id}
                    ).fetchall()
                    
                    if old_documents:
                        print(f"  📄 Migrating {len(old_documents)} documents...")
                        
                        # Update documents to use project_id instead of user_id
                        for doc in old_documents:
                            db.execute(
                                text("UPDATE documents SET project_id = :project_id WHERE id = :doc_id"),
                                {"project_id": default_project.id, "doc_id": doc.id}
                            )
                        
                        print(f"  ✅ Updated {len(old_documents)} documents")
                else:
                    print("  ℹ️  Documents already use project_id, no migration needed")
                
            except Exception as e:
                print(f"  ⚠️  Could not migrate documents: {e}")
            
            # Check if we need to migrate podcasts
            try:
                # Check if podcasts table has user_id column (old schema)
                has_user_id_column = False
                try:
                    db.execute(text("SELECT user_id FROM podcasts LIMIT 1")).fetchone()
                    has_user_id_column = True
                except Exception:
                    pass
                
                if has_user_id_column:
                    # Try to find podcasts with old schema (user_id column)
                    old_podcasts = db.execute(
                        text("SELECT id, user_id, title, description, audio_filename, document_id, script_text, duration FROM podcasts WHERE user_id = :user_id"),
                        {"user_id": user.id}
                    ).fetchall()
                    
                    if old_podcasts:
                        print(f"  🎙️  Migrating {len(old_podcasts)} podcasts...")
                        
                        # Update podcasts to use project_id instead of user_id
                        for podcast in old_podcasts:
                            db.execute(
                                text("UPDATE podcasts SET project_id = :project_id WHERE id = :podcast_id"),
                                {"project_id": default_project.id, "podcast_id": podcast.id}
                            )
                        
                        print(f"  ✅ Updated {len(old_podcasts)} podcasts")
                else:
                    print("  ℹ️  Podcasts already use project_id, no migration needed")
                
            except Exception as e:
                print(f"  ⚠️  Could not migrate podcasts: {e}")
        
        # Commit all changes
        db.commit()
        print("✅ Migration completed successfully!")
        
        # Now try to clean up old columns (this might fail if they don't exist, which is fine)
        try:
            print("🧹 Cleaning up old schema...")
            
            # Note: SQLite doesn't support DROP COLUMN directly, so we'd need to recreate tables
            # For now, we'll leave the old columns as they might be needed for compatibility
            print("ℹ️  Old columns left in place for compatibility")
            
        except Exception as e:
            print(f"⚠️  Could not clean up old schema: {e}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def check_migration_status():
    """Check if migration is needed"""
    db = SessionLocal()
    try:
        # Use raw SQL to check counts to avoid table existence issues
        users_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        
        projects_count = 0
        if table_exists(db, "projects"):
            projects_count = db.execute(text("SELECT COUNT(*) FROM projects")).scalar()
        
        print(f"📊 Current status:")
        print(f"  Users: {users_count}")
        print(f"  Projects: {projects_count}")
        
        if users_count > 0 and projects_count == 0:
            print("⚠️  Migration needed!")
            return True
        elif projects_count > 0:
            print("✅ Projects exist, migration likely completed")
            return False
        else:
            print("ℹ️  No data to migrate")
            return False
            
    finally:
        db.close()

if __name__ == "__main__":
    print("🔍 Checking migration status...")
    
    if check_migration_status():
        response = input("Do you want to run the migration? (y/N): ")
        if response.lower() == 'y':
            migrate_to_projects()
        else:
            print("Migration cancelled")
    else:
        print("No migration needed") 