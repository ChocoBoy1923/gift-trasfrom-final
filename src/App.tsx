import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import kmouEmblem from './assets/kmou-emblem.png'
import kmouLogo from './assets/kmou-logo.png'
import { DropZone } from './components/DropZone'
import { FrameStrip } from './components/FrameStrip'
import { PreviewPanel } from './components/PreviewPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { TextPanel } from './components/TextPanel'
import { EditorTools } from './components/EditorTools'
import { reduceFrames, transformFrames } from './lib/editor'
import { useEditor } from './lib/useEditor'
import { VideoCapture } from './components/VideoCapture'
import { encodeGif } from './lib/encodeGif'
import {
  downloadFileName,
  estimateDurationMs,
  formatDuration,
  playbackFrameCount,
  reorder,
  resolveOutputSize,
} from './lib/format'
import { createDemoFrames, filesToFrames } from './lib/images'
import { createTextOverlay } from './lib/render'
import type {
  EncodeProgress,
  Frame,
  GifResult,
  GifSettings,
} from './types'

const KMOU_URL = 'https://www.kmou.ac.kr/kmou/main.do'

const DEFAULT_SETTINGS: GifSettings = {
  delayMs: 120,
  loopMode: 'infinite',
  loopCount: 3,
  widthMode: '480',
  customWidth: 480,
  fit: 'contain',
  background: '#ffffff',
  quality: 'high',
  playback: 'forward',
  firstHoldMs: 0,
  lastHoldMs: 0,
}

export default function App() {
  const initialDocument = useMemo(() => ({ frames: [], settings: DEFAULT_SETTINGS, overlays: [createTextOverlay()] }), [])
  const { frames, setFrames, settings, setSettings, overlays, setOverlays, undo, redo, canUndo, canRedo } = useEditor(initialDocument)
  const [working, setWorking] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const importLock = useRef(false)
  const [tab, setTab] = useState<'image' | 'video'>('image')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<EncodeProgress | null>(null)
  const [result, setResult] = useState<GifResult | null>(null)
  const busy = generating || working || capturing
  const abortRef = useRef<AbortController | null>(null)
  const framesRef = useRef(frames)
  framesRef.current = frames

  const clearResult = useCallback(() => {
    setResult((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return null
    })
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (importLock.current) return
      importLock.current = true
      setWorking(true)
      setError(null)
      try {
        const { frames: next, skipped, truncated, errors } = await filesToFrames(
          files,
          framesRef.current.length,
        )
        if (next.length === 0 && skipped === 0 && truncated === 0 && errors.length === 0) {
          setNotice('이미지 파일을 찾지 못했습니다.')
          return
        }
        if (next.length) {
          setFrames((current) => [...current, ...next])
          clearResult()
        }
        const messages = [...errors]
        if (skipped) messages.push(`이미지가 아닌 파일 ${skipped}개를 건너뛰었습니다.`)
        if (truncated) messages.push(`최대 300프레임 한도로 파일 ${truncated}개를 제외했습니다.`)
        setNotice(messages.length ? messages.join(' ') : null)
      } catch {
        setError('이미지나 GIF를 불러오지 못했습니다. 다른 파일로 다시 시도해 주세요.')
      } finally {
        importLock.current = false
        setWorking(false)
      }
    },
    [clearResult, setFrames],
  )

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length > 0 && !busy) {
        event.preventDefault()
        void addFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles, busy])

  const removeFrame = (id: string) => {
    setFrames((current) => {
      return current.filter((frame) => frame.id !== id)
    })
    clearResult()
  }

  const clearFrames = () => {
    setFrames([])
    clearResult()
    setNotice(null)
  }

  const outputSize = useMemo(
    () => resolveOutputSize(frames, settings),
    [frames, settings],
  )

  const summary = useMemo(() => {
    if (frames.length === 0) return '이미지를 올리면 출력 크기와 길이가 여기에 표시됩니다.'
    const count = playbackFrameCount(frames.length, settings.playback)
    const duration = estimateDurationMs(frames, settings)
    const loop =
      settings.loopMode === 'infinite'
        ? '무한 반복'
        : settings.loopMode === 'once'
          ? '1회 재생'
          : `${settings.loopCount}회 재생`
    return `${outputSize.width} × ${outputSize.height} · ${frames.length}장 → ${count}프레임 · ${formatDuration(duration)} · ${loop}`
  }, [frames, outputSize.height, outputSize.width, settings])

  const generate = async () => {
    if (frames.length === 0 || busy) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    setError(null)
    setNotice(null)
    setProgress({ current: 0, total: playbackFrameCount(frames.length, settings.playback) })
    clearResult()

    try {
      const next = await encodeGif({
        frames,
        settings,
        overlays,
        width: outputSize.width,
        height: outputSize.height,
        signal: controller.signal,
        onProgress: (current, total) => setProgress({ current, total }),
      })
      if (!controller.signal.aborted) setResult(next)
      else URL.revokeObjectURL(next.url)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setError('GIF를 만들지 못했습니다. 이미지 수나 크기를 줄여 다시 시도해 주세요.')
    } finally {
      setGenerating(false)
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    setProgress(null)
  }

  const download = () => {
    if (!result) return
    const link = document.createElement('a')
    link.href = result.url
    link.download = downloadFileName()
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const loadDemoWithText = async () => {
    setWorking(true)
    try {
      const demo = await createDemoFrames()
      setFrames(demo)
      setOverlays((current) => {
        const [first, ...rest] = current
        if (!first || current.some((overlay) => overlay.text)) return current
        return [{ ...first, text: '해양대 GIF 스튜디오', animation: 'typing' }, ...rest]
      })
      clearResult()
      setNotice('샘플 프레임 6장을 넣었습니다. 바로 생성해 보세요.')
    } catch { setError('샘플 이미지를 만들지 못했습니다. 다시 시도해 주세요.') }
    finally { setWorking(false) }
  }

  const onVideoCaptured = (captured: Frame[], fps: number) => {
    setFrames(captured)
    setSettings((current) => ({ ...current, delayMs: Math.max(20, Math.round(1000 / fps)) }))
    clearResult()
    setNotice(`동영상에서 ${captured.length}프레임을 캡처했습니다. 재생 속도를 ${fps.toFixed(1)} fps에 맞췄습니다.`)
  }

  useEffect(() => {
    setSelected(current => {
      const next = new Set([...current].filter(id => frames.some(frame => frame.id === id)))
      return next.size === current.size ? current : next
    })
  }, [frames])

  const restore = (action: () => void) => { action(); clearResult(); setSelected(new Set()) }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (busy || target.closest('input,textarea,select,[contenteditable=true]') || !(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault(); (event.shiftKey ? redo : undo)(); clearResult(); setSelected(new Set())
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [busy, undo, redo, clearResult])

  const transform = async (action: 'left' | 'right' | 'flip') => {
    setWorking(true); setError(null)
    try {
      const changed = await transformFrames(frames.filter(frame => !selected.size || selected.has(frame.id)), action)
      const byId = new Map(changed.map(frame => [frame.id, frame]))
      setFrames(current => current.map(frame => byId.get(frame.id) ?? frame))
      clearResult()
    } catch { setError('프레임 변환에 실패했습니다. 이미지 크기를 줄여 다시 시도해 주세요.') }
    finally { setWorking(false) }
  }

  return (
    <div
      className="page"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        if (!busy && tab === 'image' && event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files)
      }}
    >
      <header className="site-header">
        <div className="site-header-inner">
          <a
            className="kmou-logo"
            href={KMOU_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="국립한국해양대학교 홈페이지로 이동"
          >
            <img src={kmouLogo} alt="국립한국해양대학교" />
          </a>
          <a className="site-link" href={KMOU_URL} target="_blank" rel="noopener noreferrer">
            학교 홈페이지 ↗
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <p className="hero-kicker">KMOU GIF STUDIO</p>
          <h1>해양대 GIF 스튜디오</h1>
          <p className="hero-copy">
            이미지·영상·기존 GIF를 하나로. 회전, 프레임 편집과 용량 최적화까지. 변환은 이 브라우저에서만 이뤄집니다.
          </p>
        </div>
        <svg className="waves" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path className="wave wave-back" d="M0 64c120 28 240 42 360 34S600 50 720 46s240 18 360 30 240 10 360-8v48H0Z" />
          <path className="wave wave-mid" d="M0 80c140-24 280-30 420-14s260 36 400 30 280-34 420-36 160 10 200 18v42H0Z" />
          <path className="wave wave-front" d="M0 96c160 14 320 18 480 6s300-26 460-22 340 22 500 16v24H0Z" />
        </svg>
      </section>

      <main className="app">
        <div className="tabs" role="tablist" aria-label="만들기 방식">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'image'}
            className={`tab ${tab === 'image' ? 'is-on' : ''}`}
            disabled={busy}
            onClick={() => setTab('image')}
          >
            이미지·GIF 편집
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'video'}
            className={`tab ${tab === 'video' ? 'is-on' : ''}`}
            disabled={busy}
            onClick={() => setTab('video')}
          >
            동영상 → GIF
          </button>
        </div>

      {tab === 'image' ? (
        <DropZone
          compact={frames.length > 0}
          disabled={busy}
          onFiles={addFiles}
          onDemo={() => void loadDemoWithText()}
        />
      ) : (
        <VideoCapture disabled={busy} onBusyChange={setCapturing} onCaptured={onVideoCaptured} />
      )}

      {working && <p className="notice" role="status">파일을 처리하고 있습니다. 잠시 기다려 주세요.</p>}
      <EditorTools frames={frames} selected={new Set([...selected].filter(id => frames.some(frame => frame.id === id)))} disabled={busy}
        canUndo={canUndo} canRedo={canRedo} onUndo={() => restore(undo)} onRedo={() => restore(redo)}
        onTransform={action => void transform(action)} settings={settings}
        onSettings={next => { setSettings(next); clearResult() }}
        onOptimize={() => { setSettings(current => ({ ...current, widthMode: '320', quality: 'small' })); clearResult(); setNotice('320px / 64색을 적용했습니다. GIF를 생성하여 실제 용량을 확인하세요.') }}
        onReduce={() => { setFrames(current => reduceFrames(current, settings)); clearResult(); setSelected(new Set()) }}
        onSelectAll={() => setSelected(selected.size === frames.length ? new Set() : new Set(frames.map(frame => frame.id)))}
        onDelete={() => { setFrames(current => current.filter(frame => !selected.has(frame.id))); clearResult(); setSelected(new Set()) }} />
      {notice && <p className="notice">{notice}</p>}

      {frames.length > 0 && (
        <FrameStrip
          frames={frames}
          selected={selected}
          onToggle={id => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })}
          defaultDelayMs={settings.delayMs}
          disabled={busy}
          onDelayChange={(id, delayMs) => {
            setFrames((current) =>
              current.map((frame) => (frame.id === id ? { ...frame, delayMs } : frame)),
            )
            clearResult()
          }}
          onResetDelays={() => {
            setFrames((current) => current.map((frame) => ({ ...frame, delayMs: undefined })))
            clearResult()
          }}
          onReorder={(from, to) => {
            setFrames((current) => reorder(current, from, to))
            clearResult()
          }}
          onRemove={removeFrame}
          onReverse={() => {
            setFrames((current) => [...current].reverse())
            clearResult()
          }}
          onClear={clearFrames}
        />
      )}

      <TextPanel
        overlays={overlays}
        frames={frames}
        settings={settings}
        outputSize={outputSize}
        disabled={busy}
        onChange={(next) => {
          setOverlays(next)
          clearResult()
        }}
      />

      <div className="workspace">
        <PreviewPanel
          canGenerate={frames.length > 0 && !busy}
          generating={generating}
          progress={progress}
          result={result}
          summary={summary}
          error={error}
          onGenerate={() => void generate()}
          onCancel={cancel}
          onDownload={download}
        />
        <SettingsPanel
          settings={settings}
          disabled={busy}
          onChange={(next) => {
            setSettings(next)
            clearResult()
          }}
        />
      </div>
      </main>

      <footer className="site-footer">
        <a href={KMOU_URL} target="_blank" rel="noopener noreferrer">
          <img src={kmouEmblem} alt="" />
          National Korea Maritime &amp; Ocean University
        </a>
      </footer>
    </div>
  )
}
