"""Business-rule engines: pricing, dynamic pricing, matching, commission.

These are pure(ish) functions over data so they can be tested without the API
or the database. All tunable parameters come from the service config or the
system settings document (editable by the admin), never hard-coded in the UI.
"""
import math
from typing import Any

from . import db


# ---------------------------------------------------------------------------
# CommissionService — platform cut, configurable (default 8%–15%).
# ---------------------------------------------------------------------------
class CommissionService:
    @staticmethod
    def compute(total: float, settings: dict) -> dict:
        cfg = settings.get("commission", {})
        rate = float(cfg.get("rate", 0.12))
        rate = max(float(cfg.get("min", 0.08)), min(float(cfg.get("max", 0.15)), rate))
        commission = round(total * rate, 2)
        payout = round(total - commission, 2)
        return {"rate": rate, "commission": commission, "payout": payout}


# ---------------------------------------------------------------------------
# DynamicPricingEngine — surge factor from supply/demand per region+category.
# ---------------------------------------------------------------------------
class DynamicPricingEngine:
    @staticmethod
    async def factor(category: str, region: str, settings: dict) -> dict:
        cfg = settings.get("dynamic_pricing", {})
        if not cfg.get("enabled", True):
            return {"factor": 1.0, "surge": False, "demand": 0, "supply": 0}

        min_f = float(cfg.get("min_factor", 1.0))
        max_f = float(cfg.get("max_factor", 1.8))
        step = float(cfg.get("step", 0.1))

        active_states = [
            "SEARCHING_PROVIDER", "PROVIDER_ASSIGNED", "PROVIDER_ACCEPTED",
            "PROVIDER_EN_ROUTE", "SERVICE_STARTED",
        ]
        demand = await db.orders.count_documents(
            {"service_category": category, "region": region, "status": {"$in": active_states}}
        )
        supply = await db.providers.count_documents(
            {"categories": category, "region": region, "is_online": True, "status": "VERIFICADO"}
        )

        # More demand than supply pushes the factor up gradually.
        ratio = demand / supply if supply > 0 else float(demand)
        factor = min_f + step * ratio
        factor = max(min_f, min(max_f, round(factor, 2)))
        return {
            "factor": factor,
            "surge": factor > min_f + 1e-9,
            "demand": demand,
            "supply": supply,
        }


# ---------------------------------------------------------------------------
# PricingEngine — per-service strategy. Returns a full transparent breakdown.
# ---------------------------------------------------------------------------
class PricingEngine:
    @staticmethod
    def _diarista(p: dict, params: dict) -> tuple[float, list[dict]]:
        lines: list[dict] = []
        base = float(p.get("base", 80))
        lines.append({"label": "Taxa base", "amount": base})
        rooms = int(params.get("rooms", 1) or 0)
        bathrooms = int(params.get("bathrooms", 1) or 0)
        room_cost = rooms * float(p.get("price_per_room", 25))
        bath_cost = bathrooms * float(p.get("price_per_bathroom", 20))
        if room_cost:
            lines.append({"label": f"Cômodos ({rooms})", "amount": round(room_cost, 2)})
        if bath_cost:
            lines.append({"label": f"Banheiros ({bathrooms})", "amount": round(bath_cost, 2)})
        subtotal = base + room_cost + bath_cost

        size = params.get("size", "medium")
        size_mult = float(p.get("size_multiplier", {}).get(size, 1.0))
        diff = params.get("difficulty", "normal")
        diff_mult = float(p.get("difficulty_multiplier", {}).get(diff, 1.0))
        mult = size_mult * diff_mult
        if abs(mult - 1.0) > 1e-9:
            adj = round(subtotal * (mult - 1.0), 2)
            lines.append({"label": "Tamanho/Dificuldade", "amount": adj})
            subtotal *= mult

        addon_price = p.get("addon_price", {})
        for a in params.get("addons", []) or []:
            price = float(addon_price.get(a, 0))
            if price:
                lines.append({"label": f"Adicional: {a}", "amount": price})
                subtotal += price
        return round(subtotal, 2), lines

    @staticmethod
    def _visit_based(p: dict, params: dict) -> tuple[float, list[dict]]:
        lines: list[dict] = []
        base = float(p.get("base", 90))
        visit = float(p.get("visit_fee", 50))
        lines.append({"label": "Taxa base", "amount": base})
        lines.append({"label": "Taxa de visita", "amount": visit})
        subtotal = base + visit

        points = int(params.get("points", 0) or 0)
        if points:
            pc = points * float(p.get("price_per_point", 15))
            lines.append({"label": f"Pontos ({points})", "amount": round(pc, 2)})
            subtotal += pc

        problem = params.get("problem_type", "repair")
        prob_mult = float(p.get("problem_multiplier", {}).get(problem, 1.0))
        urgency = params.get("urgency", "normal")
        urg_mult = float(p.get("urgency_multiplier", {}).get(urgency, 1.0))
        mult = prob_mult * urg_mult
        if abs(mult - 1.0) > 1e-9:
            adj = round(subtotal * (mult - 1.0), 2)
            lines.append({"label": "Complexidade/Urgência", "amount": adj})
            subtotal *= mult
        return round(subtotal, 2), lines

    @classmethod
    def quote(cls, service: dict, params: dict, distance_km: float, surge: dict, settings: dict) -> dict:
        p = service.get("pricing_parameters", {})
        strategy = service.get("pricing_strategy", "diarista")
        if strategy == "diarista":
            subtotal, lines = cls._diarista(p, params)
        else:
            subtotal, lines = cls._visit_based(p, params)

        # Distance fee
        price_per_km = float(settings.get("price_per_km", 2.5))
        distance_fee = round(distance_km * price_per_km, 2)
        if distance_fee:
            lines.append({"label": f"Deslocamento ({distance_km:.1f} km)", "amount": distance_fee})

        pre_surge = subtotal + distance_fee
        factor = float(surge.get("factor", 1.0))
        surge_amount = round(pre_surge * (factor - 1.0), 2)
        if surge_amount > 0:
            lines.append({"label": f"Alta demanda (x{factor})", "amount": surge_amount})

        total = round(pre_surge + surge_amount, 2)
        comm = CommissionService.compute(total, settings)
        return {
            "breakdown": lines,
            "subtotal": round(subtotal, 2),
            "distance_fee": distance_fee,
            "surge_factor": factor,
            "surge": surge.get("surge", False),
            "total": total,
            "commission_rate": comm["rate"],
            "commission": comm["commission"],
            "provider_payout": comm["payout"],
            "currency": "BRL",
        }


# ---------------------------------------------------------------------------
# MatchingEngine — scores compatible providers and expands the search radius.
# ---------------------------------------------------------------------------
def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


class MatchingEngine:
    @staticmethod
    async def find_candidates(order: dict, settings: dict, radius_km: float) -> list[dict]:
        cfg = settings.get("matching", {})
        weights = cfg.get(
            "weights",
            {"category": 40, "online": 20, "verified": 15, "proximity": 20, "rating": 5},
        )
        category = order["service_category"]
        region = order.get("region", "curitiba")
        loc = order.get("location") or {}
        olat, olng = loc.get("lat"), loc.get("lng")

        query = {
            "categories": category,
            "region": region,
            "status": "VERIFICADO",
            "is_online": True,
        }
        cursor = db.providers.find(query, {"_id": 0})
        candidates = []
        async for prov in cursor:
            score = 0.0
            score += weights["category"]
            score += weights["online"]
            score += weights["verified"]
            distance = None
            ploc = prov.get("current_location") or {}
            if olat is not None and ploc.get("lat") is not None:
                distance = haversine_km(olat, olng, ploc["lat"], ploc["lng"])
                if distance > radius_km or distance > prov.get("radius_km", 10):
                    continue
                score += weights["proximity"] * max(0.0, 1.0 - distance / max(radius_km, 1))
            rating = float(prov.get("rating_avg", 0) or 0)
            score += weights["rating"] * (rating / 5.0)
            candidates.append({
                "provider_id": prov["user_id"],
                "score": round(score, 2),
                "distance_km": distance,
                "rating_avg": rating,
            })
        candidates.sort(key=lambda c: c["score"], reverse=True)
        return candidates
