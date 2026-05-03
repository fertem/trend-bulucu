from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..auth import create_access_token, verify_credentials
from ..config import settings


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int
    has_ai: bool


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı")
    token = create_access_token(body.username)
    return LoginOut(
        access_token=token,
        expires_in_hours=settings.jwt_expire_hours,
        has_ai=settings.has_ai,
    )


@router.get("/config")
def public_config():
    """Frontend için public bilgiler (auth gerekmez)."""
    return {"has_ai": settings.has_ai}
