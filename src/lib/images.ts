import { isImageFile, MAX_FRAMES } from './format'
import type { Frame } from '../types'

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
    image.src = url
  })
}

export async function fileToFrame(file: File): Promise<Frame> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImageElement(url)
    return {
      id: crypto.randomUUID(),
      file,
      name: file.name,
      url,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      image,
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

export async function filesToFrames(
  files: FileList | File[],
  currentCount: number,
): Promise<{ frames: Frame[]; skipped: number; truncated: number }> {
  const incoming = Array.from(files).filter(isImageFile)
  const skipped = Array.from(files).length - incoming.length
  const room = Math.max(0, MAX_FRAMES - currentCount)
  const selected = incoming.slice(0, room)
  const truncated = incoming.length - selected.length
  const frames = await Promise.all(selected.map(fileToFrame))
  return { frames, skipped, truncated }
}

export function revokeFrames(frames: Frame[]): void {
  for (const frame of frames) URL.revokeObjectURL(frame.url)
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('샘플 이미지를 만들지 못했습니다.'))
        return
      }
      resolve(new File([blob], name, { type: 'image/png' }))
    }, 'image/png')
  })
}

export async function createDemoFrames(): Promise<Frame[]> {
  const slides = [
    { bg: '#0b3d91', accent: '#7cc6ff', label: '01' },
    { bg: '#0d4fa8', accent: '#ffd23f', label: '02' },
    { bg: '#0a6bb8', accent: '#ffffff', label: '03' },
    { bg: '#0b86c4', accent: '#0b3d91', label: '04' },
    { bg: '#11a0c9', accent: '#ffd23f', label: '05' },
    { bg: '#0b3d91', accent: '#ff7a59', label: '06' },
  ]

  const files = await Promise.all(
    slides.map(async (slide, index) => {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 400
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('캔버스를 사용할 수 없습니다.')

      ctx.fillStyle = slide.bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = slide.accent
      ctx.fillRect(0, 0, 18, canvas.height)
      ctx.fillRect(canvas.width - 18, 0, 18, canvas.height)

      ctx.strokeStyle = 'rgba(243, 238, 230, 0.18)'
      ctx.lineWidth = 2
      ctx.strokeRect(46, 36, canvas.width - 92, canvas.height - 72)

      ctx.fillStyle = slide.accent
      ctx.beginPath()
      ctx.arc(120 + index * 72, 200, 28, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#f3eee6'
      ctx.font = '700 96px "Noto Sans KR", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(slide.label, 400, 188)

      ctx.font = '500 20px "Noto Sans KR", sans-serif'
      ctx.fillStyle = 'rgba(243, 238, 230, 0.72)'
      ctx.fillText('KMOU GIF 샘플 프레임', 400, 268)

      return canvasToFile(canvas, `sample-${slide.label}.png`)
    }),
  )

  return Promise.all(files.map(fileToFrame))
}
