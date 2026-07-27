# detectors.yaml 配置文件说明

`detectors.yaml` 位于 `models/` 目录下（容器内路径 `/app/models/detectors.yaml`，可用环境变量 `DETECTORS_CONFIG` 覆盖），用于声明后端提供哪些检测能力。后端启动时读取该文件并加载对应模型；**文件不存在时以零能力启动，不会报错**。

## 文件结构

```yaml
capabilities:
  - key: face                        # 能力唯一标识，作为 API 请求参数
    name: 人脸检测                    # 展示名称
    description: 检测图片中的人脸位置及关键点
    model: example-face.onnx         # models/ 目录下的模型文件名
    detector: face_detector          # 检测器类型（已注册的类型名）
    params:                          # 该检测器的运行参数，随类型而定
      conf_threshold: 0.5
      nms_threshold: 0.4
      input_size: 320
      tile_size: 640
      tile_overlap: 0.2
```

顶层只有一个 `capabilities` 列表，每个元素描述一项检测能力：

| 字段 | 必填 | 说明 |
|---|---|---|
| `key` | 是 | 能力唯一标识，检测接口通过它选择能力 |
| `name` | 否 | 展示名称，缺省为 `key` |
| `description` | 否 | 能力描述 |
| `model` | 是 | 模型文件名，相对 `MODELS_DIR`（默认 `models/`）解析 |
| `detector` | 是 | 检测器类型名，见下文「检测器类型」 |
| `params` | 否 | 参数字典，原样传给检测器，缺省为 `{}` |

同一 `detector` 类型可配置多个 `key`（例如两个不同权重的 YOLO 模型），只要 `key` 不重复即可。

## 检测器类型

后端本身不内置任何检测器实现，全部以插件形式放在 `models/detectors/` 目录下，启动时动态加载。

### 随项目提供的插件

**人脸检测插件**（`models/detectors/` 下，ONNX 静态输入，支持大图滑窗切片）

| 参数 | 默认值 | 说明 |
|---|---|---|
| `conf_threshold` | 0.5 | 置信度阈值 |
| `nms_threshold` | 0.4 | NMS IoU 阈值 |
| `input_size` | 320 | 模型输入边长（须与 ONNX 静态 shape 一致） |
| `tile_size` | 640 | 滑窗切片边长，详见 [滑动窗口切片检测](sliding-window-detection.md) |
| `tile_overlap` | 0.2 | 切片重叠比例 |

**`yolo_onnx`**（`models/detectors/yolo_onnx.py`）— 通用 YOLO ONNX 检测器（letterbox 预处理 + NMS）

| 参数 | 默认值 | 说明 |
|---|---|---|
| `conf_threshold` | 0.25 | 置信度阈值 |
| `nms_threshold` | 0.45 | NMS IoU 阈值 |
| `input_size` | 640 | 模型输入边长 |
| `labels` | `["target"]` | 类别名列表，索引对应模型输出 class id |

### 自定义插件

`models/detectors/` 目录下的每个 `.py` 文件（`_` 开头的会被忽略）在后端启动时被动态导入，通过 `@register` 注册新的检测器类型，无需修改后端代码：

```python
# models/detectors/my_detector.py
import numpy as np

from app.detectors.base import BaseDetector, Detection
from app.detectors.registry import register


@register("my_type")
class MyDetector(BaseDetector):
    def load(self) -> None:
        # 加载模型：self.context.model_path 为模型文件路径
        # self.params 为配置中的 params 字典
        ...

    def detect(self, image: np.ndarray) -> list[Detection]:
        # image 为 BGR 格式的 numpy 数组，返回 Detection 列表
        # Detection(box=[x1, y1, x2, y2], label="...", score=0.9)
        ...
```

然后在 `detectors.yaml` 中将 `detector` 设为 `my_type` 即可使用。

公共工具函数（如 NMS）在 `app.detectors.utils` 中，插件可直接 `from app.detectors.utils import nms` 复用。

## 新增模型完整流程

1. 将 `.onnx` 模型文件放入 `models/`。
2. 在 `models/detectors.yaml` 的 `capabilities` 中新增一项。
3. 若现有类型不满足需求，在 `models/detectors/` 新增插件 `.py` 注册新类型。
4. 重启后端生效：`docker compose restart backend`。

## 容错行为

启动加载过程中以下情况均**只记日志并跳过该能力**，不影响其他能力：

- 配置文件不存在（零能力启动）
- `detector` 类型未注册
- 模型文件不存在
- 模型文件是 Git LFS 指针（需先 `git lfs pull`）
- 模型加载抛异常
- 插件 `.py` 导入失败
