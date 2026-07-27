<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  detectImage,
  fetchCapabilities,
  type Capability,
  type DetectResponse,
} from './api'
import { getRenderers } from './renderers'
import FeatureSelector from './components/FeatureSelector.vue'
import UploadZone from './components/UploadZone.vue'
import ResultViewer from './components/ResultViewer.vue'
import ThumbnailStrip from './components/ThumbnailStrip.vue'

const capabilities = ref<Capability[]>([])
const selectedFeatures = ref<string[]>([])
const renderers = getRenderers()
const selectedRenderer = ref(
  renderers.find((r) => r.key === 'mosaic')?.key ?? renderers[0]?.key ?? ''
)

const imageFiles = ref<File[]>([])
const currentIndex = ref(0)
const imageUrl = ref<string | null>(null)
const result = ref<DetectResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const resultCache = new Map<File, DetectResponse>()

const currentFile = computed<File | null>(
  () => imageFiles.value[currentIndex.value] ?? null
)

onMounted(async () => {
  try {
    capabilities.value = await fetchCapabilities()
    selectedFeatures.value = capabilities.value.map((c) => c.key)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

watch(selectedFeatures, () => {
  resultCache.clear()
  if (currentFile.value) void loadCurrent()
})

function resetBatch() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = null
  result.value = null
  error.value = null
  resultCache.clear()
  imageFiles.value = []
  currentIndex.value = 0
}

function onFiles(files: File[]) {
  resetBatch()
  imageFiles.value = files
  currentIndex.value = 0
  void loadCurrent()
}

function onAppend(files: File[]) {
  const wasEmpty = imageFiles.value.length === 0
  imageFiles.value.push(...files)
  if (wasEmpty && files.length > 0) {
    currentIndex.value = 0
    void loadCurrent()
  }
}

function onSelect(index: number) {
  if (index === currentIndex.value) return
  currentIndex.value = index
  void loadCurrent()
}

async function loadCurrent() {
  const file = currentFile.value
  if (!file) return

  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = URL.createObjectURL(file)
  error.value = null

  const cached = resultCache.get(file)
  if (cached) {
    result.value = cached
    return
  }

  if (selectedFeatures.value.length === 0) {
    result.value = null
    error.value = '请至少选择一项检测功能'
    return
  }

  loading.value = true
  result.value = null
  try {
    const res = await detectImage(file, selectedFeatures.value)
    resultCache.set(file, res)
    if (currentFile.value === file) {
      result.value = res
    }
  } catch (e) {
    if (currentFile.value === file) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  } finally {
    if (currentFile.value === file) loading.value = false
  }
}
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>VisionRay 目标检测</h1>
    </header>

    <aside class="sidebar">
      <FeatureSelector
        :capabilities="capabilities"
        :selected="selectedFeatures"
        @update:selected="selectedFeatures = $event"
      />

      <div class="renderer-selector">
        <h3>展示方式</h3>
        <label
          v-for="r in renderers"
          :key="r.key"
          class="renderer-item"
          :class="{ active: selectedRenderer === r.key }"
        >
          <input type="radio" name="renderer" :value="r.key" v-model="selectedRenderer" />
          <span class="renderer-name">{{ r.name }}</span>
        </label>
      </div>

      <UploadZone @files="onFiles" @append="onAppend" />
      <div v-if="loading" class="status">检测中...</div>
      <div v-if="error" class="status error">{{ error }}</div>

      <div class="usage-tips">
        <h3>使用说明</h3>
        <ul>
          <li>在图片上滚动滚轮，以鼠标为中心放大缩小；按住鼠标左键拖拽可平移画面，原图与检测结果联动</li>
          <li>在底部缩略图列表上滚动滚轮，可横向翻阅图片，点击缩略图切换当前图片</li>
        </ul>
      </div>
    </aside>

    <main class="content">
      <template v-if="imageFiles.length > 0">
        <div class="viewer-area">
          <ResultViewer
            :image-url="imageUrl"
            :result="result"
            :renderer-key="selectedRenderer"
          />
        </div>
        <ThumbnailStrip
          :files="imageFiles"
          :current-index="currentIndex"
          @select="onSelect"
        />
      </template>
      <div v-else class="placeholder">请上传图片或目录开始检测</div>
    </main>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  background: #121212;
  color: #ddd;
}
</style>

<style scoped>
.app {
  display: grid;
  grid-template-columns: 300px 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'header header'
    'sidebar content';
  min-height: 100vh;
}
.header {
  grid-area: header;
  padding: 14px 24px;
  border-bottom: 1px solid #2a2a2a;
}
.header h1 {
  margin: 0;
  font-size: 20px;
}
.sidebar {
  grid-area: sidebar;
  padding: 20px;
  border-right: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.content {
  grid-area: content;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  height: calc(100vh - 61px);
}
.viewer-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.placeholder {
  color: #555;
  text-align: center;
  margin-top: 120px;
}
.renderer-selector h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #888;
}
.renderer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  background: #1e1e1e;
}
.renderer-item.active {
  border-color: #00e676;
}
.renderer-name {
  color: #eee;
}
.status {
  font-size: 13px;
  color: #00e676;
}
.status.error {
  color: #ff5252;
}
.usage-tips {
  margin-top: auto;
  padding: 12px 14px;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  background: #1a1a1a;
}
.usage-tips h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #888;
}
.usage-tips ul {
  margin: 0;
  padding-left: 18px;
}
.usage-tips li {
  font-size: 12px;
  color: #999;
  line-height: 1.7;
}
</style>
