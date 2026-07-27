from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class Detection:
    box: list[float]
    label: str
    score: float
    landmarks: list[list[float]] | None = None


@dataclass
class DetectorContext:
    model_path: str
    params: dict[str, Any] = field(default_factory=dict)


class BaseDetector(ABC):
    def __init__(self, context: DetectorContext) -> None:
        self.context = context
        self.params = context.params

    @abstractmethod
    def load(self) -> None: ...

    @abstractmethod
    def detect(self, image: np.ndarray) -> list[Detection]: ...
