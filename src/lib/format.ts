import type { Frame, GifSettings, Playback, QualityPreset } from '../types'

export const QUALITY_COLORS: Record<QualityPreset, number> = {
  max: 256,
  high: 192,
  medium: 128,
  small: 64,
}

export const MAX_OUTPUT_WIDTH = 1280
export const MAX_FRAMES = 80
export const ACCEPT_ATTR =
  'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/svg+xml,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.svg'

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(file.name)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}초`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}분 ${rest}초`
}

export function delayToFps(delayMs: number): string {
  if (delayMs <= 0) return '—'
  return `${(1000 / delayMs).toFixed(1)} fps`
}

export function playbackFrameCount(count: number, playback: Playback): number {
  if (count <= 1 || playback !== 'pingpong') return count
  return count * 2 - 2
}

export function loopRepeatValue(settings: GifSettings): number {
  if (settings.loopMode === 'infinite') return 0
  if (settings.loopMode === 'once') return -1
  return Math.max(0, settings.loopCount - 1)
}

export function resolveOutputSize(frames: Frame[], settings: GifSettings): {
  width: number
  height: number
} {
  const first = frames[0]
  if (!first) return { width: 0, height: 0 }

  const srcW = Math.max(1, first.width)
  const srcH = Math.max(1, first.height)
  let targetW = srcW

  if (settings.widthMode === 'custom') {
    targetW = settings.customWidth
  } else if (settings.widthMode !== 'original') {
    targetW = Number(settings.widthMode)
  }

  targetW = Math.min(MAX_OUTPUT_WIDTH, Math.max(16, Math.round(targetW)))
  const height = Math.max(16, Math.round((srcH / srcW) * targetW))
  return { width: targetW, height }
}

export const MIN_FRAME_DELAY_MS = 20
export const MAX_FRAME_DELAY_MS = 10000

export function frameDelayMs(frame: Frame, settings: GifSettings): number {
  return Math.max(MIN_FRAME_DELAY_MS, frame.delayMs ?? settings.delayMs)
}

export function playbackSequence(frames: Frame[], playback: Playback): Frame[] {
  if (playback === 'reverse') return [...frames].reverse()
  if (playback === 'pingpong' && frames.length > 1) {
    return [...frames, ...frames.slice(1, -1).reverse()]
  }
  return frames
}

export function estimateDurationMs(frames: Frame[], settings: GifSettings): number {
  const sequence = playbackSequence(frames, settings.playback)
  if (sequence.length === 0) return 0
  const base = sequence.reduce((sum, frame) => sum + frameDelayMs(frame, settings), 0)
  return base + settings.firstHoldMs + settings.lastHoldMs
}

export function downloadFileName(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `릴GIF-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.gif`
}

export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (!item) return list
  next.splice(to, 0, item)
  return next
}
