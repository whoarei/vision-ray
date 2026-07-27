import {
  allDetections,
  drawBaseImage,
  registerRenderer,
  type RenderContext,
} from './types'

const MOSAIC_TARGET_HEIGHT = 5

function pixelateRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (w <= 0 || h <= 0) return
  const sh = MOSAIC_TARGET_HEIGHT
  const sw = Math.max(1, Math.round((w / h) * sh))

  const tmp = document.createElement('canvas')
  tmp.width = sw
  tmp.height = sh
  const tctx = tmp.getContext('2d')!
  tctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h)
  ctx.imageSmoothingEnabled = true
}

function render(context: RenderContext): void {
  const { ctx, canvas } = context
  drawBaseImage(context)

  for (const det of allDetections(context.results)) {
    const [x1, y1, x2, y2] = det.box
    const x = Math.max(0, Math.round(x1))
    const y = Math.max(0, Math.round(y1))
    const w = Math.min(canvas.width - x, Math.round(x2 - x1))
    const h = Math.min(canvas.height - y, Math.round(y2 - y1))
    pixelateRegion(ctx, x, y, w, h)
  }
}

registerRenderer({
  key: 'mosaic',
  name: '马赛克',
  description: '对检测到的目标区域进行马赛克处理',
  render,
})
