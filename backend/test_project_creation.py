"""
Test script to debug project creation issues
"""

import sys
sys.path.append('.')

from models.database import SessionLocal
from models.project import create_project
from models.user import User
from routers.projects import ProjectCreate
from sqlalchemy import text

def test_project_creation():
    """Test project creation to debug 422 errors"""
    
    print("🔍 Testing project creation...")
    
    db = SessionLocal()
    
    try:
        # Check if users exist
        users = db.query(User).all()
        print(f"📊 Found {len(users)} users in database")
        
        if not users:
            print("❌ No users found! You need to create a user first.")
            return
        
        user = users[0]
        print(f"👤 Testing with user: {user.username} (ID: {user.id})")
        
        # Test Pydantic validation
        print("\n🧪 Testing Pydantic validation...")
        try:
            project_data = ProjectCreate(name="Test Project", description="")
            print(f"✅ Pydantic validation passed: {project_data}")
        except Exception as e:
            print(f"❌ Pydantic validation failed: {e}")
            return
        
        # Test direct project creation
        print("\n🧪 Testing direct project creation...")
        try:
            project = create_project(
                user_id=user.id,
                name="Test Project Direct",
                description=""
            )
            print(f"✅ Direct project creation succeeded: {project.name} (ID: {project.id})")
        except Exception as e:
            print(f"❌ Direct project creation failed: {e}")
            return
        
        print("\n✅ All tests passed! The issue might be with authentication or request format.")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_project_creation() 