<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'files', files: File[]): void
  (e: 'append', files: File[]): void
}>()

const dragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const dirInputRef = ref<HTMLInputElement | null>(null)
const sampleLoading = ref(false)
const sampleProgress = ref('')

let sampleAbort: AbortController | null = null

function abortSampleLoading() {
  sampleAbort?.abort()
  sampleAbort = null
  sampleLoading.value = false
  sampleProgress.value = ''
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}

function sortImages(files: File[]): File[] {
  return files
    .filter(isImage)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
}

function onPickImages(event: Event) {
  abortSampleLoading()
  const list = (event.target as HTMLInputElement).files
  if (list && list.length > 0) emit('files', sortImages(Array.from(list)))
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function onPickDir(event: Event) {
  abortSampleLoading()
  const list = (event.target as HTMLInputElement).files
  if (list && list.length > 0) emit('files', sortImages(Array.from(list)))
  if (dirInputRef.value) dirInputRef.value.value = ''
}

interface SampleEntry {
  name: string
  file: string
}

const SAMPLE_CONCURRENCY = 6

async function fetchSample(entry: SampleEntry): Promise<File | null> {
  try {
    const res = await fetch(`/samples/${encodeURIComponent(entry.file)}`)
    if (!res.ok) return null
    const blob = await res.blob()
    return new File([blob], entry.name, { type: blob.type })
  } catch {
    return null
  }
}

async function loadSamples() {
  abortSampleLoading()
  const controller = new AbortController()
  sampleAbort = controller
  sampleLoading.value = true

  let entries: SampleEntry[]
  try {
    const res = await fetch('/samples/manifest.json', { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    entries = (await res.json()) as SampleEntry[]
  } catch (e) {
    if (!controller.signal.aborted) {
      console.error('加载内置测试图片清单失败', e)
      sampleLoading.value = false
      sampleProgress.value = ''
    }
    return
  }

  const total = entries.length
  let done = 0
  let first = true
  sampleProgress.value = `加载中 0/${total}`

  let cursor = 0
  async function worker() {
    while (cursor < entries.length && !controller.signal.aborted) {
      const entry = entries[cursor++]
      const file = await fetchSample(entry)
      if (controller.signal.aborted) return
      done++
      sampleProgress.value = `加载中 ${done}/${total}`
      if (!file) {
        console.warn(`内置测试图片加载失败: ${entry.file}`)
        continue
      }
      if (first) {
        first = false
        emit('files', [file])
      } else {
        emit('append', [file])
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(SAMPLE_CONCURRENCY, total) }, () => worker())
  )
  if (!controller.signal.aborted) {
    sampleLoading.value = false
    sampleProgress.value = ''
  }
}

interface FileSystemEntryLike {
  isFile: boolean
  isDirectory: boolean
  file(success: (file: File) => void, error?: (err: unknown) => void): void
  createReader(): {
    readEntries(
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (err: unknown) => void
    ): void
  }
}

function readEntryFiles(entry: FileSystemEntryLike): Promise<File[]> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (file) => resolve([file]),
        () => resolve([])
      )
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      reader.readEntries(
        async (entries) => {
          const nested = await Promise.all(
            entries
              .filter((e) => e.isFile)
              .map((e) => readEntryFiles(e))
          )
          resolve(nested.flat())
        },
        () => resolve([])
      )
    } else {
      resolve([])
    }
  })
}

async function onDrop(event: DragEvent) {
  dragging.value = false
  abortSampleLoading()
  const items = event.dataTransfer?.items
  if (!items || items.length === 0) return

  const collected: File[] = []
  const tasks: Promise<File[]>[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.() as FileSystemEntryLike | null
    if (entry) {
      tasks.push(readEntryFiles(entry))
    } else {
      const file = item.getAsFile()
      if (file) collected.push(file)
    }
  }
  for (const files of await Promise.all(tasks)) {
    collected.push(...files)
  }
  const images = sortImages(collected)
  if (images.length > 0) emit('files', images)
}
</script>

<template>
  <div
    class="upload-zone"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      hidden
      @change="onPickImages"
    />
    <input
      ref="dirInputRef"
      type="file"
      webkitdirectory
      hidden
      @change="onPickDir"
    />
    <p>拖入图片或目录到此处</p>
    <div class="actions">
      <button type="button" @click.stop="fileInputRef?.click()">选择图片</button>
      <button type="button" @click.stop="dirInputRef?.click()">选择目录</button>
      <button
        type="button"
        class="sample-btn"
        :disabled="sampleLoading"
        @click.stop="loadSamples"
      >
        {{ sampleLoading ? sampleProgress : '加载内置测试图片' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.upload-zone {
  border: 2px dashed #444;
  border-radius: 10px;
  padding: 24px;
  text-align: center;
  color: #888;
  transition: border-color 0.2s, background 0.2s;
}
.upload-zone.dragging,
.upload-zone:hover {
  border-color: #00e676;
  background: rgba(0, 230, 118, 0.06);
}
.upload-zone p {
  margin: 0 0 12px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}
.actions button {
  padding: 6px 14px;
  border: 1px solid #444;
  border-radius: 6px;
  background: #1e1e1e;
  color: #ddd;
  cursor: pointer;
  font-size: 13px;
}
.actions button:hover {
  border-color: #00e676;
  color: #00e676;
}
.actions button:disabled {
  cursor: default;
  opacity: 0.7;
}
.actions button:disabled:hover {
  border-color: #444;
  color: #ddd;
}
</style>
