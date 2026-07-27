# 马赛克打码原理与实现

## 1. 概述

VisionRay 的马赛克处理**完全在前端 Canvas 完成**，后端只返回检测框 JSON（原图坐标系），不输出处理后的图片。渲染器实现在 `frontend/src/renderers/mosaic.ts`。

## 2. 算法原理：缩小到固定尺寸 → 无平滑放大

经典像素化（pixelate）算法，两步。与常见"固定块边长"做法不同，VisionRay 将区域**缩小到固定高度 5 像素**（宽度按宽高比等比缩放），块数与区域大小无关，打码强度对所有目标一致：

```
检测框区域 (w × h)
   │  ① 缩小：drawImage 到临时 canvas，尺寸 (w/h*5) × 5
   ▼
临时 canvas (sw × 5)    ← 无论区域多大，纵向只剩 5 个像素
   │  ② 放大：关闭平滑后 drawImage 回主 canvas 原位 (w × h)
   ▼
硬边像素块效果
```

### 2.1 第一步：缩小

```ts
const sh = MOSAIC_TARGET_HEIGHT                       // 5
const sw = Math.max(1, Math.round((w / h) * sh))      // 宽度保持宽高比
tmp.width = sw; tmp.height = sh
tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh)
```

把框内区域从主 canvas 复制到高度固定为 5、宽度按宽高比等比缩小的临时 canvas。浏览器默认开启图像平滑（双线性/双三次插值），缩小时大量相邻像素被混合为 1 个像素，实现信息丢弃。

### 2.2 第二步：无平滑放大

```ts
ctx.imageSmoothingEnabled = false
ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h)
ctx.imageSmoothingEnabled = true
```

**关键**：放大前必须设 `imageSmoothingEnabled = false`。此时浏览器采用最近邻采样，每个缩小后的像素原样扩展为 12×12 的方块，形成边缘锐利的"马赛克块"。若开启平滑，放大时会插值模糊，变成磨砂效果而非像素块。

放大完恢复 `imageSmoothingEnabled = true`，避免影响后续绘制。

## 3. 关键参数与细节

| 参数 | 值 | 说明 |
|---|---|---|
| `MOSAIC_TARGET_HEIGHT` | 5 | 缩小后的目标高度（像素）。宽度按 `round(w/h*5)` 等比得出，保持宽高比；最小 1，防止极端窄条算出 0 |

- **坐标处理**：检测框坐标为浮点数，先 `Math.round` 取整；左上角 `Math.max(0, ...)`、宽高用 `Math.min(canvas.width - x, ...)` 裁剪，防止框越界时 `drawImage` 报错。
- **作用范围**：遍历 `allDetections(context.results)` 的所有检测框逐个打码，与检测器类型无关。
- **数据源**：从已绘制原图的主 canvas 上取像素（`ctx.canvas` 作为 `drawImage` 源），无需额外加载图片。

## 4. 特点与局限

**特点**：
- 不可逆性来自信息压缩（任意 w×h → 高度仅 5px），无密钥可还原；
- **打码强度与区域大小无关**：小脸和大车身统一压到纵向 5px，不会出现小目标过度模糊或大目标残留轮廓的问题；
- 实现简单，纯 Canvas 2D API，零依赖。

**局限**：
- 无模糊/噪声叠加，理论上对马赛克块的统计分析攻击（如 DePixelize 类方法）不设防；
- 马赛克块大小随区域尺寸变化（区域越大块越大），视觉上不均匀；
- 缩小网格从区域左上角起算，未对齐到全局像素网格，多次渲染同一区域结果一致，但不同位置的相同内容块相位不同。
