import type { Frame, GifSettings } from '../types'

/** Keep the timeline duration when sampling fewer frames. */
export function reduceFrames(frames: Frame[], settings: GifSettings): Frame[] {
  return frames.filter((_, i) => i % 2 === 0).map((frame, i) => ({
    ...frame,
    delayMs: (frame.delayMs ?? settings.delayMs) +
      (frames[i * 2 + 1] ? frames[i * 2 + 1].delayMs ?? settings.delayMs : 0),
  }))
}

export async function transformFrames(frames: Frame[], action: 'left' | 'right' | 'flip'): Promise<Frame[]> {
  const { fileToFrame, revokeFrames } = await import('./images')
  const output: Frame[] = []
  try {
    for (const frame of frames) {
      const canvas = document.createElement('canvas')
      canvas.width = action === 'flip' ? frame.width : frame.height
      canvas.height = action === 'flip' ? frame.height : frame.width
      const ctx = canvas.getContext('2d')!
      ctx.translate(canvas.width / 2, canvas.height / 2)
      if (action === 'flip') ctx.scale(-1, 1)
      else ctx.rotate(action === 'right' ? Math.PI / 2 : -Math.PI / 2)
      ctx.drawImage(frame.image, -frame.width / 2, -frame.height / 2)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        value => value ? resolve(value) : reject(new Error('프레임 변환에 실패했습니다.')), 'image/png'))
      const next = await fileToFrame(new File([blob], frame.name, { type: 'image/png' }))
      output.push({ ...next, id: frame.id, delayMs: frame.delayMs })
    }
    return output
  } catch (error) {
    revokeFrames(output)
    throw error
  }
}
