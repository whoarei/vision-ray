<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  files: File[]
  currentIndex: number
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

const urls = ref<string[]>([])
const urlMap = new Map<File, string>()

watch(
  () => props.files,
  (files) => {
    const current = new Set(files)
    for (const [file, url] of urlMap) {
      if (!current.has(file)) {
        URL.revokeObjectURL(url)
        urlMap.delete(file)
      }
    }
    for (const file of files) {
      if (!urlMap.has(file)) urlMap.set(file, URL.createObjectURL(file))
    }
    urls.value = files.map((file) => urlMap.get(file)!)
  },
  { immediate: true, deep: true }
)

onBeforeUnmount(() => {
  for (const url of urlMap.values()) URL.revokeObjectURL(url)
  urlMap.clear()
})

function onWheel(event: WheelEvent) {
  const strip = event.currentTarget as HTMLElement
  if (strip.scrollWidth <= strip.clientWidth) return
  event.preventDefault()
  strip.scrollLeft += event.deltaY + event.deltaX
}
</script>

<template>
  <div class="thumbnail-strip" @wheel="onWheel">
    <div
      v-for="(file, i) in files"
      :key="i"
      class="thumb"
      :class="{ active: i === currentIndex }"
      :title="file.name"
      @click="emit('select', i)"
    >
      <img :src="urls[i]" :alt="file.name" />
      <span class="thumb-name">{{ file.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.thumbnail-strip {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  max-width: 100%;
  min-width: 0;
  padding: 10px 2px;
}
.thumb {
  flex: 0 0 auto;
  width: 96px;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 4px;
  background: #1e1e1e;
  text-align: center;
}
.thumb.active {
  border-color: #00e676;
}
.thumb img {
  width: 100%;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}
.thumb-name {
  display: block;
  font-size: 11px;
  color: #888;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
