# VisionRay

基于 FastAPI + Vue3 的图片目标检测系统，支持多种检测模型，使用 Docker Compose 一键部署。

## 功能特性

- **人脸检测**：输出人脸框 + 5 个关键点
- **车牌检测**：基于 YOLOv8 微调模型（ONNX）
- **功能多选**：可同时勾选多个检测功能
- **多种展示方式**：检测框 + 文字说明 / 马赛克，可扩展
- **插件化架构**：后端检测器与前端渲染器均可独立扩展

## 快速开始

### Docker Compose 部署（推荐）

```bash
docker compose up --build -d
```

访问 http://localhost:8088

### 本地开发

后端：

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
set MODELS_DIR=..\models      # Windows: set；Linux: export
uvicorn app.main:app --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000，已代理 /api 到 8000
```

## 项目结构

```
VisionRay/
├── docker-compose.yml
├── models/                       # 模型与配置（不纳入版本控制）
│   ├── detectors.yaml            # 检测功能配置
│   └── detectors/                # 检测器插件
├── backend/                      # FastAPI 后端
│   ├── app/api/routes.py         # API 路由
│   └── app/detectors/            # 检测器框架
│       ├── base.py               # BaseDetector 抽象基类
│       ├── registry.py           # 注册表 + 插件/配置加载
│       └── utils.py              # 公共工具（NMS 等）
└── frontend/                     # Vue3 + Vite 前端
    └── src/renderers/            # 渲染器插件
        ├── boxLabel.ts           # 检测框 + 文字说明
        └── mosaic.ts             # 马赛克
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/capabilities` | 获取可用检测功能列表 |
| POST | `/api/detect` | 上传图片进行检测（multipart: `file` 图片，`features` 逗号分隔的功能 key） |

响应示例：

```json
{
  "width": 512,
  "height": 512,
  "results": {
    "face": [
      { "box": [210, 178, 356, 397], "label": "人脸", "score": 0.999, "landmarks": [[267, 262]] }
    ]
  }
}
```

## 扩展指南

### 新增检测模型

1. 将模型文件放入 `models/` 目录
2. 在 `models/detectors.yaml` 添加配置：

```yaml
capabilities:
  - key: my_feature
    name: 我的检测
    description: 功能描述
    model: my-model.onnx
    detector: yolo_onnx        # 复用已有检测器类型
    params:
      conf_threshold: 0.25
      nms_threshold: 0.45
      input_size: 640
      labels: ["目标"]
```

### 新增检测器类型（自定义处理逻辑）

在 `models/detectors/` 下新增插件 `.py`，继承 `BaseDetector` 并用 `@register` 注册，启动时自动加载：

```python
# models/detectors/my_detector.py
from app.detectors.base import BaseDetector, Detection
from app.detectors.registry import register

@register("my_detector")
class MyDetector(BaseDetector):
    def load(self) -> None:
        ...

    def detect(self, image) -> list[Detection]:
        ...
```

即可在 `models/detectors.yaml` 中通过 `detector: my_detector` 引用。

### 新增前端展示方式

实现 `Renderer` 接口并注册，UI 自动出现新选项：

```typescript
// frontend/src/renderers/myRenderer.ts
import { drawBaseImage, registerRenderer } from './types'

registerRenderer({
  key: 'my_renderer',
  name: '我的展示方式',
  render(context) {
    drawBaseImage(context)
    // 自定义绘制逻辑
  },
})
```

并在 `renderers/index.ts` 中导入。

## License

[MIT](LICENSE)
