export interface Capability {
  key: string
  name: string
  description: string
}

export interface Detection {
  box: number[]
  label: string
  score: number
  landmarks?: number[][] | null
}

export interface DetectResponse {
  width: number
  height: number
  results: Record<string, Detection[]>
}

export async function fetchCapabilities(): Promise<Capability[]> {
  const res = await fetch('/api/capabilities')
  if (!res.ok) throw new Error(`获取功能列表失败: ${res.status}`)
  return res.json()
}

export async function detectImage(
  file: File,
  features: string[]
): Promise<DetectResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('features', features.join(','))
  const res = await fetch('/api/detect', { method: 'POST', body: form })
  if (!res.ok) {
    let detail = `${res.status}`
    try {
      const data = await res.json()
      if (data.detail) detail = data.detail
    } catch {
      // ignore
    }
    throw new Error(`检测失败: ${detail}`)
  }
  return res.json()
}
