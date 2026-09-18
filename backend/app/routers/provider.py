"""Provider self-service routes: onboarding profile, availability, location,
incoming requests, earnings, reviews, documents."""
from fastapi import APIRouter, Depends, HTTPException

from .. import db, state_machine as sm
from ..models import (AvailabilityInput, LocationInput, ProviderProfileInput,
                      now_iso)
from ..order_service import order_public
from ..security import require_roles

router = APIRouter(prefix="/api/provider", tags=["provider"])
provider_only = require_roles("provider")


@router.get("/me")
async def get_profile(user: dict = Depends(provider_only)):
    prof = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"profile": prof}


@router.put("/me")
async def update_profile(inp: ProviderProfileInput, user: dict = Depends(provider_only)):
    data = inp.model_dump()
    # Submitting the profile moves PENDENTE -> EM_ANALISE (simulated verification).
    current = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if current and current.get("status") == "PENDENTE":
        data["status"] = "EM_ANALISE"
    data["updated_at"] = now_iso()
    await db.providers.update_one({"user_id": user["user_id"]}, {"$set": data}, upsert=True)
    prof = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"profile": prof}


@router.post("/availability")
async def set_availability(inp: AvailabilityInput, user: dict = Depends(provider_only)):
    prof = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not prof or prof.get("status") != "VERIFICADO":
        raise HTTPException(400, "Prestador precisa estar verificado para ficar disponível")
    update = {"is_online": inp.is_online, "updated_at": now_iso()}
    if inp.location:
        update["current_location"] = inp.location.model_dump()
    await db.providers.update_one({"user_id": user["user_id"]}, {"$set": update})
    return {"is_online": inp.is_online}


@router.post("/location")
async def update_location(inp: LocationInput, user: dict = Depends(provider_only)):
    await db.providers.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"current_location": inp.location.model_dump(), "updated_at": now_iso()}},
    )
    return {"ok": True}


@router.get("/incoming")
async def incoming(user: dict = Depends(provider_only)):
    """Orders assigned to me and awaiting my acceptance."""
    items = await db.orders.find(
        {"provider_id": user["user_id"], "status": sm.PROVIDER_ASSIGNED}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"orders": [await order_public(o) for o in items]}


@router.get("/active")
async def active(user: dict = Depends(provider_only)):
    """Orders I accepted and am currently working on."""
    states = [sm.PROVIDER_ACCEPTED, sm.PROVIDER_EN_ROUTE, sm.SERVICE_STARTED, sm.SERVICE_COMPLETED]
    items = await db.orders.find(
        {"provider_id": user["user_id"], "status": {"$in": states}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"orders": [await order_public(o) for o in items]}


@router.get("/earnings")
async def earnings(user: dict = Depends(provider_only)):
    prof = await db.providers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    completed = await db.orders.find(
        {"provider_id": user["user_id"], "status": sm.COMPLETED}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    total = sum(o.get("pricing", {}).get("provider_payout", 0) for o in completed)
    return {
        "earnings_total": round(total, 2),
        "completed_count": len(completed),
        "rating_avg": (prof or {}).get("rating_avg", 0),
        "rating_count": (prof or {}).get("rating_count", 0),
        "orders": completed,
    }


@router.get("/reviews")
async def my_reviews(user: dict = Depends(provider_only)):
    items = await db.reviews.find({"provider_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"reviews": items}
