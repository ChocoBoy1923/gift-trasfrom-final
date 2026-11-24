import type { Frame, GifSettings } from '../types'

type Props = {
  frames: Frame[]; selected: Set<string>; disabled: boolean; canUndo: boolean; canRedo: boolean
  onUndo: () => void; onRedo: () => void
  onTransform: (action: 'left' | 'right' | 'flip') => void
  onOptimize: () => void; onReduce: () => void; onSelectAll: () => void; onDelete: () => void
  settings: GifSettings; onSettings: (settings: GifSettings) => void
}

export function EditorTools(props: Props) {
  const { frames, selected, disabled, settings } = props
  return <section className="panel editor-tools" aria-label="GIF 편집 도구">
    <div className="panel-head">
      <div><p className="kicker">GIF EDITOR</p><h2>편집 도구</h2></div>
      <div className="chip-row">
        <button className="btn btn-ghost" disabled={disabled || !props.canUndo} onClick={props.onUndo}>실행 취소</button>
        <button className="btn btn-ghost" disabled={disabled || !props.canRedo} onClick={props.onRedo}>다시 실행</button>
      </div>
    </div>
    <p className="strip-hint">GIF를 여러 개 추가하면 파일 순서대로 이어 붙입니다. 프레임을 선택하면 해당 장면만, 선택하지 않으면 전체를 회전·반전합니다. 실행 취소는 최근 30단계까지 가능합니다.</p>
    <div className="editor-grid">
      <fieldset className="field"><legend className="field-label">회전·반전 · {selected.size ? `${selected.size}장 선택` : '전체 프레임'}</legend>
        <div className="chip-row">
          <button className="chip" disabled={disabled || !frames.length} onClick={() => props.onTransform('left')}>왼쪽 90°</button>
          <button className="chip" disabled={disabled || !frames.length} onClick={() => props.onTransform('right')}>오른쪽 90°</button>
          <button className="chip" disabled={disabled || !frames.length} onClick={() => props.onTransform('flip')}>좌우 반전</button>
        </div>
      </fieldset>
      <fieldset className="field"><legend className="field-label">재생 방향</legend>
        <div className="chip-row">{([['forward', '정방향'], ['reverse', '역재생'], ['pingpong', '왕복 재생']] as const).map(([mode, label]) =>
          <button key={mode} className={`chip ${settings.playback === mode ? 'is-on' : ''}`} aria-pressed={settings.playback === mode}
            disabled={disabled} onClick={() => props.onSettings({ ...settings, playback: mode })}>{label}</button>)}</div>
      </fieldset>
      <fieldset className="field"><legend className="field-label">프레임 선택</legend><div className="chip-row">
        <button className="chip" disabled={disabled || !frames.length} onClick={props.onSelectAll}>{selected.size === frames.length && frames.length ? '선택 해제' : '전체 선택'}</button>
        <button className="chip chip-danger" disabled={disabled || !selected.size} onClick={props.onDelete}>선택 프레임 삭제</button>
      </div></fieldset>
      <fieldset className="field"><legend className="field-label">용량 최적화</legend><div className="chip-row">
        <button className="chip" disabled={disabled || !frames.length} onClick={props.onOptimize}>작게 저장 · 320px / 64색</button>
        <button className="chip" disabled={disabled || frames.length < 2} onClick={props.onReduce}>프레임 절반으로</button>
      </div><p className="strip-hint">프레임을 줄여도 전체 재생 시간은 유지합니다. 결과 용량은 생성 후 확인할 수 있습니다.</p></fieldset>
    </div>
  </section>
}
