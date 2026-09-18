"""Catalog, geo helpers, account (addresses/notifications) routes."""
import uuid

from fastapi import APIRouter, Depends

from .. import db
from ..integrations import maps_service
from ..models import AddressInput, Point, now_iso
from ..security import get_current_user

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/services")
async def list_services():
    items = await db.services.find({"active": True}, {"_id": 0}).to_list(100)
    return {"services": items}


@router.get("/services/{service_id}")
async def get_service(service_id: str):
    s = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    return {"service": s}


@router.get("/regions")
async def list_regions():
    items = await db.regions.find({"active": True}, {"_id": 0}).to_list(100)
    return {"regions": items}


@router.get("/settings/public")
async def public_settings():
    s = await db.system_settings.find_one({"_id": "global"}, {"_id": 0})
    s = s or {}
    return {
        "demo_mode": s.get("demo_mode", True),
        "dynamic_pricing_enabled": s.get("dynamic_pricing", {}).get("enabled", True),
        "active_regions": s.get("active_regions", ["curitiba"]),
        "maps_provider": maps_service.provider,
    }


# ---- Geo helpers (backend is the only caller of the maps integration) ----
@router.post("/geo/geocode")
async def geocode(payload: dict):
    return await maps_service.geocode(payload.get("address", ""))


@router.post("/geo/route")
async def route(payload: dict):
    return await maps_service.route(payload["origin"], payload["destination"])


# ---- Addresses ----
@router.get("/me/addresses")
async def my_addresses(user: dict = Depends(get_current_user)):
    items = await db.addresses.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    return {"addresses": items}


@router.post("/me/addresses")
async def add_address(inp: AddressInput, user: dict = Depends(get_current_user)):
    loc = inp.location.model_dump() if inp.location else None
    if not loc:
        g = await maps_service.geocode(f"{inp.street} {inp.number}, {inp.neighborhood}, {inp.city}")
        loc = g["location"]
    existing = await db.addresses.count_documents({"user_id": user["user_id"]})
    doc = {
        "address_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        **inp.model_dump(exclude={"location"}),
        "location": loc,
        "is_default": existing == 0,
        "created_at": now_iso(),
    }
    await db.addresses.insert_one(doc)
    doc.pop("_id", None)
    return {"address": doc}


@router.delete("/me/addresses/{address_id}")
async def delete_address(address_id: str, user: dict = Depends(get_current_user)):
    await db.addresses.update_one(
        {"address_id": address_id, "user_id": user["user_id"]},
        {"$set": {"deleted_at": now_iso()}},
    )
    return {"ok": True}


# ---- Notifications ----
@router.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    unread = sum(1 for n in items if not n.get("read"))
    return {"notifications": items, "unread": unread}


@router.post("/notifications/{notification_id}/read")
async def read_notification(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"read": True}},
    )
    return {"ok": True}
