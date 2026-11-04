import { useEffect, useRef, useState, type DragEvent } from 'react'
import { MAX_FRAMES } from '../lib/format'
import {
  captureTimes,
  captureVideoFrames,
  isVideoFile,
  VIDEO_ACCEPT,
} from '../lib/video'
import type { Frame } from '../types'

type VideoCaptureProps = {
  disabled?: boolean
  onCaptured: (frames: Frame[], fps: number) => void
}

const FPS_OPTIONS = [5, 8, 10, 15, 20]

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00.0'
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

export function VideoCapture({ disabled, onCaptured }: VideoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [fps, setFps] = useState(10)
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  useEffect(() => () => abortRef.current?.abort(), [])

  const loadFile = (next: File) => {
    if (!isVideoFile(next)) {
      setError('동영상 파일(MP4, WEBM, MOV)을 올려 주세요.')
      return
    }
    setError(null)
    setFile(next)
    setDuration(0)
    setStart(0)
    setEnd(0)
    setCurrent(0)
    setUrl(URL.createObjectURL(next))
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    const next = event.dataTransfer.files[0]
    if (next && !disabled) loadFile(next)
  }

  const times = duration > 0 ? captureTimes(start, end, fps, MAX_FRAMES) : []
  const wanted = duration > 0 ? Math.floor(Math.max(0, end - start) * fps) + 1 : 0
  const capped = wanted > MAX_FRAMES
  const capturing = progress !== null

  const capture = async () => {
    const video = videoRef.current
    if (!video || !file || times.length === 0) return
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setProgress({ current: 0, total: times.length })
    try {
      const frames = await captureVideoFrames({
        video,
        times,
        baseName: file.name.replace(/\.[^.]+$/, ''),
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ current: done, total }),
      })
      onCaptured(frames, capped ? (times.length - 1) / Math.max(0.1, end - start) : fps)
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
        setError('프레임을 캡처하지 못했습니다. 다른 동영상으로 시도해 주세요.')
      }
    } finally {
      setProgress(null)
      abortRef.current = null
    }
  }

  const busy = disabled || capturing
  const percent = progress ? Math.round((progress.current / progress.total) * 100) : 0

  if (!url) {
    return (
      <section
        className={`dropzone ${dragActive ? 'is-active' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={VIDEO_ACCEPT}
          onChange={(event) => {
            const next = event.target.files?.[0]
            if (next) loadFile(next)
            event.target.value = ''
          }}
        />
        <div className="dropzone-mark is-video" aria-hidden="true">
          <span />
        </div>
        <div className="dropzone-copy">
          <p className="dropzone-title">동영상을 올리고 원하는 구간만 GIF로</p>
          <p className="dropzone-help">MP4, WEBM, MOV · 시작/끝 지점과 초당 프레임 수를 고르면 자동으로 캡처합니다</p>
          {error && <p className="error inline-error">{error}</p>}
        </div>
        <div className="dropzone-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            동영상 선택
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel video-panel">
      <div className="panel-head">
        <div>
          <p className="kicker">동영상</p>
          <h2>구간 캡처</h2>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => {
            setUrl(null)
            setFile(null)
          }}
        >
          다른 동영상
        </button>
      </div>

      <div className="video-layout">
        <div className="video-stage">
          <video
            ref={videoRef}
            src={url}
            controls={!capturing}
            playsInline
            muted
            preload="auto"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget
              const apply = (d: number) => {
                setDuration(d)
                setStart(0)
                setEnd(Math.min(d, 3))
              }
              if (Number.isFinite(video.duration)) {
                apply(video.duration)
                return
              }
              const onDuration = () => {
                if (!Number.isFinite(video.duration)) return
                video.removeEventListener('durationchange', onDuration)
                video.currentTime = 0
                apply(video.duration)
              }
              video.addEventListener('durationchange', onDuration)
              video.currentTime = Number.MAX_SAFE_INTEGER
            }}
            onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
            onError={() =>
              setError('이 동영상은 브라우저에서 열 수 없습니다. MP4(H.264)나 WEBM 파일로 시도해 주세요.')
            }
          />
          <div className="timeline" aria-hidden="true">
            <span
              className="timeline-range"
              style={{
                left: `${duration ? (start / duration) * 100 : 0}%`,
                width: `${duration ? ((end - start) / duration) * 100 : 0}%`,
              }}
            />
            <span
              className="timeline-head"
              style={{ left: `${duration ? (current / duration) * 100 : 0}%` }}
            />
          </div>
          <p className="video-meta">
            {file?.name} · 전체 {formatTime(duration)} · 현재 {formatTime(current)}
          </p>
        </div>

        <div className="video-controls">
          <label className="field">
            <span className="field-label">
              시작 <em>{formatTime(start)}</em>
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.05}
              disabled={busy || !duration}
              value={start}
              onChange={(event) => {
                const value = Number(event.target.value)
                setStart(Math.min(value, end))
                if (videoRef.current) videoRef.current.currentTime = value
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">
              끝 <em>{formatTime(end)}</em>
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.05}
              disabled={busy || !duration}
              value={end}
              onChange={(event) => {
                const value = Number(event.target.value)
                setEnd(Math.max(value, start))
                if (videoRef.current) videoRef.current.currentTime = value
              }}
            />
          </label>
          <div className="chip-row">
            <button
              type="button"
              className="chip"
              disabled={busy || !duration}
              onClick={() => setStart(Math.min(current, end))}
            >
              현재 위치를 시작으로
            </button>
            <button
              type="button"
              className="chip"
              disabled={busy || !duration}
              onClick={() => setEnd(Math.max(current, start))}
            >
              현재 위치를 끝으로
            </button>
          </div>

          <fieldset className="field">
            <legend className="field-label">
              초당 프레임 <em>{fps} fps</em>
            </legend>
            <div className="chip-row">
              {FPS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip ${fps === option ? 'is-on' : ''}`}
                  disabled={busy}
                  onClick={() => setFps(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="summary">
            구간 {(end - start).toFixed(1)}초 → {times.length}프레임 캡처
            {capped && ` (최대 ${MAX_FRAMES}장으로 간격을 넓혀 캡처)`}
          </p>

          {capturing ? (
            <div className="progress-inline" role="status" aria-live="polite">
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
              <p className="progress-meta">
                캡처 중 {percent}% · {progress.current} / {progress.total}
              </p>
              <button type="button" className="btn btn-ghost" onClick={() => abortRef.current?.abort()}>
                캡처 취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={busy || times.length === 0 || end <= start}
              onClick={() => void capture()}
            >
              구간 프레임 캡처
            </button>
          )}
          {error && <p className="error">{error}</p>}
          <p className="hint">캡처한 프레임은 아래 재생 순서에 들어가고, 재생 속도가 캡처 fps에 맞춰집니다.</p>
        </div>
      </div>
    </section>
  )
}
