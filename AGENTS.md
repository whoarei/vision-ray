# AGENTS.md

## 项目概览

VisionRay：图片目标检测系统。`backend/`（FastAPI + onnxruntime，Python）、`frontend/`（Vue3 + Vite + TS）、`docker-compose.yml` 两服务部署。模型文件在 `models/`，由 **Git LFS** 管理。

## 常用命令

```bash
# 后端本地运行（Windows）
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
$env:MODELS_DIR="..\models"   # 可选，默认已指向仓库根 models/；配置与插件也在其中
uvicorn app.main:app --port 8000

# 前端
cd frontend
npm install
npm run build          # 含 vue-tsc 类型检查，即 lint/typecheck 步骤
npm run dev            # 端口 3000（勿改 5173/5273，本机 Windows 端口排除段占用），代理 /api → 8000

# E2E 测试（前置：docker compose 部署在 8088 运行 + npx playwright install chromium）
npm run test:e2e       # PLAYWRIGHT_BASE_URL 可覆盖目标地址

# 部署
docker compose up -d --build   # 前端映射 8088（本机 8080 被 WSL 内 Traefik 占用）
```

## 架构要点（扩展入口）

- **新增检测模型**：模型文件放 `models/` + `models/detectors.yaml` 加一条配置即可，无需改代码，重启后端生效。配置结构见 `docs/detectors-config.md`。
- **新增检测器类型**：在 `models/detectors/` 新增插件 `.py`，继承 `backend/app/detectors/base.py` 的 `BaseDetector` 并用 `@register("类型名")` 装饰，启动时自动加载，无需改后端代码（插件内从 `app.detectors.base` / `app.detectors.registry` / `app.detectors.utils` 导入）。后端无任何内置检测器，yolo_onnx 等也是 `models/detectors/` 下的插件。
- **新增前端展示方式**：在 `frontend/src/renderers/` 实现 `Renderer` 接口并 `registerRenderer()`，在 `index.ts` 导入；UI 自动出现选项。默认展示方式在 `App.vue` 中优先匹配 `mosaic`。
- 检测框/马赛克全部在**前端 Canvas 绘制**，后端只返回 JSON（原图坐标系的 box/score/landmarks）。

## 易踩的坑

- **Git LFS**：clone 后必须 `git lfs pull`。模型文件若是 ~133B 的指针文件，后端启动会崩溃重启（`INVALID_PROTOBUF`）。`registry.py` 已做防护：加载失败只跳过该功能并记日志。
- **人脸检测大图**：模型输入固定 320×320，大图走滑窗切片（`tile_size`/`tile_overlap`，见 `docs/sliding-window-detection.md`）；改输入尺寸时先确认 ONNX 是静态 shape。
- **前端布局**：grid/flex 子项必须显式 `min-width: 0`，否则大 canvas/长缩略图条会撑出页面横向滚动（有 Playwright 回归用例守着）。
- 后端日志中文在 Windows GBK 控制台显示乱码是正常的，文件本身是 UTF-8。

## 工作流约定

- 提交信息用中文，格式 `type: 描述`（feat/fix/docs/test/chore）。
- 前端改动验证顺序：`npm run build`（vue-tsc）→ `docker compose up -d --build frontend` → `npm run test:e2e`。
- 后端检测器改动可用 venv 直接实例化 `DetectorManager` 做冒烟测试，参考 `backend/app/detectors/registry.py` 的用法。
