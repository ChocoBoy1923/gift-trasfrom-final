import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { frameDelayMs } from '../lib/format'
import {
  createTextOverlay,
  drawFitted,
  drawTextOverlay,
  ensureFontsLoaded,
  MAX_TEXT_OVERLAYS,
  measureTextBlock,
  remapCharColors,
} from '../lib/render'
import type {
  Frame,
  GifSettings,
  TextAnimation,
  TextOverlay,
  TextPosition,
  TextStyle,
} from '../types'

type TextPanelProps = {
  overlays: TextOverlay[]
  frames: Frame[]
  settings: GifSettings
  outputSize: { width: number; height: number }
  disabled?: boolean
  onChange: (next: TextOverlay[]) => void
}

const NEW_TEXT_Y = [0.2, 0.5, 0.35, 0.65, 0.8]

function previewLabel(overlay: TextOverlay, index: number): string {
  const text = overlay.text.replace(/\s+/g, ' ').trim()
  if (!text) return `${index + 1}. (빈 문구)`
  const chars = Array.from(text)
  return `${index + 1}. ${chars.slice(0, 8).join('')}${chars.length > 8 ? '…' : ''}`
}

const STYLES: { id: TextStyle; label: string; color: string; accent: string }[] = [
  { id: 'meme', label: '밈 굵은체', color: '#ffffff', accent: '#000000' },
  { id: 'neon', label: '네온', color: '#ffffff', accent: '#00d9ff' },
  { id: 'pop', label: '팝 그림자', color: '#ffd23f', accent: '#0b3d91' },
  { id: 'hand', label: '손글씨', color: '#ffffff', accent: '#000000' },
  { id: 'label', label: '자막 라벨', color: '#ffffff', accent: '#0b3d91' },
]

const POSITIONS: [Exclude<TextPosition, 'custom'>, string][] = [
  ['top', '위'],
  ['center', '가운데'],
  ['bottom', '아래'],
]

const ANIMATIONS: [TextAnimation, string][] = [
  ['none', '고정'],
  ['typing', '타자 효과'],
  ['blink', '깜빡임'],
  ['bounce', '통통'],
]

const SWATCHES = ['#ffffff', '#000000', '#ffd23f', '#ff4d4f', '#ff7ac6', '#7cc6ff', '#0b3d91', '#3ddc84']

const PREVIEW_W = 360

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function TextPanel({
  overlays,
  frames,
  settings,
  outputSize,
  disabled,
  onChange: onListChange,
}: TextPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [activeId, setActiveId] = useState(overlays[0]?.id ?? '')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [anchor, setAnchor] = useState<number | null>(null)
  const [pickColor, setPickColor] = useState('#ffd23f')

  const activeIndex = Math.max(0, overlays.findIndex((item) => item.id === activeId))
  const overlay = overlays[activeIndex] ?? overlays[0]!

  const onChange = (next: TextOverlay) =>
    onListChange(overlays.map((item) => (item.id === next.id ? next : item)))

  const set = <K extends keyof TextOverlay>(key: K, value: TextOverlay[K]) =>
    onChange({ ...overlay, [key]: value })

  const activate = (id: string) => {
    if (id === overlay.id) return
    setActiveId(id)
    setSelected(new Set())
    setAnchor(null)
  }

  const addOverlay = () => {
    if (overlays.length >= MAX_TEXT_OVERLAYS) return
    const next = createTextOverlay({
      text: '새 문구',
      style: overlay.style,
      color: overlay.color,
      accent: overlay.accent,
      sizePercent: overlay.sizePercent,
      animation: overlay.animation,
      position: 'custom',
      x: 0.5,
      y: NEW_TEXT_Y[overlays.length % NEW_TEXT_Y.length]!,
    })
    onListChange([...overlays, next])
    activate(next.id)
  }

  const removeOverlay = () => {
    if (overlays.length <= 1) {
      onChange(createTextOverlay({ id: overlay.id }))
      return
    }
    const rest = overlays.filter((item) => item.id !== overlay.id)
    onListChange(rest)
    activate(rest[Math.min(activeIndex, rest.length - 1)]!.id)
  }

  const chars = Array.from(overlay.text)
  const aspect = outputSize.width > 0 ? outputSize.height / outputSize.width : 0.625
  const previewH = Math.round(PREVIEW_W * aspect)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let index = 0
    let cancelled = false
    const total = Math.max(1, frames.length)

    const draw = () => {
      if (cancelled) return
      const frame = frames[index % total]
      if (frame) {
        drawFitted(ctx, frame.image, canvas.width, canvas.height, settings.fit, settings.background)
      } else {
        ctx.fillStyle = '#0b3d91'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      for (const item of overlays) {
        if (dragging) drawTextOverlay(ctx, item, canvas.width, canvas.height, 0, 1)
        else drawTextOverlay(ctx, item, canvas.width, canvas.height, index % total, total)
      }
      if (!dragging) index += 1
      if (dragging || hovering) {
        for (const item of overlays) {
          const box = measureTextBlock(ctx, item, canvas.width, canvas.height)
          if (!box) continue
          const active = item.id === activeId
          ctx.save()
          ctx.setLineDash(active ? [6, 4] : [4, 4])
          ctx.lineWidth = active ? 2 : 1.25
          ctx.strokeStyle = active ? '#ffd23f' : 'rgba(255, 210, 63, 0.6)'
          ctx.strokeRect(box.left, box.top, box.width, box.height)
          if (overlays.length > 1) {
            const tag = String(overlays.indexOf(item) + 1)
            ctx.setLineDash([])
            ctx.font = '700 11px "Noto Sans KR", sans-serif'
            ctx.fillStyle = active ? '#ffd23f' : 'rgba(255, 210, 63, 0.75)'
            ctx.fillRect(box.left, box.top - 14, 16, 14)
            ctx.fillStyle = '#072a66'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(tag, box.left + 8, box.top - 7)
          }
          ctx.restore()
        }
      }
    }

    let timer = 0
    const tick = () => {
      if (cancelled) return
      const shown = frames[index % total]
      draw()
      const delay = shown ? frameDelayMs(shown, settings) : settings.delayMs
      timer = window.setTimeout(tick, Math.max(60, delay))
    }

    void ensureFontsLoaded(overlays).then(dragging ? draw : tick)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [frames, overlays, activeId, settings, previewH, dragging, hovering])

  const toCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    const canvas = event.currentTarget
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const point = toCanvasPoint(event)
    let hit: { id: string; dx: number; dy: number } | null = null
    for (let i = overlays.length - 1; i >= 0 && !hit; i -= 1) {
      const item = overlays[i]!
      const box = measureTextBlock(ctx, item, canvas.width, canvas.height)
      if (
        box &&
        point.x >= box.left &&
        point.x <= box.left + box.width &&
        point.y >= box.top &&
        point.y <= box.top + box.height
      ) {
        hit = { id: item.id, dx: box.cx - point.x, dy: box.cy - point.y }
      }
    }
    if (!hit) {
      if (!overlay.text.trim()) return
      hit = { id: overlay.id, dx: 0, dy: 0 }
    }
    activate(hit.id)
    dragRef.current = hit
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // Drag still works without capture while the pointer stays over the canvas.
    }
    setDragging(true)
    moveTo(canvas, point)
  }

  const moveTo = (canvas: HTMLCanvasElement, point: { x: number; y: number }) => {
    const drag = dragRef.current
    const ctx = canvas.getContext('2d')
    const target = drag && overlays.find((item) => item.id === drag.id)
    if (!drag || !ctx || !target) return
    const box = measureTextBlock(ctx, target, canvas.width, canvas.height)
    const halfW = box ? Math.min(0.5, box.width / canvas.width / 2) : 0.02
    const halfH = box ? Math.min(0.5, box.height / canvas.height / 2) : 0.02
    onChange({
      ...target,
      position: 'custom',
      x: clamp((point.x + drag.dx) / canvas.width, halfW, 1 - halfW),
      y: clamp((point.y + drag.dy) / canvas.height, halfH, 1 - halfH),
    })
  }

  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
  }

  const onTextChange = (next: string) => {
    onChange({
      ...overlay,
      text: next,
      charColors: remapCharColors(overlay.text, next, overlay.charColors),
    })
    setSelected(new Set())
    setAnchor(null)
  }

  const selectFromTextarea = (el: HTMLTextAreaElement) => {
    const start = Array.from(el.value.slice(0, el.selectionStart)).length
    const end = Array.from(el.value.slice(0, el.selectionEnd)).length
    if (end <= start) return
    const next = new Set<number>()
    for (let i = start; i < end; i += 1) if (chars[i] !== '\n') next.add(i)
    setSelected(next)
    setAnchor(start)
  }

  const toggleChar = (index: number, shift: boolean) => {
    if (shift && anchor !== null) {
      const next = new Set(selected)
      const [a, b] = anchor < index ? [anchor, index] : [index, anchor]
      for (let i = a; i <= b; i += 1) if (chars[i] !== '\n') next.add(i)
      setSelected(next)
      return
    }
    const next = new Set(selected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelected(next)
    setAnchor(index)
  }

  const applyColor = (color: string | null) => {
    if (selected.size === 0) return
    const colors = chars.map((_, i) => overlay.charColors[i] ?? null)
    for (const i of selected) colors[i] = color
    onChange({ ...overlay, charColors: colors })
  }

  const customCount = overlay.charColors.filter(Boolean).length
  const hasText = overlays.some((item) => item.text.trim())

  return (
    <section className="panel text-panel">
      <div className="text-controls">
        <div className="panel-head">
          <div>
            <p className="kicker">텍스트</p>
            <h2>문구 넣기</h2>
          </div>
        </div>

        <div className="field">
          <p className="field-label">
            문구 목록 <em>{overlays.length} / {MAX_TEXT_OVERLAYS}개 · 고른 문구를 아래에서 편집</em>
          </p>
          <div className="chip-row overlay-list" role="tablist" aria-label="문구 목록">
            {overlays.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === overlay.id}
                className={`chip ${item.id === overlay.id ? 'is-on' : ''}`}
                disabled={disabled}
                onClick={() => activate(item.id)}
              >
                {previewLabel(item, i)}
              </button>
            ))}
            <button
              type="button"
              className="chip chip-add"
              disabled={disabled || overlays.length >= MAX_TEXT_OVERLAYS}
              onClick={addOverlay}
            >
              + 문구 추가
            </button>
            <button
              type="button"
              className="chip chip-danger"
              disabled={disabled || (overlays.length === 1 && !overlay.text)}
              onClick={removeOverlay}
            >
              {overlays.length > 1 ? `${activeIndex + 1}번 문구 삭제` : '문구 지우기'}
            </button>
          </div>
        </div>

        <label className="field">
          <span className="field-label">
            {overlays.length > 1 ? `${activeIndex + 1}번 문구` : '문구'} <em>줄바꿈 가능 · 모든 프레임에 적용</em>
          </span>
          <textarea
            className="text-input"
            rows={2}
            maxLength={80}
            placeholder="예) 해양대 축제 가자!"
            disabled={disabled}
            value={overlay.text}
            onChange={(event) => onTextChange(event.target.value)}
            onSelect={(event) => selectFromTextarea(event.currentTarget)}
          />
        </label>

        <fieldset className="field">
          <legend className="field-label">스타일</legend>
          <div className="chip-row">
            {STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                className={`chip style-chip style-${style.id} ${overlay.style === style.id ? 'is-on' : ''}`}
                disabled={disabled}
                onClick={() =>
                  onChange({ ...overlay, style: style.id, color: style.color, accent: style.accent })
                }
              >
                {style.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="text-grid">
          <fieldset className="field">
            <legend className="field-label">
              위치 {overlay.position === 'custom' && <em>드래그로 지정됨</em>}
            </legend>
            <div className="chip-row">
              {POSITIONS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip ${overlay.position === id ? 'is-on' : ''}`}
                  disabled={disabled}
                  onClick={() => set('position', id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend className="field-label">움직임</legend>
            <div className="chip-row">
              {ANIMATIONS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip ${overlay.animation === id ? 'is-on' : ''}`}
                  disabled={disabled}
                  onClick={() => set('animation', id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="field">
          <span className="field-label">
            글자 크기 <em>{overlay.sizePercent}%</em>
          </span>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            disabled={disabled}
            value={overlay.sizePercent}
            onChange={(event) => set('sizePercent', Number(event.target.value))}
          />
        </label>

        <div className="color-row">
          <label className="inline-num">
            기본 글자색
            <input
              type="color"
              disabled={disabled}
              value={overlay.color}
              onChange={(event) => set('color', event.target.value)}
            />
          </label>
          <label className="inline-num">
            {overlay.style === 'label' ? '라벨색' : overlay.style === 'neon' ? '빛 색' : '테두리색'}
            <input
              type="color"
              disabled={disabled}
              value={overlay.accent}
              onChange={(event) => set('accent', event.target.value)}
            />
          </label>
        </div>

        {chars.length > 0 && (
          <div className="char-colors">
            <p className="field-label">
              글자별 색
              <em>
                {selected.size > 0
                  ? `${selected.size}글자 선택됨`
                  : '글자를 누르거나 문구 칸에서 드래그로 선택'}
              </em>
            </p>
            <div className="char-row" role="group" aria-label="글자 선택">
              {chars.map((ch, i) =>
                ch === '\n' ? (
                  <span key={i} className="char-break" aria-hidden="true" />
                ) : (
                  <button
                    key={i}
                    type="button"
                    className={`char-tile ${selected.has(i) ? 'is-selected' : ''} ${ch === ' ' ? 'is-space' : ''}`}
                    style={{ color: overlay.charColors[i] ?? overlay.color }}
                    disabled={disabled}
                    aria-pressed={selected.has(i)}
                    aria-label={ch === ' ' ? '공백' : ch}
                    onClick={(event) => toggleChar(i, event.shiftKey)}
                  >
                    {ch === ' ' ? '·' : ch}
                  </button>
                ),
              )}
            </div>
            <div className="char-actions">
              <div className="swatches">
                {SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="swatch"
                    style={{ background: color }}
                    disabled={disabled || selected.size === 0}
                    aria-label={`선택한 글자를 ${color} 색으로`}
                    onClick={() => applyColor(color)}
                  />
                ))}
                <input
                  type="color"
                  className="swatch-picker"
                  value={pickColor}
                  disabled={disabled || selected.size === 0}
                  aria-label="선택한 글자 색 직접 고르기"
                  onChange={(event) => {
                    setPickColor(event.target.value)
                    applyColor(event.target.value)
                  }}
                />
              </div>
              <div className="chip-row">
                <button
                  type="button"
                  className="chip"
                  disabled={disabled}
                  onClick={() => {
                    setSelected(new Set(chars.flatMap((ch, i) => (ch === '\n' ? [] : [i]))))
                    setAnchor(0)
                  }}
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  className="chip"
                  disabled={disabled || selected.size === 0}
                  onClick={() => applyColor(null)}
                >
                  선택 글자 기본색으로
                </button>
                <button
                  type="button"
                  className="chip"
                  disabled={disabled || customCount === 0}
                  onClick={() => onChange({ ...overlay, charColors: chars.map(() => null) })}
                >
                  개별 색 모두 지우기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-preview">
        <p className="field-label">
          실시간 미리보기 <em>{frames.length ? `${frames.length}프레임 순환` : '프레임 없음'}</em>
        </p>
        <canvas
          ref={canvasRef}
          className={`${dragging ? 'is-dragging' : ''} ${hasText && !disabled ? 'is-draggable' : ''}`}
          width={PREVIEW_W}
          height={previewH}
          onPointerDown={onPointerDown}
          onPointerMove={(event) => {
            if (dragRef.current) moveTo(event.currentTarget, toCanvasPoint(event))
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
        />
        {hasText && (
          <p className="hint">
            미리보기에서 문구를 마우스로 끌어 원하는 위치에 놓을 수 있습니다.
            {overlays.length > 1 && ' 점선 상자를 누르면 그 문구가 선택됩니다.'}
          </p>
        )}
      </div>
    </section>
  )
}
