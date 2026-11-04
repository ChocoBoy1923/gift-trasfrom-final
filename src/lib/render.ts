import type { FitMode, TextOverlay, TextStyle } from '../types'

export const TEXT_FONTS: Record<TextStyle, { family: string; weight: number }> = {
  meme: { family: 'Black Han Sans', weight: 400 },
  neon: { family: 'Do Hyeon', weight: 400 },
  pop: { family: 'Jua', weight: 400 },
  hand: { family: 'Nanum Pen Script', weight: 400 },
  label: { family: 'Noto Sans KR', weight: 700 },
}

export function fontString(style: TextStyle, px: number): string {
  const font = TEXT_FONTS[style]
  return `${font.weight} ${px}px "${font.family}", "Noto Sans KR", sans-serif`
}

export const MAX_TEXT_OVERLAYS = 6

let overlaySeq = 0

export function createTextOverlay(overrides: Partial<TextOverlay> = {}): TextOverlay {
  overlaySeq += 1
  return {
    id: `text-${Date.now().toString(36)}-${overlaySeq}`,
    text: '',
    style: 'meme',
    color: '#ffffff',
    accent: '#000000',
    sizePercent: 12,
    position: 'bottom',
    x: 0.5,
    y: 0.85,
    charColors: [],
    animation: 'none',
    ...overrides,
  }
}

export async function ensureFontLoaded(overlay: TextOverlay): Promise<void> {
  if (!overlay.text.trim() || !document.fonts) return
  try {
    await document.fonts.load(fontString(overlay.style, 48), overlay.text)
  } catch {
    // Canvas falls back to the next family in the stack.
  }
}

export async function ensureFontsLoaded(overlays: TextOverlay[]): Promise<void> {
  await Promise.all(overlays.map(ensureFontLoaded))
}

export function drawFitted(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  width: number,
  height: number,
  fit: FitMode,
  background: string,
): void {
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  const source = image as HTMLImageElement
  const sourceW = source.naturalWidth || image.width
  const sourceH = source.naturalHeight || image.height

  if (fit === 'stretch') {
    ctx.drawImage(image, 0, 0, width, height)
    return
  }

  const scale =
    fit === 'cover'
      ? Math.max(width / sourceW, height / sourceH)
      : Math.min(width / sourceW, height / sourceH)

  const drawW = sourceW * scale
  const drawH = sourceH * scale
  ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH)
}

/** Keeps per-character colors attached to the same characters after the text is edited. */
export function remapCharColors(
  oldText: string,
  newText: string,
  colors: (string | null)[],
): (string | null)[] {
  const before = Array.from(oldText)
  const after = Array.from(newText)
  const n = before.length
  const m = after.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] =
        before[i] === after[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const next: (string | null)[] = after.map(() => null)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      next[j] = colors[i] ?? null
      i += 1
      j += 1
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      i += 1
    } else {
      j += 1
    }
  }
  return next
}

type Glyph = { ch: string; color: string; x: number }
type Line = { glyphs: Glyph[]; width: number }

type TextLayout = {
  lines: Line[]
  px: number
  lineHeight: number
  cx: number
  top: number
  blockW: number
  blockH: number
}

function visibleCount(overlay: TextOverlay, total: number, index: number, length: number): number {
  if (overlay.animation === 'typing' && total > 1) {
    const revealFrames = Math.max(1, Math.ceil(total * 0.7))
    return Math.ceil((length * Math.min(index + 1, revealFrames)) / revealFrames)
  }
  if (overlay.animation === 'blink' && index % 2 === 1) return 0
  return length
}

function layoutText(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number,
  height: number,
  index: number,
  total: number,
  animate: boolean,
): TextLayout | null {
  const chars = Array.from(overlay.text)
  const count = animate ? visibleCount(overlay, total, index, chars.length) : chars.length
  if (!overlay.text.trim() || count === 0) return null

  const px = Math.max(10, Math.round((height * overlay.sizePercent) / 100))
  ctx.font = fontString(overlay.style, px)
  const maxWidth = width * 0.9

  const lines: Line[] = []
  let current: Line = { glyphs: [], width: 0 }
  for (let i = 0; i < count; i += 1) {
    const ch = chars[i] ?? ''
    if (ch === '\n') {
      lines.push(current)
      current = { glyphs: [], width: 0 }
      continue
    }
    const w = ctx.measureText(ch).width
    if (current.glyphs.length > 0 && current.width + w > maxWidth) {
      lines.push(current)
      current = { glyphs: [], width: 0 }
      if (ch === ' ') continue
    }
    current.glyphs.push({ ch, color: overlay.charColors[i] ?? overlay.color, x: current.width })
    current.width += w
  }
  lines.push(current)

  const lineHeight = px * 1.18
  const blockH = lineHeight * lines.length
  const blockW = Math.max(...lines.map((line) => line.width))
  const margin = Math.max(8, height * 0.06)

  let cx = width / 2
  let top: number
  if (overlay.position === 'custom') {
    cx = overlay.x * width
    top = overlay.y * height - blockH / 2
  } else if (overlay.position === 'top') {
    top = margin
  } else if (overlay.position === 'bottom') {
    top = height - margin - blockH
  } else {
    top = (height - blockH) / 2
  }

  if (animate && overlay.animation === 'bounce' && total > 1) {
    top += Math.sin((index / total) * Math.PI * 4) * px * 0.25
  }

  return { lines, px, lineHeight, cx, top, blockW, blockH }
}

/** Bounding box of the full text block in canvas pixels, ignoring animation. */
export function measureTextBlock(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number; cx: number; cy: number } | null {
  ctx.save()
  const layout = layoutText(ctx, overlay, width, height, 0, 1, false)
  ctx.restore()
  if (!layout) return null
  const pad = layout.px * 0.3
  return {
    left: layout.cx - layout.blockW / 2 - pad,
    top: layout.top - pad,
    width: layout.blockW + pad * 2,
    height: layout.blockH + pad * 2,
    cx: layout.cx,
    cy: layout.top + layout.blockH / 2,
  }
}

export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number,
  height: number,
  index = 0,
  total = 1,
): void {
  ctx.save()
  const layout = layoutText(ctx, overlay, width, height, index, total, true)
  if (!layout) {
    ctx.restore()
    return
  }

  const { lines, px, lineHeight, cx, top } = layout
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  const eachGlyph = (dx: number, dy: number, fn: (g: Glyph, x: number, y: number) => void) => {
    lines.forEach((line, li) => {
      const y = top + lineHeight * li + lineHeight / 2 + dy
      const startX = cx - line.width / 2 + dx
      for (const g of line.glyphs) fn(g, startX + g.x, y)
    })
  }

  switch (overlay.style) {
    case 'meme': {
      ctx.lineWidth = Math.max(2, px * 0.14)
      ctx.strokeStyle = overlay.accent
      eachGlyph(0, 0, (g, x, y) => ctx.strokeText(g.ch, x, y))
      eachGlyph(0, 0, (g, x, y) => {
        ctx.fillStyle = g.color
        ctx.fillText(g.ch, x, y)
      })
      break
    }
    case 'neon': {
      ctx.shadowColor = overlay.accent
      ctx.shadowBlur = px * 0.45
      ctx.fillStyle = overlay.accent
      eachGlyph(0, 0, (g, x, y) => ctx.fillText(g.ch, x, y))
      ctx.shadowBlur = px * 0.15
      eachGlyph(0, 0, (g, x, y) => {
        ctx.fillStyle = g.color
        ctx.fillText(g.ch, x, y)
      })
      break
    }
    case 'pop': {
      const offset = Math.max(2, px * 0.08)
      ctx.lineWidth = Math.max(3, px * 0.2)
      ctx.strokeStyle = overlay.accent
      ctx.fillStyle = overlay.accent
      eachGlyph(offset, offset, (g, x, y) => {
        ctx.strokeText(g.ch, x, y)
        ctx.fillText(g.ch, x, y)
      })
      ctx.lineWidth = Math.max(2, px * 0.12)
      ctx.strokeStyle = '#ffffff'
      eachGlyph(0, 0, (g, x, y) => ctx.strokeText(g.ch, x, y))
      eachGlyph(0, 0, (g, x, y) => {
        ctx.fillStyle = g.color
        ctx.fillText(g.ch, x, y)
      })
      break
    }
    case 'hand': {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
      ctx.shadowBlur = px * 0.12
      ctx.shadowOffsetY = px * 0.04
      eachGlyph(0, 0, (g, x, y) => {
        ctx.fillStyle = g.color
        ctx.fillText(g.ch, x, y)
      })
      break
    }
    case 'label': {
      const padX = px * 0.45
      const padY = px * 0.16
      ctx.fillStyle = overlay.accent
      lines.forEach((line, li) => {
        if (line.width === 0) return
        const y = top + lineHeight * li + lineHeight / 2
        ctx.fillRect(
          cx - line.width / 2 - padX,
          y - lineHeight / 2 + padY / 2,
          line.width + padX * 2,
          lineHeight - padY,
        )
      })
      eachGlyph(0, 0, (g, x, y) => {
        ctx.fillStyle = g.color
        ctx.fillText(g.ch, x, y)
      })
      break
    }
  }

  ctx.restore()
}
