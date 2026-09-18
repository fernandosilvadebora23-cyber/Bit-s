"""Seed data: system settings, configurable services, regions and demo users.
Idempotent — safe to run on every startup."""
import uuid

from . import db
from .models import now_iso
from .security import hash_password

DEFAULT_SETTINGS = {
    "_id": "global",
    "price_per_km": 2.5,
    "commission": {"rate": 0.12, "min": 0.08, "max": 0.15},
    "dynamic_pricing": {"enabled": True, "min_factor": 1.0, "max_factor": 1.8, "step": 0.1},
    "matching": {
        "weights": {"category": 40, "online": 20, "verified": 15, "proximity": 20, "rating": 5},
        "radius_initial_km": 5,
        "radius_step_km": 5,
        "radius_max_km": 25,
        "max_attempts": 3,
        "wait_seconds": 30,
    },
    "demo_mode": True,
    "active_regions": ["curitiba"],
}

REGIONS = [
    {"region_id": "curitiba", "name": "Curitiba e Região Metropolitana", "state": "PR", "active": True,
     "center": {"lat": -25.4284, "lng": -49.2733}},
]

SERVICES = [
    {
        "service_id": "diarista",
        "name": "Diarista",
        "category": "diarista",
        "icon": "sparkles-outline",
        "description": "Limpeza residencial completa realizada por profissionais.",
        "active": True,
        "regions": ["curitiba"],
        "pricing_strategy": "diarista",
        "pricing_parameters": {
            "base": 80,
            "price_per_room": 25,
            "price_per_bathroom": 20,
            "size_multiplier": {"small": 1.0, "medium": 1.2, "large": 1.5},
            "difficulty_multiplier": {"light": 0.9, "normal": 1.0, "heavy": 1.3},
            "addon_price": {"windows": 30, "ironing": 40, "fridge": 35, "oven": 30},
        },
        "request_fields": [
            {"key": "rooms", "label": "Quantidade de cômodos", "type": "number", "default": 2, "min": 1},
            {"key": "bathrooms", "label": "Quantidade de banheiros", "type": "number", "default": 1, "min": 0},
            {"key": "size", "label": "Tamanho aproximado", "type": "select",
             "options": [{"value": "small", "label": "Pequeno"}, {"value": "medium", "label": "Médio"}, {"value": "large", "label": "Grande"}], "default": "medium"},
            {"key": "difficulty", "label": "Nível de dificuldade", "type": "select",
             "options": [{"value": "light", "label": "Leve"}, {"value": "normal", "label": "Normal"}, {"value": "heavy", "label": "Pesado"}], "default": "normal"},
            {"key": "addons", "label": "Serviços adicionais", "type": "multiselect",
             "options": [{"value": "windows", "label": "Janelas"}, {"value": "ironing", "label": "Passar roupa"}, {"value": "fridge", "label": "Geladeira"}, {"value": "oven", "label": "Forno"}]},
        ],
    },
    {
        "service_id": "eletricista",
        "name": "Eletricista",
        "category": "eletricista",
        "icon": "flash-outline",
        "description": "Instalações e reparos elétricos com segurança.",
        "active": True,
        "regions": ["curitiba"],
        "pricing_strategy": "visit",
        "pricing_parameters": {
            "base": 90,
            "visit_fee": 50,
            "price_per_point": 15,
            "problem_multiplier": {"installation": 1.2, "repair": 1.0, "inspection": 0.8},
            "urgency_multiplier": {"normal": 1.0, "urgent": 1.4},
        },
        "request_fields": [
            {"key": "problem_type", "label": "Tipo de serviço", "type": "select",
             "options": [{"value": "installation", "label": "Instalação"}, {"value": "repair", "label": "Reparo"}, {"value": "inspection", "label": "Inspeção"}], "default": "repair"},
            {"key": "points", "label": "Número de pontos", "type": "number", "default": 1, "min": 0},
            {"key": "urgency", "label": "Urgência", "type": "select",
             "options": [{"value": "normal", "label": "Normal"}, {"value": "urgent", "label": "Urgente"}], "default": "normal"},
        ],
    },
    {
        "service_id": "encanador",
        "name": "Encanador",
        "category": "encanador",
        "icon": "water-outline",
        "description": "Reparos hidráulicos, vazamentos e desentupimentos.",
        "active": True,
        "regions": ["curitiba"],
        "pricing_strategy": "visit",
        "pricing_parameters": {
            "base": 100,
            "visit_fee": 60,
            "price_per_point": 0,
            "problem_multiplier": {"leak": 1.1, "clog": 1.0, "installation": 1.3},
            "urgency_multiplier": {"normal": 1.0, "urgent": 1.5},
        },
        "request_fields": [
            {"key": "problem_type", "label": "Tipo de problema", "type": "select",
             "options": [{"value": "leak", "label": "Vazamento"}, {"value": "clog", "label": "Entupimento"}, {"value": "installation", "label": "Instalação"}], "default": "leak"},
            {"key": "urgency", "label": "Urgência", "type": "select",
             "options": [{"value": "normal", "label": "Normal"}, {"value": "urgent", "label": "Urgente"}], "default": "normal"},
        ],
    },
]

CURITIBA = {"lat": -25.4284, "lng": -49.2733}


def _demo_user(email, name, role, phone):
    return {
        "user_id": f"demo_{role}_{uuid.uuid4().hex[:6]}",
        "email": email,
        "name": name,
        "role": role,
        "phone": phone,
        "password_hash": hash_password("demo1234"),
        "auth_provider": "password",
        "created_at": now_iso(),
    }


async def seed():
    await db.system_settings.update_one({"_id": "global"}, {"$setOnInsert": DEFAULT_SETTINGS}, upsert=True)

    for r in REGIONS:
        await db.regions.update_one({"region_id": r["region_id"]}, {"$set": r}, upsert=True)
    for s in SERVICES:
        await db.services.update_one({"service_id": s["service_id"]}, {"$set": s}, upsert=True)

    # Admin
    if not await db.users.find_one({"email": "admin@bits.app"}):
        u = _demo_user("admin@bits.app", "Administrador Bit-s", "admin", "+55 41 90000-0000")
        await db.users.insert_one(u)

    # Demo customers
    for email, name in [("cliente1@bits.app", "Cliente Demo 1"), ("cliente2@bits.app", "Cliente Demo 2")]:
        if not await db.users.find_one({"email": email}):
            u = _demo_user(email, name, "customer", "+55 41 91111-1111")
            await db.users.insert_one(u)
            await db.addresses.insert_one({
                "address_id": str(uuid.uuid4()),
                "user_id": u["user_id"],
                "label": "Casa",
                "street": "Rua XV de Novembro",
                "number": "100",
                "neighborhood": "Centro",
                "city": "Curitiba",
                "state": "PR",
                "location": {"lat": CURITIBA["lat"] + 0.005, "lng": CURITIBA["lng"] + 0.004},
                "is_default": True,
                "created_at": now_iso(),
            })

    # Demo providers (one per category), VERIFICADO + online
    demo_providers = [
        ("prestador.diarista@bits.app", "Ana Diarista", "diarista", 0.006, 0.003),
        ("prestador.eletricista@bits.app", "Carlos Eletricista", "eletricista", -0.004, 0.005),
        ("prestador.encanador@bits.app", "João Encanador", "encanador", 0.003, -0.006),
    ]
    for email, name, cat, dlat, dlng in demo_providers:
        if await db.users.find_one({"email": email}):
            continue
        u = _demo_user(email, name, "provider", "+55 41 92222-2222")
        await db.users.insert_one(u)
        await db.providers.insert_one({
            "user_id": u["user_id"],
            "cpf": "000.000.000-00",
            "birthdate": "1990-01-01",
            "photo_url": None,
            "payout_info": {"pix_key": email},
            "categories": [cat],
            "radius_km": 20,
            "region": "curitiba",
            "documents": [{"type": "RG", "status": "approved"}],
            "category_info": {},
            "status": "VERIFICADO",
            "is_online": True,
            "current_location": {"lat": CURITIBA["lat"] + dlat, "lng": CURITIBA["lng"] + dlng},
            "rating_avg": 4.8,
            "rating_count": 12,
            "earnings_total": 0.0,
            "created_at": now_iso(),
        })
