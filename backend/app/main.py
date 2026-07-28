from __future__ import annotations

import logging
import os
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .detectors.registry import DetectorManager, load_plugins

logging.basicConfig(level=logging.INFO)

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = os.getenv("MODELS_DIR", str(BASE_DIR.parent.parent / "models"))
CONFIG_PATH = os.getenv("DETECTORS_CONFIG", str(Path(MODELS_DIR) / "detectors.yaml"))

LOG_DIR = Path(os.getenv("ACCESS_LOG_DIR", str(BASE_DIR.parent / "logs")))
LOG_DIR.mkdir(parents=True, exist_ok=True)

access_logger = logging.getLogger("visionray.access")
access_logger.setLevel(logging.INFO)
access_logger.addHandler(RotatingFileHandler(
    LOG_DIR / "access.log", maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8",
))
access_logger.propagate = False

app = FastAPI(title="VisionRay", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def access_log(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    client_ip = (
        request.headers.get("x-real-ip")
        or (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        or request.client.host
    )
    ua = request.headers.get("user-agent", "-")
    access_logger.info('%s %s %d %.1fms ip=%s ua="%s"',
        request.method, request.url.path, response.status_code, duration_ms, client_ip, ua)
    return response


app.include_router(router)


@app.on_event("startup")
def startup() -> None:
    load_plugins(Path(MODELS_DIR) / "detectors")
    manager = DetectorManager()
    manager.load_from_config(CONFIG_PATH, MODELS_DIR)
    app.state.detector_manager = manager


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}
