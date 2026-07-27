import type { Detection } from '../api'

export interface RenderContext {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  image: HTMLImageElement
  results: Record<string, Detection[]>
}

export interface Renderer {
  key: string
  name: string
  description?: string
  render(context: RenderContext): void
}

const registry = new Map<string, Renderer>()

export function registerRenderer(renderer: Renderer): void {
  registry.set(renderer.key, renderer)
}

export function getRenderers(): Renderer[] {
  return Array.from(registry.values())
}

export function getRenderer(key: string): Renderer | undefined {
  return registry.get(key)
}

export function drawBaseImage(context: RenderContext): void {
  const { canvas, ctx, image } = context
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  ctx.drawImage(image, 0, 0)
}

export function allDetections(results: Record<string, Detection[]>): Detection[] {
  return Object.values(results).flat()
}
