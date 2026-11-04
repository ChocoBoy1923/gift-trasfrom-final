import { fileToFrame } from './images'
import type { Frame } from '../types'

export const VIDEO_ACCEPT =
  'video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogg,.m4v'
export const MAX_CAPTURE_WIDTH = 800

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return /\.(mp4|webm|mov|ogg|ogv|m4v)$/i.test(file.name)
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('동영상 위치를 이동할 수 없습니다.'))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    video.currentTime = time
  })
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('프레임을 저장하지 못했습니다.'))
          return
        }
        resolve(new File([blob], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  })
}

export function captureTimes(start: number, end: number, fps: number, maxFrames: number): number[] {
  const span = Math.max(0, end - start)
  const count = Math.min(maxFrames, Math.max(1, Math.floor(span * fps) + 1))
  const step = count > 1 ? span / (count - 1) : 0
  return Array.from({ length: count }, (_, i) => start + step * i)
}

export async function captureVideoFrames(options: {
  video: HTMLVideoElement
  times: number[]
  baseName: string
  signal?: AbortSignal
  onProgress: (current: number, total: number) => void
}): Promise<Frame[]> {
  const { video, times, baseName, signal, onProgress } = options
  const sourceW = video.videoWidth
  const sourceH = video.videoHeight
  if (!sourceW || !sourceH) throw new Error('동영상 크기를 읽을 수 없습니다.')

  const scale = Math.min(1, MAX_CAPTURE_WIDTH / sourceW)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sourceW * scale)
  canvas.height = Math.round(sourceH * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 사용할 수 없습니다.')

  video.pause()
  const frames: Frame[] = []
  for (let i = 0; i < times.length; i += 1) {
    if (signal?.aborted) throw new DOMException('취소되었습니다.', 'AbortError')
    const time = times[i] ?? 0
    await seek(video, Math.min(time, Math.max(0, video.duration - 0.001)))
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const file = await canvasToFile(
      canvas,
      `${baseName}-${String(i + 1).padStart(3, '0')}-${time.toFixed(2)}s.jpg`,
    )
    frames.push(await fileToFrame(file))
    onProgress(i + 1, times.length)
  }
  return frames
}
