"""Authentication routes: email/password (JWT) + Emergent Google login."""
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException

from .. import db
from ..config import EMERGENT_OAUTH_URL
from ..integrations import EmailService
from ..models import (ForgotPasswordInput, LoginInput, RegisterInput,
                      SessionInput, now_iso)
from ..security import (create_token, get_current_user, hash_password,
                       verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("password_hash", "_id")}


@router.post("/register")
async def register(inp: RegisterInput):
    if inp.role not in ("customer", "provider"):
        raise HTTPException(400, "Papel inválido")
    if await db.users.find_one({"email": inp.email.lower()}):
        raise HTTPException(409, "E-mail já cadastrado")
    user = {
        "user_id": f"usr_{uuid.uuid4().hex[:12]}",
        "email": inp.email.lower(),
        "name": inp.name,
        "phone": inp.phone,
        "role": inp.role,
        "password_hash": hash_password(inp.password),
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    if inp.role == "provider":
        await db.providers.insert_one({
            "user_id": user["user_id"],
            "cpf": "", "birthdate": "", "photo_url": None,
            "payout_info": {}, "categories": [], "radius_km": 10, "region": "curitiba",
            "documents": [], "category_info": {},
            "status": "PENDENTE", "is_online": False, "current_location": None,
            "rating_avg": 0.0, "rating_count": 0, "earnings_total": 0.0,
            "created_at": now_iso(),
        })
    return {"token": create_token(user["user_id"]), "user": _public_user(user)}


@router.post("/login")
async def login(inp: LoginInput):
    user = await db.users.find_one({"email": inp.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(inp.password, user["password_hash"]):
        raise HTTPException(401, "Credenciais inválidas")
    return {"token": create_token(user["user_id"]), "user": _public_user(user)}


@router.post("/session")
async def google_session(inp: SessionInput):
    """Exchange an Emergent session_id for a user + app JWT (Google login)."""
    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(EMERGENT_OAUTH_URL, headers={"X-Session-ID": inp.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Sessão inválida")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(401, "Sessão sem e-mail")
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": f"usr_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "phone": "",
            "role": "customer",
            "picture": data.get("picture"),
            "auth_provider": "google",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    return {"token": create_token(user["user_id"]), "user": _public_user(user)}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user}


@router.post("/forgot-password")
async def forgot_password(inp: ForgotPasswordInput):
    # MVP: always respond success; send a (mock) reset email if user exists.
    user = await db.users.find_one({"email": inp.email.lower()})
    if user:
        await EmailService.send(inp.email, "Recuperação de senha Bit-s",
                                "Use o código 000000 para redefinir sua senha (demo).")
    return {"ok": True, "message": "Se o e-mail existir, enviaremos instruções."}
