from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class DocumentBase(BaseModel):
    id: int
    orig_filename: str
    file_type: str
    upload_date: datetime

    class Config:
        orm_mode = True

class PodcastBase(BaseModel):
    id: int
    title: str
    document_id: Optional[int] = None
    audio_filename: Optional[str] = None
    created_at: datetime
    duration: Optional[float] = None

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None