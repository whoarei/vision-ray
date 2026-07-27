import {
  allDetections,
  drawBaseImage,
  registerRenderer,
  type RenderContext,
} from './types'

const COLORS = ['#00e676', '#ffab00', '#40c4ff', '#ff5252', '#e040fb', '#18ffff']

function render(context: RenderContext): void {
  const { ctx } = context
  drawBaseImage(context)

  const entries = Object.entries(context.results)
  entries.forEach(([, detections], featureIndex) => {
    const color = COLORS[featureIndex % COLORS.length]
    for (const det of detections) {
      const [x1, y1, x2, y2] = det.box
      const w = x2 - x1
      const h = y2 - y1

      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(2, Math.round(context.canvas.width / 400))
      ctx.strokeRect(x1, y1, w, h)

      const text = `${det.label} ${(det.score * 100).toFixed(1)}%`
      const fontSize = Math.max(14, Math.round(context.canvas.width / 45))
      ctx.font = `bold ${fontSize}px sans-serif`
      const metrics = ctx.measureText(text)
      const textH = fontSize + 8
      const textW = metrics.width + 12
      const textY = y1 - textH >= 0 ? y1 - textH : y1

      ctx.fillStyle = color
      ctx.fillRect(x1, textY, textW, textH)
      ctx.fillStyle = '#000'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x1 + 6, textY + textH / 2)

      if (det.landmarks) {
        ctx.fillStyle = '#fff'
        for (const [lx, ly] of det.landmarks) {
          ctx.beginPath()
          ctx.arc(lx, ly, Math.max(2, context.canvas.width / 250), 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  })
}

registerRenderer({
  key: 'box_label',
  name: '检测框 + 文字说明',
  description: '在原图上叠加检测框、类别与置信度',
  render,
})

export { allDetections }
