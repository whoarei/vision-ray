from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class Capability(BaseModel):
    key: str
    name: str
    description: str = ""


class DetectionOut(BaseModel):
    box: list[float]
    label: str
    score: float
    landmarks: list[list[float]] | None = None


class DetectResponse(BaseModel):
    width: int
    height: int
    results: dict[str, list[DetectionOut]]


def to_out(detection: Any) -> DetectionOut:
    return DetectionOut(
        box=detection.box,
        label=detection.label,
        score=detection.score,
        landmarks=detection.landmarks,
    )
