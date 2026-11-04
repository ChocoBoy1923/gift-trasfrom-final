import { useEffect, useState, type DragEvent } from 'react'
import { MAX_FRAME_DELAY_MS, MIN_FRAME_DELAY_MS } from '../lib/format'
import type { Frame } from '../types'

type FrameStripProps = {
  frames: Frame[]
  defaultDelayMs: number
  disabled?: boolean
  onReorder: (from: number, to: number) => void
  onRemove: (id: string) => void
  onReverse: () => void
  onClear: () => void
  onDelayChange: (id: string, delayMs: number | undefined) => void
  onResetDelays: () => void
}

function toSeconds(ms: number): string {
  return String(Math.round(ms / 10) / 100)
}

function DelayInput({
  frame,
  defaultDelayMs,
  disabled,
  onChange,
}: {
  frame: Frame
  defaultDelayMs: number
  disabled?: boolean
  onChange: (delayMs: number | undefined) => void
}) {
  const [draft, setDraft] = useState(frame.delayMs === undefined ? '' : toSeconds(frame.delayMs))

  useEffect(() => {
    setDraft(frame.delayMs === undefined ? '' : toSeconds(frame.delayMs))
  }, [frame.delayMs])

  const parse = (value: string): number | undefined | null => {
    if (value.trim() === '') return undefined
    const seconds = Number(value)
    if (!Number.isFinite(seconds) || seconds <= 0) return null
    return Math.min(MAX_FRAME_DELAY_MS, Math.max(MIN_FRAME_DELAY_MS, Math.round(seconds * 1000)))
  }

  const edit = (value: string) => {
    setDraft(value)
    const ms = parse(value)
    if (ms !== null && ms !== frame.delayMs) onChange(ms)
  }

  const normalize = () => {
    setDraft(frame.delayMs === undefined ? '' : toSeconds(frame.delayMs))
  }

  const custom = frame.delayMs !== undefined

  return (
    <div className={`cell-delay ${custom ? 'is-custom' : ''}`}>
      <label>
        <span>시간</span>
        <input
          type="number"
          inputMode="decimal"
          min={MIN_FRAME_DELAY_MS / 1000}
          max={MAX_FRAME_DELAY_MS / 1000}
          step={0.1}
          placeholder={toSeconds(defaultDelayMs)}
          value={draft}
          disabled={disabled}
          aria-label={`${frame.name} 표시 시간(초)`}
          onChange={(event) => edit(event.target.value)}
          onBlur={normalize}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          onDragStart={(event) => event.preventDefault()}
        />
        <span>초</span>
      </label>
      {custom && (
        <button
          type="button"
          className="cell-delay-reset"
          disabled={disabled}
          title="기본 속도로 되돌리기"
          aria-label={`${frame.name} 시간을 기본 속도로`}
          onClick={() => onChange(undefined)}
        >
          ↺
        </button>
      )}
    </div>
  )
}

export function FrameStrip({
  frames,
  defaultDelayMs,
  disabled,
  onReorder,
  onRemove,
  onReverse,
  onClear,
  onDelayChange,
  onResetDelays,
}: FrameStripProps) {
  const customCount = frames.filter((frame) => frame.delayMs !== undefined).length
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const onDragStart = (event: DragEvent<HTMLElement>, index: number) => {
    if (disabled) return
    setDragIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  const onDragOver = (event: DragEvent<HTMLElement>, index: number) => {
    event.preventDefault()
    if (disabled || dragIndex === null) return
    setOverIndex(index)
  }

  const onDrop = (event: DragEvent<HTMLElement>, index: number) => {
    event.preventDefault()
    if (dragIndex !== null) onReorder(dragIndex, index)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <section className="strip-wrap">
      <div className="strip-head">
        <div>
          <p className="kicker">프레임</p>
          <h2>재생 순서</h2>
          <p className="strip-hint">
            장마다 표시 시간을 초 단위로 정할 수 있어요. 비워 두면 기본 속도({toSeconds(defaultDelayMs)}초)를 따릅니다.
          </p>
        </div>
        <div className="strip-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={disabled || customCount === 0}
            onClick={onResetDelays}
          >
            시간 모두 기본으로
          </button>
          <button type="button" className="btn btn-ghost" disabled={disabled || frames.length < 2} onClick={onReverse}>
            순서 반전
          </button>
          <button type="button" className="btn btn-ghost danger" disabled={disabled || frames.length === 0} onClick={onClear}>
            전체 삭제
          </button>
        </div>
      </div>

      <div className="film" role="list">
        <div className="sprockets" aria-hidden="true" />
        <div className="film-track">
          {frames.map((frame, index) => (
            <article
              key={frame.id}
              role="listitem"
              className={`cell ${dragIndex === index ? 'is-dragging' : ''} ${overIndex === index ? 'is-over' : ''}`}
              draggable={!disabled}
              onDragStart={(event) => onDragStart(event, index)}
              onDragOver={(event) => onDragOver(event, index)}
              onDragLeave={() => setOverIndex(null)}
              onDrop={(event) => onDrop(event, index)}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
            >
              <div className="cell-num">{String(index + 1).padStart(2, '0')}</div>
              <div className="cell-thumb">
                <img src={frame.url} alt={frame.name} draggable={false} />
              </div>
              <p className="cell-name" title={frame.name}>
                {frame.name}
              </p>
              <DelayInput
                frame={frame}
                defaultDelayMs={defaultDelayMs}
                disabled={disabled}
                onChange={(delayMs) => onDelayChange(frame.id, delayMs)}
              />
              <div className="cell-tools">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={disabled || index === 0}
                  aria-label="왼쪽으로 이동"
                  onClick={() => onReorder(index, index - 1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={disabled || index === frames.length - 1}
                  aria-label="오른쪽으로 이동"
                  onClick={() => onReorder(index, index + 1)}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  disabled={disabled}
                  aria-label={`${frame.name} 삭제`}
                  onClick={() => onRemove(frame.id)}
                >
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="sprockets" aria-hidden="true" />
      </div>
    </section>
  )
}
