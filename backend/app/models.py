"""Pydantic request/response models. Documents in Mongo use plain dicts with
string ids; these models validate the API boundary."""
from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)
    role: str = "customer"  # customer | provider


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class SessionInput(BaseModel):
    session_id: str


class ForgotPasswordInput(BaseModel):
    email: EmailStr


# ---------------------------------------------------------------------------
# Location / address
# ---------------------------------------------------------------------------
class Point(BaseModel):
    lat: float
    lng: float


class AddressInput(BaseModel):
    label: str = "Casa"
    street: str
    number: str = ""
    complement: str = ""
    neighborhood: str = ""
    city: str = "Curitiba"
    state: str = "PR"
    location: Optional[Point] = None


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------
class ProviderProfileInput(BaseModel):
    cpf: str
    birthdate: str
    photo_url: Optional[str] = None
    payout_info: dict[str, Any] = Field(default_factory=dict)
    categories: list[str] = Field(default_factory=list)  # service categories
    radius_km: float = 10.0
    region: str = "curitiba"
    documents: list[dict[str, Any]] = Field(default_factory=list)
    category_info: dict[str, Any] = Field(default_factory=dict)


class AvailabilityInput(BaseModel):
    is_online: bool
    location: Optional[Point] = None


class LocationInput(BaseModel):
    location: Point


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
class CreateOrderInput(BaseModel):
    service_id: str
    address: AddressInput
    params: dict[str, Any] = Field(default_factory=dict)
    notes: str = ""
    photos: list[str] = Field(default_factory=list)


class PriceQuoteInput(BaseModel):
    service_id: str
    params: dict[str, Any] = Field(default_factory=dict)
    location: Optional[Point] = None


class ReviewInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = ""


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
class ProviderStatusInput(BaseModel):
    status: str  # PENDENTE | EM_ANALISE | VERIFICADO | SUSPENSO | BLOQUEADO


class SettingsPatch(BaseModel):
    patch: dict[str, Any]
