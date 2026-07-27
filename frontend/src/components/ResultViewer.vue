<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { DetectResponse } from '../api'
import { getRenderer, type RenderContext } from '../renderers'

const props = defineProps<{
  imageUrl: string | null
  result: DetectResponse | null
  rendererKey: string
}>()

const originalCanvas = ref<HTMLCanvasElement | null>(null)
const resultCanvas = ref<HTMLCanvasElement | null>(null)
const originalViewport = ref<HTMLDivElement | null>(null)
const resultViewport = ref<HTMLDivElement | null>(null)
const image = ref<HTMLImageElement | null>(null)

const scale = ref(1)
const offset = reactive({ x: 0, y: 0 })
const dragging = ref(false)

const transform = computed(
  () => `translate(${offset.x}px, ${offset.y}px) scale(${scale.value})`
)

function clampScale(s: number) {
  return Math.min(20, Math.max(0.05, s))
}

function resetView() {
  const img = image.value
  const vp = originalViewport.value
  if (!img || !vp) return
  const fit = Math.min(
    vp.clientWidth / img.naturalWidth,
    vp.clientHeight / img.naturalHeight,
    1
  )
  scale.value = fit
  offset.x = (vp.clientWidth - img.naturalWidth * fit) / 2
  offset.y = (vp.clientHeight - img.naturalHeight * fit) / 2
}

function applyZoomAt(next: number, px: number, py: number) {
  const clamped = clampScale(next)
  const ratio = clamped / scale.value
  offset.x = px - (px - offset.x) * ratio
  offset.y = py - (py - offset.y) * ratio
  scale.value = clamped
}

function onWheel(e: WheelEvent) {
  if (!image.value) return
  const vp = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
  applyZoomAt(
    scale.value * Math.pow(1.0015, -e.deltaY),
    e.clientX - vp.left,
    e.clientY - vp.top
  )
}

let dragStart: { px: number; py: number; ox: number; oy: number } | null = null

const activePointers = new Map<number, { x: number; y: number }>()
let lastPinchDist: number | null = null

function pinchInfo(vp: HTMLDivElement) {
  const [a, b] = [...activePointers.values()]
  const rect = vp.getBoundingClientRect()
  return {
    dist: Math.hypot(a.x - b.x, a.y - b.y),
    midX: (a.x + b.x) / 2 - rect.left,
    midY: (a.y + b.y) / 2 - rect.top,
  }
}

function onPointerDown(e: PointerEvent) {
  if (!image.value) return
  ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (activePointers.size === 2) {
    dragStart = null
    dragging.value = false
    lastPinchDist = pinchInfo(e.currentTarget as HTMLDivElement).dist
    return
  }
  dragStart = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
  dragging.value = true
}

function onPointerMove(e: PointerEvent) {
  const point = activePointers.get(e.pointerId)
  if (!point) return
  point.x = e.clientX
  point.y = e.clientY
  if (activePointers.size === 2) {
    const { dist, midX, midY } = pinchInfo(e.currentTarget as HTMLDivElement)
    if (lastPinchDist && lastPinchDist > 0) {
      applyZoomAt((scale.value * dist) / lastPinchDist, midX, midY)
    }
    lastPinchDist = dist
    return
  }
  if (!dragStart) return
  offset.x = dragStart.ox + (e.clientX - dragStart.px)
  offset.y = dragStart.oy + (e.clientY - dragStart.py)
}

function onPointerUp(e: PointerEvent) {
  activePointers.delete(e.pointerId)
  lastPinchDist = null
  if (activePointers.size === 1) {
    const [remaining] = [...activePointers.values()]
    dragStart = { px: remaining.x, py: remaining.y, ox: offset.x, oy: offset.y }
    dragging.value = true
    return
  }
  if (activePointers.size === 0) {
    dragStart = null
    dragging.value = false
  }
}

function redraw() {
  if (!props.imageUrl || !originalCanvas.value || !resultCanvas.value) return

  const img = new Image()
  img.onload = () => {
    image.value = img
    const orig = originalCanvas.value!
    orig.width = img.naturalWidth
    orig.height = img.naturalHeight
    orig.getContext('2d')!.drawImage(img, 0, 0)

    const canvas = resultCanvas.value!
    const ctx = canvas.getContext('2d')!
    if (props.result) {
      const renderer = getRenderer(props.rendererKey)
      if (renderer) {
        const context: RenderContext = {
          canvas,
          ctx,
          image: img,
          results: props.result.results,
        }
        renderer.render(context)
        resetView()
        return
      }
    }
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)
    resetView()
  }
  img.src = props.imageUrl
}

function renderOverlay() {
  const img = image.value
  const canvas = resultCanvas.value
  if (!img || !canvas) return
  const ctx = canvas.getContext('2d')!
  if (props.result) {
    const renderer = getRenderer(props.rendererKey)
    if (renderer) {
      const context: RenderContext = {
        canvas,
        ctx,
        image: img,
        results: props.result.results,
      }
      renderer.render(context)
      return
    }
  }
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx.drawImage(img, 0, 0)
}

function onResize() {
  resetView()
}

watch(() => props.imageUrl, redraw)
watch(() => [props.result, props.rendererKey], renderOverlay)
onMounted(() => {
  redraw()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="result-viewer">
    <div class="pane">
      <div class="pane-title">原图</div>
      <div
        ref="originalViewport"
        class="pane-viewport"
        :class="{ dragging }"
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <canvas
          ref="originalCanvas"
          class="pane-canvas"
          :style="{ transform }"
        ></canvas>
      </div>
    </div>
    <div class="pane">
      <div class="pane-title">检测结果</div>
      <div
        ref="resultViewport"
        class="pane-viewport"
        :class="{ dragging }"
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <canvas
          ref="resultCanvas"
          class="pane-canvas"
          :style="{ transform }"
        ></canvas>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-viewer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.pane {
  min-width: 0;
}
.pane-title {
  font-size: 13px;
  color: #888;
  margin-bottom: 6px;
}
.pane-viewport {
  position: relative;
  overflow: hidden;
  height: calc(100vh - 320px);
  min-height: 200px;
  border-radius: 8px;
  background: #111;
  cursor: grab;
  touch-action: none;
  min-width: 0;
}
.pane-viewport.dragging {
  cursor: grabbing;
}
.pane-canvas {
  display: block;
  transform-origin: 0 0;
  border-radius: 8px;
}
</style>
