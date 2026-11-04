import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import {
  frameDelayMs,
  loopRepeatValue,
  MIN_FRAME_DELAY_MS,
  playbackFrameCount,
  playbackSequence,
  QUALITY_COLORS,
} from './format'
import { drawFitted, drawTextOverlay, ensureFontsLoaded } from './render'
import type { Frame, GifResult, GifSettings, TextOverlay } from '../types'

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function frameDelay(frame: Frame, index: number, total: number, settings: GifSettings): number {
  let delay = frameDelayMs(frame, settings)
  if (index === 0) delay += settings.firstHoldMs
  if (index === total - 1) delay += settings.lastHoldMs
  return Math.max(MIN_FRAME_DELAY_MS, delay)
}

export async function encodeGif(options: {
  frames: Frame[]
  settings: GifSettings
  overlays: TextOverlay[]
  width: number
  height: number
  signal?: AbortSignal
  onProgress: (current: number, total: number) => void
}): Promise<GifResult> {
  const { frames, settings, overlays, width, height, signal, onProgress } = options
  if (frames.length === 0) {
    throw new Error('이미지가 없습니다.')
  }

  await ensureFontsLoaded(overlays)

  const sequence = playbackSequence(frames, settings.playback)
  const total = sequence.length
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('캔버스를 사용할 수 없습니다.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const gif = GIFEncoder()
  const maxColors = QUALITY_COLORS[settings.quality]
  const repeat = loopRepeatValue(settings)

  for (let i = 0; i < sequence.length; i += 1) {
    if (signal?.aborted) throw new DOMException('취소되었습니다.', 'AbortError')

    const frame = sequence[i]
    if (!frame) continue

    onProgress(i + 1, total)
    await yieldToUi()

    drawFitted(ctx, frame.image, width, height, settings.fit, settings.background)
    for (const overlay of overlays) drawTextOverlay(ctx, overlay, width, height, i, total)
    const imageData = ctx.getImageData(0, 0, width, height)
    const rgba = new Uint8Array(imageData.data)
    const palette = quantize(rgba, maxColors)
    const index = applyPalette(rgba, palette)

    gif.writeFrame(index, width, height, {
      palette,
      delay: frameDelay(frame, i, total, settings),
      repeat,
    })
  }

  gif.finish()
  onProgress(total, total)

  const bytes = gif.bytes()
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy.buffer], { type: 'image/gif' })
  const url = URL.createObjectURL(blob)

  return {
    blob,
    url,
    width,
    height,
    frameCount: playbackFrameCount(frames.length, settings.playback),
    durationMs: sequence.reduce(
      (sum, frame, i) => sum + frameDelay(frame, i, sequence.length, settings),
      0,
    ),
  }
}
