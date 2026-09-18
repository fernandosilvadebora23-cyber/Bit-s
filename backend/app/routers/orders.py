"""Order lifecycle routes: quote, create, list, detail, cancel, payment,
review (customer) and provider-side state transitions."""
import uuid

from fastapi import APIRouter, Depends, HTTPException

from .. import db, state_machine as sm
from ..engines import DynamicPricingEngine, PricingEngine
from ..integrations import NotificationService, maps_service, payment_service
from ..models import CreateOrderInput, PriceQuoteInput, ReviewInput, now_iso
from ..order_service import (get_settings, log_event, order_public,
                             run_matching, transition)
from ..security import get_current_user

router = APIRouter(prefix="/api/orders", tags=["orders"])

REGION_CENTER = {"lat": -25.4284, "lng": -49.2733}


async def _compute_quote(service: dict, params: dict, location: dict | None) -> dict:
    settings = await get_settings()
    surge = await DynamicPricingEngine.factor(service["category"], "curitiba", settings)
    distance_km = 0.0
    if location:
        r = await maps_service.route(REGION_CENTER, location)
        distance_km = r["distance_km"]
    quote = PricingEngine.quote(service, params, distance_km, surge, settings)
    quote["distance_km"] = distance_km
    quote["service_id"] = service["service_id"]
    quote["service_name"] = service["name"]
    return quote


@router.post("/quote")
async def quote(inp: PriceQuoteInput):
    service = await db.services.find_one({"service_id": inp.service_id}, {"_id": 0})
    if not service:
        raise HTTPException(404, "Serviço não encontrado")
    loc = inp.location.model_dump() if inp.location else None
    return await _compute_quote(service, inp.params, loc)


@router.post("")
async def create_order(inp: CreateOrderInput, user: dict = Depends(get_current_user)):
    if user["role"] != "customer":
        raise HTTPException(403, "Apenas clientes podem solicitar serviços")
    service = await db.services.find_one({"service_id": inp.service_id}, {"_id": 0})
    if not service:
        raise HTTPException(404, "Serviço não encontrado")

    location = inp.address.location.model_dump() if inp.address.location else None
    if not location:
        g = await maps_service.geocode(
            f"{inp.address.street} {inp.address.number}, {inp.address.city}"
        )
        location = g["location"]

    q = await _compute_quote(service, inp.params, location)

    order = {
        "order_id": f"ord_{uuid.uuid4().hex[:12]}",
        "customer_id": user["user_id"],
        "customer_name": user.get("name"),
        "service_id": service["service_id"],
        "service_name": service["name"],
        "service_category": service["category"],
        "region": "curitiba",
        "address": inp.address.model_dump(),
        "location": location,
        "params": inp.params,
        "notes": inp.notes,
        "photos": inp.photos,
        "pricing": q,
        "price_total": q["total"],
        "provider_id": None,
        "status": sm.CREATED,
        "payment": None,
        "payout": None,
        "review": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    await log_event(order["order_id"], "ORDER_CREATED", {"customer_id": user["user_id"]})

    order = await transition(order, sm.PRICED, {"pricing": q})
    order = await run_matching(order)
    return {"order": await order_public(order)}


@router.get("")
async def list_orders(user: dict = Depends(get_current_user)):
    if user["role"] == "provider":
        query = {"provider_id": user["user_id"]}
    else:
        query = {"customer_id": user["user_id"]}
    items = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"orders": items}


@router.get("/{order_id}")
async def order_detail(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Pedido não encontrado")
    if user["role"] != "admin" and user["user_id"] not in (order.get("customer_id"), order.get("provider_id")):
        raise HTTPException(403, "Sem acesso a este pedido")
    events = await db.order_events.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"order": await order_public(order), "events": events}


@router.post("/{order_id}/cancel")
async def cancel_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Pedido não encontrado")
    if user["user_id"] != order["customer_id"] and user["role"] != "admin":
        raise HTTPException(403, "Sem permissão")
    if order["status"] not in sm.CUSTOMER_CANCELLABLE:
        raise HTTPException(400, "Não é possível cancelar neste estágio")
    order = await transition(order, sm.CANCELLED, {"cancelled_by": user["role"]})
    if order.get("provider_id"):
        await NotificationService.notify(order["provider_id"], "Pedido cancelado",
                                         "O cliente cancelou o pedido.", "order", {"order_id": order_id})
    return {"order": await order_public(order)}


@router.post("/{order_id}/pay")
async def pay_order(order_id: str, payload: dict = None, user: dict = Depends(get_current_user)):
    payload = payload or {}
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Pedido não encontrado")
    if user["user_id"] != order["customer_id"]:
        raise HTTPException(403, "Sem permissão")
    if order["status"] != sm.SERVICE_COMPLETED:
        raise HTTPException(400, "Pagamento disponível após a conclusão do serviço")

    method = payload.get("method", "pix")
    outcome = payload.get("outcome", "approved")
    charge = await payment_service.charge(order_id, order["price_total"], method, outcome)

    if charge["status"] != "APPROVED":
        order = await transition(order, sm.PAYMENT_FAILED, {"payment": charge})
        return {"order": await order_public(order), "payment": charge}

    order = await transition(order, sm.PAYMENT_CONFIRMED, {"payment": charge})
    await NotificationService.notify(order["customer_id"], "Pagamento confirmado",
                                     "Seu pagamento foi confirmado.", "payment", {"order_id": order_id})

    # Payout to provider (mock split) then complete.
    payout_amount = order["pricing"]["provider_payout"]
    payout = await payment_service.payout(order["provider_id"], payout_amount)
    order = await transition(order, sm.PAYOUT_PENDING, {"payout": payout})
    await db.providers.update_one({"user_id": order["provider_id"]},
                                  {"$inc": {"earnings_total": payout_amount}})
    order = await transition(order, sm.COMPLETED)
    await NotificationService.notify(order["provider_id"], "Repasse a caminho",
                                     f"Você recebeu R$ {payout_amount:.2f} pelo serviço.", "payment",
                                     {"order_id": order_id})
    return {"order": await order_public(order), "payment": charge, "payout": payout}


@router.post("/{order_id}/review")
async def review_order(order_id: str, inp: ReviewInput, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Pedido não encontrado")
    if user["user_id"] != order["customer_id"]:
        raise HTTPException(403, "Sem permissão")
    if order["status"] != sm.COMPLETED:
        raise HTTPException(400, "Avaliação disponível após a conclusão")
    if order.get("review"):
        raise HTTPException(409, "Pedido já avaliado")

    review = {
        "review_id": str(uuid.uuid4()),
        "order_id": order_id,
        "customer_id": user["user_id"],
        "provider_id": order["provider_id"],
        "rating": inp.rating,
        "comment": inp.comment,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(review)
    review.pop("_id", None)
    await db.orders.update_one({"order_id": order_id}, {"$set": {"review": review}})

    # Recompute provider average.
    ratings = await db.reviews.find({"provider_id": order["provider_id"]}, {"_id": 0, "rating": 1}).to_list(1000)
    avg = round(sum(r["rating"] for r in ratings) / len(ratings), 2)
    await db.providers.update_one({"user_id": order["provider_id"]},
                                  {"$set": {"rating_avg": avg, "rating_count": len(ratings)}})
    return {"review": review, "provider_rating_avg": avg}


# ---------------------------------------------------------------------------
# Provider-side transitions
# ---------------------------------------------------------------------------
async def _provider_order(order_id: str, user: dict) -> dict:
    if user["role"] != "provider":
        raise HTTPException(403, "Apenas prestadores")
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Pedido não encontrado")
    if order.get("provider_id") != user["user_id"]:
        raise HTTPException(403, "Pedido não atribuído a você")
    return order


@router.post("/{order_id}/accept")
async def accept_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await _provider_order(order_id, user)
    order = await transition(order, sm.PROVIDER_ACCEPTED)
    await NotificationService.notify(order["customer_id"], "Pedido aceito",
                                     "Seu prestador aceitou o pedido.", "order", {"order_id": order_id})
    return {"order": await order_public(order)}


@router.post("/{order_id}/decline")
async def decline_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await _provider_order(order_id, user)
    await log_event(order_id, "PROVIDER_DECLINED", {"provider_id": user["user_id"]})
    await db.orders.update_one({"order_id": order_id},
                               {"$set": {"provider_id": None, "status": sm.SEARCHING_PROVIDER}})
    order["provider_id"] = None
    order["status"] = sm.SEARCHING_PROVIDER
    order = await run_matching(order)
    return {"order": await order_public(order)}


@router.post("/{order_id}/en_route")
async def en_route(order_id: str, user: dict = Depends(get_current_user)):
    order = await _provider_order(order_id, user)
    order = await transition(order, sm.PROVIDER_EN_ROUTE)
    await NotificationService.notify(order["customer_id"], "Prestador a caminho",
                                     "Seu prestador está a caminho.", "order", {"order_id": order_id})
    return {"order": await order_public(order)}


@router.post("/{order_id}/start")
async def start_service(order_id: str, user: dict = Depends(get_current_user)):
    order = await _provider_order(order_id, user)
    order = await transition(order, sm.SERVICE_STARTED)
    await NotificationService.notify(order["customer_id"], "Serviço iniciado",
                                     "O serviço foi iniciado.", "order", {"order_id": order_id})
    return {"order": await order_public(order)}


@router.post("/{order_id}/complete")
async def complete_service(order_id: str, user: dict = Depends(get_current_user)):
    order = await _provider_order(order_id, user)
    order = await transition(order, sm.SERVICE_COMPLETED)
    await NotificationService.notify(order["customer_id"], "Serviço concluído",
                                     "O serviço foi concluído. Realize o pagamento.", "order",
                                     {"order_id": order_id})
    return {"order": await order_public(order)}
