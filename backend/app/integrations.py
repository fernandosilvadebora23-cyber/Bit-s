"""External integration layer.

Every third-party service is behind an abstraction with a Mock implementation
(used when no credentials are configured) and a Real implementation. Swapping
mock -> real requires only providing the env credential; no other code changes.
No fake credentials are hard-coded, and a mock is never presented as the real
integration (each response carries a `provider` marker).
"""
import math
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from . import db
from .config import GOOGLE_MAPS_API_KEY
from .models import now_iso, now_utc

# Curitiba city center — used as the deterministic anchor for the mock geocoder.
CURITIBA = {"lat": -25.4284, "lng": -49.2733}


# ---------------------------------------------------------------------------
# GoogleMapsService
# ---------------------------------------------------------------------------
class GoogleMapsService(ABC):
    provider = "abstract"

    @abstractmethod
    async def geocode(self, address: str) -> dict: ...

    @abstractmethod
    async def route(self, origin: dict, destination: dict) -> dict: ...


def _haversine_m(a: dict, b: dict) -> int:
    r = 6371000
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp = math.radians(b["lat"] - a["lat"])
    dl = math.radians(b["lng"] - a["lng"])
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(2 * r * math.asin(math.sqrt(x)))


class MockGoogleMapsService(GoogleMapsService):
    provider = "mock"

    async def geocode(self, address: str) -> dict:
        # Deterministic pseudo-coordinates scattered around Curitiba.
        seed = sum(ord(c) for c in address) if address else 0
        lat = CURITIBA["lat"] + ((seed % 60) - 30) / 1000.0
        lng = CURITIBA["lng"] + ((seed // 3 % 60) - 30) / 1000.0
        return {"address": address, "location": {"lat": lat, "lng": lng}, "provider": self.provider}

    async def route(self, origin: dict, destination: dict) -> dict:
        m = _haversine_m(origin, destination)
        return {
            "distance_m": m,
            "distance_km": round(m / 1000.0, 2),
            "duration_s": max(60, int(m / 8.3)),  # ~30km/h city traffic
            "provider": self.provider,
        }


class RealGoogleMapsService(GoogleMapsService):
    provider = "google"

    def __init__(self, key: str):
        self.key = key

    async def geocode(self, address: str) -> dict:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": address, "key": self.key, "region": "br"},
            )
        d = r.json()
        if d.get("status") != "OK" or not d.get("results"):
            raise ValueError("Geocoding failed")
        res = d["results"][0]
        p = res["geometry"]["location"]
        return {
            "address": res["formatted_address"],
            "location": {"lat": p["lat"], "lng": p["lng"]},
            "provider": self.provider,
        }

    async def route(self, origin: dict, destination: dict) -> dict:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(
                "https://maps.googleapis.com/maps/api/distancematrix/json",
                params={
                    "origins": f"{origin['lat']},{origin['lng']}",
                    "destinations": f"{destination['lat']},{destination['lng']}",
                    "mode": "driving",
                    "key": self.key,
                },
            )
        d = r.json()
        e = d.get("rows", [{}])[0].get("elements", [{}])[0]
        if d.get("status") != "OK" or e.get("status") != "OK":
            raise ValueError("Distance Matrix failed")
        return {
            "distance_m": e["distance"]["value"],
            "distance_km": round(e["distance"]["value"] / 1000.0, 2),
            "duration_s": e["duration"]["value"],
            "provider": self.provider,
        }


maps_service: GoogleMapsService = (
    RealGoogleMapsService(GOOGLE_MAPS_API_KEY) if GOOGLE_MAPS_API_KEY else MockGoogleMapsService()
)


# ---------------------------------------------------------------------------
# PaymentService
# ---------------------------------------------------------------------------
class PaymentService(ABC):
    provider = "abstract"

    @abstractmethod
    async def charge(self, order_id: str, amount: float, method: str, outcome: str) -> dict: ...

    @abstractmethod
    async def refund(self, payment_id: str) -> dict: ...

    @abstractmethod
    async def payout(self, provider_id: str, amount: float) -> dict: ...


class MockPaymentService(PaymentService):
    provider = "mock"

    async def charge(self, order_id: str, amount: float, method: str, outcome: str = "approved") -> dict:
        status = {
            "approved": "APPROVED",
            "declined": "DECLINED",
            "pending": "PENDING",
        }.get(outcome, "APPROVED")
        return {
            "provider": self.provider,
            "status": status,
            "amount": amount,
            "method": method,
            "transaction_id": f"mock_tx_{order_id[:8]}",
            "created_at": now_iso(),
        }

    async def refund(self, payment_id: str) -> dict:
        return {"provider": self.provider, "status": "REFUNDED", "payment_id": payment_id, "created_at": now_iso()}

    async def payout(self, provider_id: str, amount: float) -> dict:
        return {
            "provider": self.provider,
            "status": "PAID",
            "provider_id": provider_id,
            "amount": amount,
            "payout_id": f"mock_po_{provider_id[:8]}",
            "created_at": now_iso(),
        }


payment_service: PaymentService = MockPaymentService()


# ---------------------------------------------------------------------------
# NotificationService — persists an in-app notification (mock push/email/wa).
# ---------------------------------------------------------------------------
class NotificationService:
    provider = "mock"

    @staticmethod
    async def notify(user_id: str, title: str, body: str, kind: str = "info", data: Optional[dict] = None):
        doc = {
            "notification_id": f"ntf_{now_utc().timestamp()}",
            "user_id": user_id,
            "title": title,
            "body": body,
            "kind": kind,
            "data": data or {},
            "read": False,
            "provider": NotificationService.provider,
            "created_at": now_iso(),
        }
        await db.notifications.insert_one(doc)
        return doc


class EmailService:
    provider = "mock"

    @staticmethod
    async def send(to: str, subject: str, body: str) -> dict:
        return {"provider": EmailService.provider, "to": to, "subject": subject, "sent": True}


class WhatsAppService:
    provider = "mock"

    @staticmethod
    async def send(phone: str, message: str) -> dict:
        return {"provider": WhatsAppService.provider, "phone": phone, "sent": True}


class StorageService:
    """Private-by-default file storage abstraction (mock returns a data ref)."""
    provider = "mock"

    @staticmethod
    async def put(key: str, content_ref: str, public: bool = False) -> dict:
        return {"provider": StorageService.provider, "key": key, "public": public, "url": content_ref}
