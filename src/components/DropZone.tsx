import { useRef, useState, type DragEvent } from 'react'
import { ACCEPT_ATTR } from '../lib/format'

type DropZoneProps = {
  compact?: boolean
  disabled?: boolean
  onFiles: (files: FileList | File[]) => void
  onDemo: () => void
}

export function DropZone({ compact, disabled, onFiles, onDemo }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(false)
  const dragCount = useRef(0)

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    dragCount.current += 1
    setActive(true)
  }

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    dragCount.current -= 1
    if (dragCount.current <= 0) {
      dragCount.current = 0
      setActive(false)
    }
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    dragCount.current = 0
    setActive(false)
    if (disabled) return
    if (event.dataTransfer.files.length > 0) {
      event.stopPropagation()
      onFiles(event.dataTransfer.files)
    }
  }

  return (
    <section
      className={`dropzone ${compact ? 'is-compact' : ''} ${active ? 'is-active' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        disabled={disabled}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <div className="dropzone-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="dropzone-copy">
        <p className="dropzone-title">
          {compact ? '이미지·GIF를 추가하여 이어 붙이세요' : '이미지·GIF를 여기에 놓거나 선택하세요'}
        </p>
        <p className="dropzone-help">
          {compact
            ? '드래그 앤 드롭 또는 파일 선택 · JPG PNG WEBP GIF'
            : 'JPG, PNG, WEBP, GIF, BMP, AVIF · 여러 GIF 이어 붙이기 · 최대 300프레임'}
        </p>
        <p className="hint">GIF는 파일당 64MB까지 지원합니다. 큰 GIF는 편집 성능을 위해 최대 800px로 축소하며, 투명 영역은 출력 배경색으로 저장합니다.</p>
      </div>
      <div className="dropzone-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {compact ? '이미지·GIF 추가' : '이미지·GIF 선택'}
        </button>
        {!compact && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={disabled}
            onClick={onDemo}
          >
            샘플로 체험
          </button>
        )}
      </div>
    </section>
  )
}
