"""Admin panel routes. All require the admin role. Provides operational
visibility and lets the admin tune pricing, commission, dynamic pricing,
matching weights and provider verification without code changes."""
from fastapi import APIRouter, Depends, HTTPException

from .. import db, state_machine as sm
from ..models import ProviderStatusInput, SettingsPatch, now_iso
from ..security import require_roles

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = require_roles("admin")

VALID_STATUS = {"PENDENTE", "EM_ANALISE", "VERIFICADO", "SUSPENSO", "BLOQUEADO"}


def _deep_merge(base: dict, patch: dict) -> dict:
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_merge(base[k], v)
        else:
            base[k] = v
    return base


@router.get("/overview")
async def overview(user: dict = Depends(admin_only)):
    active_states = [sm.SEARCHING_PROVIDER, sm.PROVIDER_ASSIGNED, sm.PROVIDER_ACCEPTED,
                     sm.PROVIDER_EN_ROUTE, sm.SERVICE_STARTED, sm.SERVICE_COMPLETED]
    total_orders = await db.orders.count_documents({})
    active_orders = await db.orders.count_documents({"status": {"$in": active_states}})
    completed_orders = await db.orders.count_documents({"status": sm.COMPLETED})
    customers = await db.users.count_documents({"role": "customer"})
    providers = await db.users.count_documents({"role": "provider"})
    online_providers = await db.providers.count_documents({"is_online": True})
    pending_verif = await db.providers.count_documents({"status": {"$in": ["PENDENTE", "EM_ANALISE"]}})

    completed = await db.orders.find({"status": sm.COMPLETED}, {"_id": 0, "pricing": 1}).to_list(1000)
    gmv = round(sum(o.get("pricing", {}).get("total", 0) for o in completed), 2)
    revenue = round(sum(o.get("pricing", {}).get("commission", 0) for o in completed), 2)
    return {
        "total_orders": total_orders,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "customers": customers,
        "providers": providers,
        "online_providers": online_providers,
        "pending_verifications": pending_verif,
        "gmv": gmv,
        "platform_revenue": revenue,
    }


@router.get("/customers")
async def customers(user: dict = Depends(admin_only)):
    items = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).to_list(500)
    return {"customers": items}


@router.get("/providers")
async def providers(user: dict = Depends(admin_only)):
    profs = await db.providers.find({}, {"_id": 0}).to_list(500)
    out = []
    for p in profs:
        u = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0, "password_hash": 0})
        out.append({**p, "name": (u or {}).get("name"), "email": (u or {}).get("email"),
                    "phone": (u or {}).get("phone")})
    return {"providers": out}


@router.post("/providers/{user_id}/status")
async def set_provider_status(user_id: str, inp: ProviderStatusInput, user: dict = Depends(admin_only)):
    if inp.status not in VALID_STATUS:
        raise HTTPException(400, "Status inválido")
    update = {"status": inp.status, "updated_at": now_iso()}
    if inp.status in ("SUSPENSO", "BLOQUEADO"):
        update["is_online"] = False
    await db.providers.update_one({"user_id": user_id}, {"$set": update})
    from ..integrations import NotificationService
    await NotificationService.notify(user_id, "Status de verificação atualizado",
                                     f"Seu status agora é {inp.status}.", "verification")
    prof = await db.providers.find_one({"user_id": user_id}, {"_id": 0})
    return {"profile": prof}


@router.get("/orders")
async def orders(user: dict = Depends(admin_only)):
    items = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"orders": items}


@router.get("/payments")
async def payments(user: dict = Depends(admin_only)):
    items = await db.orders.find(
        {"payment": {"$ne": None}}, {"_id": 0, "order_id": 1, "payment": 1, "payout": 1,
                                     "price_total": 1, "pricing": 1, "customer_name": 1, "status": 1}
    ).sort("created_at", -1).to_list(500)
    return {"payments": items}


@router.get("/services")
async def services(user: dict = Depends(admin_only)):
    items = await db.services.find({}, {"_id": 0}).to_list(100)
    return {"services": items}


@router.post("/services/{service_id}/toggle")
async def toggle_service(service_id: str, user: dict = Depends(admin_only)):
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Serviço não encontrado")
    await db.services.update_one({"service_id": service_id}, {"$set": {"active": not s.get("active", True)}})
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return {"service": s}


@router.get("/settings")
async def get_settings(user: dict = Depends(admin_only)):
    s = await db.system_settings.find_one({"_id": "global"}, {"_id": 0})
    return {"settings": s or {}}


@router.patch("/settings")
async def patch_settings(inp: SettingsPatch, user: dict = Depends(admin_only)):
    current = await db.system_settings.find_one({"_id": "global"}) or {}
    current.pop("_id", None)
    merged = _deep_merge(current, inp.patch)
    await db.system_settings.update_one({"_id": "global"}, {"$set": merged}, upsert=True)
    s = await db.system_settings.find_one({"_id": "global"}, {"_id": 0})
    return {"settings": s}


@router.get("/reviews")
async def reviews(user: dict = Depends(admin_only)):
    items = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"reviews": items}
