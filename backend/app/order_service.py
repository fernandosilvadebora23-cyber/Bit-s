"""Order orchestration: event logging, validated state transitions, and the
matching workflow. Keeps business logic out of the routers."""
import uuid
from typing import Optional

from . import db, state_machine as sm
from .engines import MatchingEngine
from .integrations import NotificationService
from .models import now_iso


async def get_settings() -> dict:
    s = await db.system_settings.find_one({"_id": "global"}, {"_id": 0})
    return s or {}


async def log_event(order_id: str, event: str, detail: Optional[dict] = None):
    await db.order_events.insert_one({
        "event_id": str(uuid.uuid4()),
        "order_id": order_id,
        "event": event,
        "detail": detail or {},
        "created_at": now_iso(),
    })


async def transition(order: dict, target: str, detail: Optional[dict] = None) -> dict:
    """Validate and apply an order state transition. Returns updated order dict."""
    current = order["status"]
    if not sm.can_transition(current, target):
        raise ValueError(f"Transição inválida: {current} -> {target}")
    update = {"status": target, "updated_at": now_iso()}
    if detail:
        update.update(detail)
    await db.orders.update_one({"order_id": order["order_id"]}, {"$set": update})
    await log_event(order["order_id"], f"STATUS:{target}", detail)
    order.update(update)
    return order


async def run_matching(order: dict) -> dict:
    """Search compatible providers, expanding the radius across attempts.
    Assigns the top-scoring candidate (PROVIDER_ASSIGNED) or NO_PROVIDER_FOUND.
    """
    settings = await get_settings()
    mcfg = settings.get("matching", {})
    radius = float(mcfg.get("radius_initial_km", 5))
    radius_step = float(mcfg.get("radius_step_km", 5))
    radius_max = float(mcfg.get("radius_max_km", 25))
    max_attempts = int(mcfg.get("max_attempts", 3))

    order = await transition(order, sm.SEARCHING_PROVIDER)

    attempt = 0
    chosen = None
    while attempt < max_attempts and radius <= radius_max:
        attempt += 1
        candidates = await MatchingEngine.find_candidates(order, settings, radius)
        await db.matching_attempts.insert_one({
            "attempt_id": str(uuid.uuid4()),
            "order_id": order["order_id"],
            "attempt": attempt,
            "radius_km": radius,
            "candidate_count": len(candidates),
            "candidates": candidates[:5],
            "created_at": now_iso(),
        })
        if candidates:
            chosen = candidates[0]
            break
        radius += radius_step

    if not chosen:
        return await transition(order, sm.NO_PROVIDER_FOUND)

    order = await transition(order, sm.PROVIDER_ASSIGNED, {
        "provider_id": chosen["provider_id"],
        "match_score": chosen["score"],
        "provider_distance_km": chosen.get("distance_km"),
    })
    await NotificationService.notify(
        chosen["provider_id"], "Novo pedido disponível",
        f"Você recebeu um pedido de {order['service_name']}.", "order",
        {"order_id": order["order_id"]},
    )
    await NotificationService.notify(
        order["customer_id"], "Prestador encontrado",
        "Estamos aguardando a confirmação do prestador.", "order",
        {"order_id": order["order_id"]},
    )
    return order


async def order_public(order: dict) -> dict:
    """Attach provider/customer summaries for API responses."""
    out = dict(order)
    if order.get("provider_id"):
        prov_user = await db.users.find_one({"user_id": order["provider_id"]}, {"_id": 0, "password_hash": 0})
        prov = await db.providers.find_one({"user_id": order["provider_id"]}, {"_id": 0})
        if prov_user:
            out["provider"] = {
                "user_id": prov_user["user_id"],
                "name": prov_user.get("name"),
                "phone": prov_user.get("phone"),
                "photo_url": (prov or {}).get("photo_url"),
                "rating_avg": (prov or {}).get("rating_avg", 0),
                "current_location": (prov or {}).get("current_location"),
            }
    return out
