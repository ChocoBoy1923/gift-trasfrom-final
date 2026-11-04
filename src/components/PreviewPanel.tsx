import type { EncodeProgress, GifResult } from '../types'
import { formatBytes, formatDuration } from '../lib/format'

type PreviewPanelProps = {
  canGenerate: boolean
  generating: boolean
  progress: EncodeProgress | null
  result: GifResult | null
  summary: string
  error: string | null
  onGenerate: () => void
  onCancel: () => void
  onDownload: () => void
}

export function PreviewPanel({
  canGenerate,
  generating,
  progress,
  result,
  summary,
  error,
  onGenerate,
  onCancel,
  onDownload,
}: PreviewPanelProps) {
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <section className="preview">
      <div className="panel-head">
        <p className="kicker">출력</p>
        <h2>미리보기</h2>
      </div>

      <p className="summary">{summary}</p>

      <div className={`stage ${result ? 'has-gif' : ''}`}>
        {generating && (
          <div className="progress-card" role="status" aria-live="polite">
            <p className="progress-label">GIF 생성 중</p>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </div>
            <p className="progress-meta">
              {percent}% · 프레임 {Math.min(progress?.current ?? 0, progress?.total ?? 0)} /{' '}
              {progress?.total ?? 0}
            </p>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              취소
            </button>
          </div>
        )}

        {!generating && result && (
          <img className="gif" src={result.url} alt="생성된 GIF 미리보기" />
        )}

        {!generating && !result && (
          <p className="stage-empty">생성하면 이 자리에서 바로 재생됩니다.</p>
        )}
      </div>

      {result && !generating && (
        <p className="result-meta">
          {result.width} × {result.height} · {result.frameCount}프레임 ·{' '}
          {formatDuration(result.durationMs)} · {formatBytes(result.blob.size)}
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="preview-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!canGenerate || generating}
          onClick={onGenerate}
        >
          GIF 생성하기
        </button>
        <button
          type="button"
          className="btn btn-download btn-lg"
          disabled={!result || generating}
          onClick={onDownload}
        >
          GIF 다운로드
        </button>
      </div>
    </section>
  )
}
