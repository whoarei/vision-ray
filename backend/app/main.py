from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .detectors.registry import DetectorManager, load_plugins

logging.basicConfig(level=logging.INFO)

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = os.getenv("MODELS_DIR", str(BASE_DIR.parent.parent / "models"))
CONFIG_PATH = os.getenv("DETECTORS_CONFIG", str(Path(MODELS_DIR) / "detectors.yaml"))

app = FastAPI(title="VisionRay", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
