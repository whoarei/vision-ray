from __future__ import annotations

import importlib.util
import logging
from pathlib import Path
from typing import Any, Callable

import yaml

from .base import BaseDetector, DetectorContext

logger = logging.getLogger(__name__)

_REGISTRY: dict[str, type[BaseDetector]] = {}


def register(detector_type: str) -> Callable[[type[BaseDetector]], type[BaseDetector]]:
    def decorator(cls: type[BaseDetector]) -> type[BaseDetector]:
        _REGISTRY[detector_type] = cls
        return cls

    return decorator


def detector_types() -> list[str]:
    return sorted(_REGISTRY.keys())


def load_plugins(plugin_dir: str | Path) -> None:
    """动态加载插件目录下的检测器（.py 文件通过 @register 注册类型）。"""
    plugin_dir = Path(plugin_dir)
    if not plugin_dir.is_dir():
        return
    for py_file in sorted(plugin_dir.glob("*.py")):
        if py_file.name.startswith("_"):
            continue
        try:
            spec = importlib.util.spec_from_file_location(
                f"visionray_plugin_{py_file.stem}", py_file
            )
            if spec is None or spec.loader is None:
                raise ImportError(f"无法为插件创建模块 spec: {py_file}")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            logger.info("已加载检测器插件: %s", py_file)
        except Exception:
            logger.exception("检测器插件加载失败: %s，已跳过", py_file)


def _is_lfs_pointer(path: Path) -> bool:
    try:
        if path.stat().st_size > 1024:
            return False
        with open(path, "rb") as f:
            return f.read(64).startswith(b"version https://git-lfs")
    except OSError:
        return False


class DetectorManager:
    def __init__(self) -> None:
        self._detectors: dict[str, BaseDetector] = {}
        self._meta: dict[str, dict[str, Any]] = {}

    def load_from_config(self, config_path: str | Path, models_dir: str | Path) -> None:
        config_path = Path(config_path)
        if not config_path.is_file():
            logger.warning("检测器配置文件不存在: %s，以零能力启动", config_path)
            return
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}

        models_dir = Path(models_dir)
        for cap in config.get("capabilities", []):
            key = cap["key"]
            detector_type = cap["detector"]
            if detector_type not in _REGISTRY:
                logger.error(
                    "功能 '%s' 的检测器类型 '%s' 未注册，可用类型: %s，已跳过",
                    key,
                    detector_type,
                    detector_types(),
                )
                continue
            model_path = models_dir / cap["model"]
            if not model_path.exists():
                logger.warning("功能 '%s' 的模型文件不存在: %s，已跳过", key, model_path)
                continue
            if _is_lfs_pointer(model_path):
                logger.error(
                    "功能 '%s' 的模型文件是 Git LFS 指针，并非真实模型: %s。"
                    "请先执行 git lfs pull 拉取模型文件，已跳过",
                    key,
                    model_path,
                )
                continue
            detector = _REGISTRY[detector_type](
                DetectorContext(model_path=str(model_path), params=cap.get("params", {}))
            )
            try:
                detector.load()
            except Exception:
                logger.exception("功能 '%s' 的模型加载失败: %s，已跳过", key, model_path)
                continue
            self._detectors[key] = detector
            self._meta[key] = {
                "key": key,
                "name": cap.get("name", key),
                "description": cap.get("description", ""),
            }
            logger.info("已加载功能 '%s' (%s)", key, detector_type)

    def capabilities(self) -> list[dict[str, Any]]:
        return list(self._meta.values())

    def get(self, key: str) -> BaseDetector | None:
        return self._detectors.get(key)

    def available_keys(self) -> list[str]:
        return list(self._detectors.keys())
