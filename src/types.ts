export type FitMode = 'contain' | 'cover' | 'stretch'
export type Playback = 'forward' | 'reverse' | 'pingpong'
export type QualityPreset = 'max' | 'high' | 'medium' | 'small'
export type LoopMode = 'infinite' | 'once' | 'count'
export type WidthMode = 'original' | '320' | '480' | '640' | '800' | 'custom'

export type Frame = {
  id: string
  file: File
  name: string
  url: string
  width: number
  height: number
  image: HTMLImageElement
  /** Display time for this image; falls back to the global speed when unset. */
  delayMs?: number
}

export type GifSettings = {
  delayMs: number
  loopMode: LoopMode
  loopCount: number
  widthMode: WidthMode
  customWidth: number
  fit: FitMode
  background: string
  quality: QualityPreset
  playback: Playback
  firstHoldMs: number
  lastHoldMs: number
}

export type TextStyle = 'meme' | 'neon' | 'pop' | 'hand' | 'label'
export type TextPosition = 'top' | 'center' | 'bottom' | 'custom'
export type TextAnimation = 'none' | 'typing' | 'blink' | 'bounce'

export type TextOverlay = {
  id: string
  text: string
  style: TextStyle
  color: string
  accent: string
  sizePercent: number
  position: TextPosition
  x: number
  y: number
  charColors: (string | null)[]
  animation: TextAnimation
}

export type EncodeProgress = {
  current: number
  total: number
}

export type GifResult = {
  blob: Blob
  url: string
  width: number
  height: number
  frameCount: number
  durationMs: number
}
