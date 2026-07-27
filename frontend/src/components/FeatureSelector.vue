<script setup lang="ts">
import type { Capability } from '../api'

defineProps<{
  capabilities: Capability[]
  selected: string[]
}>()

const emit = defineEmits<{
  (e: 'update:selected', value: string[]): void
}>()

function toggle(key: string, selected: string[]) {
  const next = selected.includes(key)
    ? selected.filter((k) => k !== key)
    : [...selected, key]
  emit('update:selected', next)
}
</script>

<template>
  <div class="feature-selector">
    <h3>检测功能</h3>
    <label
      v-for="cap in capabilities"
      :key="cap.key"
      class="feature-item"
      :class="{ active: selected.includes(cap.key) }"
    >
      <input
        type="checkbox"
        :checked="selected.includes(cap.key)"
        @change="toggle(cap.key, selected)"
      />
      <span class="feature-name">{{ cap.name }}</span>
      <span class="feature-desc">{{ cap.description }}</span>
    </label>
  </div>
</template>

<style scoped>
.feature-selector h3 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #888;
}
.feature-item {
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
.feature-item.active {
  border-color: #00e676;
}
.feature-name {
  font-weight: 600;
  color: #eee;
}
.feature-desc {
  font-size: 12px;
  color: #888;
}
</style>
