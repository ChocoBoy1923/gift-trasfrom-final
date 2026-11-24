import { parseGIF, decompressFrame } from 'gifuct-js'
import { fileToFrame, revokeFrames } from './images'
import type { Frame } from '../types'

/** Composite partial GIF patches with disposal before exposing editable PNG frames. */
export async function decodeGif(file: File, room: number): Promise<Frame[]> {
  if (file.size > 64 * 1024 * 1024) throw new Error(`${file.name}: GIF는 64MB 이하로 올려 주세요.`)
  const gif = parseGIF(await file.arrayBuffer())
  const blocks = gif.frames.filter(block => 'image' in block)
  const { width, height } = gif.lsd
  if (!blocks.length || !width || !height || width * height > 16777216) {
    throw new Error(`${file.name}: GIF 크기나 프레임을 읽을 수 없습니다.`)
  }
  if (blocks.length > room) throw new Error(`${file.name}: ${blocks.length}프레임입니다. 남은 ${room}프레임 한도를 초과합니다.`)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const patch = document.createElement('canvas')
  const scale = Math.min(1, 800 / Math.max(width, height), Math.sqrt(24000000 / (width * height * blocks.length)))
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(width * scale))
  output.height = Math.max(1, Math.round(height * scale))
  const outputCtx = output.getContext('2d')!
  const background = gif.gct?.[gif.lsd.backgroundColorIndex]
  const firstTransparent = blocks[0]?.gce?.extras.transparentColorGiven
  const reset = (left: number, top: number, w: number, h: number, transparent: boolean) => {
    ctx.clearRect(left, top, w, h)
    if (!transparent && background) {
      ctx.fillStyle = `rgb(${background.join(',')})`
      ctx.fillRect(left, top, w, h)
    }
  }
  reset(0, 0, width, height, !!firstTransparent)
  const result: Frame[] = []
  try {
    for (const [index, block] of blocks.entries()) {
      const dims = block.image.descriptor
      if (dims.width * dims.height > 16777216) throw new Error('GIF 프레임이 너무 큽니다.')
      const frame = decompressFrame(block, gif.gct, true)
      const before = frame.disposalType === 3 ? ctx.getImageData(0, 0, width, height) : null
      patch.width = frame.dims.width
      patch.height = frame.dims.height
      patch.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(frame.patch), patch.width, patch.height), 0, 0)
      ctx.drawImage(patch, frame.dims.left, frame.dims.top)
      outputCtx.clearRect(0, 0, output.width, output.height)
      outputCtx.drawImage(canvas, 0, 0, output.width, output.height)
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(
        value => value ? resolve(value) : reject(new Error('GIF 프레임을 읽지 못했습니다.')), 'image/png'))
      const decoded = await fileToFrame(new File([blob], `${file.name} · ${index + 1}`, { type: 'image/png' }))
      result.push({ ...decoded, delayMs: Math.max(20, frame.delay || 100) })
      if (frame.disposalType === 2) reset(frame.dims.left, frame.dims.top, patch.width, patch.height,
        block.gce?.extras.transparentColorGiven ?? false)
      else if (before) ctx.putImageData(before, 0, 0)
    }
    return result
  } catch (error) {
    revokeFrames(result)
    throw error
  }
}
