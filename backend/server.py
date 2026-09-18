"""Bit-s API entry point.

Layered architecture:
  routers (API) -> order_service / engines (business rules)
  -> db (persistence) / integrations (external services, mock or real)
"""
import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from pathlib import Path
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from app.db import create_indexes  # noqa: E402
from app.seed import seed  # noqa: E402
from app.routers import admin, auth, catalog, orders, provider  # noqa: E402

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("bits")

app = FastAPI(title="Bit-s API")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(orders.router)
app.include_router(provider.router)
app.include_router(admin.router)


@app.get("/api/")
async def root():
    return {"app": "Bit-s", "status": "ok"}


@app.get("/api/health")
async def health():
    from app.integrations import maps_service, payment_service
    return {"status": "ok", "maps_provider": maps_service.provider,
            "payment_provider": payment_service.provider}


@app.on_event("startup")
async def on_startup():
    try:
        await create_indexes()
        await seed()
        logger.info("Bit-s startup complete: indexes + seed ready")
    except Exception as e:  # pragma: no cover
        logger.exception("Startup error: %s", e)
