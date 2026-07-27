from __future__ import annotations

import io

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from ..schemas import Capability, DetectResponse, to_out

router = APIRouter(prefix="/api")

MAX_IMAGE_BYTES = 20 * 1024 * 1024


@router.get("/capabilities", response_model=list[Capability])
def capabilities(request: Request) -> list[dict]:
    return request.app.state.detector_manager.capabilities()


@router.post("/detect", response_model=DetectResponse)
async def detect(
    request: Request,
    file: UploadFile = File(...),
    features: str = Form(...),
) -> DetectResponse:
    manager = request.app.state.detector_manager
    requested = [f.strip() for f in features.split(",") if f.strip()]
    if not requested:
        raise HTTPException(status_code=400, detail="未选择任何检测功能")

    unknown = [f for f in requested if manager.get(f) is None]
    if unknown:
        raise HTTPException(status_code=400, detail=f"不支持的检测功能: {unknown}")

    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="图片大小超过 20MB 限制")

    buffer = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="无法解析图片文件")

    height, width = image.shape[:2]
    results = {}
    for key in requested:
        detector = manager.get(key)
        detections = detector.detect(image)
        results[key] = [to_out(d) for d in detections]

    return DetectResponse(width=width, height=height, results=results)
