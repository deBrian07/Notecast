"""
Script to populate project_id columns in documents and podcasts tables.
This assigns existing documents and podcasts to the appropriate projects.
"""

import os
from models.database import SessionLocal, engine
from sqlalchemy import text

def populate_project_ids():
    """Populate project_id columns in documents and podcasts tables"""
    
    print("🔄 Populating project_id columns...")
    
    db = SessionLocal()
    
    try:
        # Get all users using raw SQL to avoid import issues
        users = db.execute(text("SELECT id, username FROM users")).fetchall()
        
        for user in users:
            user_id = user.id
            username = user.username
            print(f"👤 Processing user: {username}")
            
            # Get the user's projects using raw SQL
            projects = db.execute(
                text("SELECT id, name FROM projects WHERE user_id = :user_id"),
                {"user_id": user_id}
            ).fetchall()
            
            if not projects:
                print(f"  ⚠️  No projects found for user {username}")
                continue
            
            # Use the first project as the default
            default_project = projects[0]
            project_id = default_project.id
            project_name = default_project.name
            print(f"  📁 Using project: {project_name}")
            
            # Update documents that have user_id but no project_id
            try:
                documents_updated = db.execute(
                    text("""
                        UPDATE documents 
                        SET project_id = :project_id 
                        WHERE user_id = :user_id AND (project_id IS NULL OR project_id = 0)
                    """),
                    {"project_id": project_id, "user_id": user_id}
                ).rowcount
                
                if documents_updated > 0:
                    print(f"  📄 Updated {documents_updated} documents")
                else:
                    print(f"  📄 No documents to update")
                
            except Exception as e:
                print(f"  ⚠️  Error updating documents: {e}")
            
            # Update podcasts that have user_id but no project_id
            try:
                podcasts_updated = db.execute(
                    text("""
                        UPDATE podcasts 
                        SET project_id = :project_id 
                        WHERE user_id = :user_id AND (project_id IS NULL OR project_id = 0)
                    """),
                    {"project_id": project_id, "user_id": user_id}
                ).rowcount
                
                if podcasts_updated > 0:
                    print(f"  🎙️  Updated {podcasts_updated} podcasts")
                else:
                    print(f"  🎙️  No podcasts to update")
                
            except Exception as e:
                print(f"  ⚠️  Error updating podcasts: {e}")
        
        # Commit all changes
        db.commit()
        print("✅ Successfully populated project_id columns!")
        
        # Show final status
        print("\n📊 Final status:")
        docs_with_project = db.execute(text("SELECT COUNT(*) FROM documents WHERE project_id IS NOT NULL AND project_id > 0")).scalar()
        docs_without_project = db.execute(text("SELECT COUNT(*) FROM documents WHERE project_id IS NULL OR project_id = 0")).scalar()
        podcasts_with_project = db.execute(text("SELECT COUNT(*) FROM podcasts WHERE project_id IS NOT NULL AND project_id > 0")).scalar()
        podcasts_without_project = db.execute(text("SELECT COUNT(*) FROM podcasts WHERE project_id IS NULL OR project_id = 0")).scalar()
        
        print(f"  Documents with project: {docs_with_project}")
        print(f"  Documents without project: {docs_without_project}")
        print(f"  Podcasts with project: {podcasts_with_project}")
        print(f"  Podcasts without project: {podcasts_without_project}")
        
    except Exception as e:
        print(f"❌ Error populating project IDs: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    populate_project_ids() 