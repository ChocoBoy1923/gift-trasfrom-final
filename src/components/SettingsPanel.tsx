import type { GifSettings } from '../types'
import { delayToFps } from '../lib/format'

type SettingsPanelProps = {
  settings: GifSettings
  disabled?: boolean
  onChange: (next: GifSettings) => void
}

export function SettingsPanel({ settings, disabled, onChange }: SettingsPanelProps) {
  const set = <K extends keyof GifSettings>(key: K, value: GifSettings[K]) => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <p className="kicker">설정</p>
        <h2>GIF 옵션</h2>
      </div>

      <label className="field">
        <span className="field-label">
          재생 속도
          <em>
            {settings.delayMs}ms · {delayToFps(settings.delayMs)}
          </em>
        </span>
        <input
          type="range"
          min={40}
          max={1500}
          step={10}
          disabled={disabled}
          value={settings.delayMs}
          onChange={(event) => set('delayMs', Number(event.target.value))}
        />
        <div className="chip-row">
          {[
            { label: '빠르게', value: 60 },
            { label: '보통', value: 120 },
            { label: '느리게', value: 280 },
            { label: '슬라이드', value: 1000 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`chip ${settings.delayMs === preset.value ? 'is-on' : ''}`}
              disabled={disabled}
              onClick={() => set('delayMs', preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </label>

      <fieldset className="field">
        <legend className="field-label">반복</legend>
        <div className="chip-row">
          {(
            [
              ['infinite', '무한'],
              ['once', '1회'],
              ['count', '횟수 지정'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`chip ${settings.loopMode === mode ? 'is-on' : ''}`}
              disabled={disabled}
              onClick={() => set('loopMode', mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {settings.loopMode === 'count' && (
          <label className="inline-num">
            재생 횟수
            <input
              type="number"
              min={2}
              max={99}
              disabled={disabled}
              value={settings.loopCount}
              onChange={(event) =>
                set('loopCount', Math.max(2, Number(event.target.value) || 2))
              }
            />
          </label>
        )}
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">재생 방향</legend>
        <div className="chip-row">
          {(
            [
              ['forward', '정방향'],
              ['reverse', '역재생'],
              ['pingpong', '부메랑'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`chip ${settings.playback === mode ? 'is-on' : ''}`}
              disabled={disabled}
              onClick={() => set('playback', mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">출력 너비</legend>
        <div className="chip-row">
          {(
            [
              ['original', '원본'],
              ['320', '320'],
              ['480', '480'],
              ['640', '640'],
              ['800', '800'],
              ['custom', '직접'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`chip ${settings.widthMode === mode ? 'is-on' : ''}`}
              disabled={disabled}
              onClick={() => set('widthMode', mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {settings.widthMode === 'custom' && (
          <label className="inline-num">
            px
            <input
              type="number"
              min={16}
              max={1280}
              disabled={disabled}
              value={settings.customWidth}
              onChange={(event) =>
                set('customWidth', Math.max(16, Number(event.target.value) || 16))
              }
            />
          </label>
        )}
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">프레임 맞춤</legend>
        <div className="chip-row">
          {(
            [
              ['contain', '맞춤'],
              ['cover', '채우기'],
              ['stretch', '늘리기'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`chip ${settings.fit === mode ? 'is-on' : ''}`}
              disabled={disabled}
              onClick={() => set('fit', mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-num">
          배경색
          <input
            type="color"
            disabled={disabled}
            value={settings.background}
            onChange={(event) => set('background', event.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">화질</legend>
        <div className="chip-row">
          {(
            [
              ['max', '최고'],
              ['high', '높음'],
              ['medium', '보통'],
              ['small', '용량 절약'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`chip ${settings.quality === mode ? 'is-on' : ''}`}
              disabled={disabled}
              onClick={() => set('quality', mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="hold-grid">
        <label className="field">
          <span className="field-label">
            첫 프레임 유지 <em>{settings.firstHoldMs}ms</em>
          </span>
          <input
            type="range"
            min={0}
            max={2000}
            step={50}
            disabled={disabled}
            value={settings.firstHoldMs}
            onChange={(event) => set('firstHoldMs', Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span className="field-label">
            마지막 프레임 유지 <em>{settings.lastHoldMs}ms</em>
          </span>
          <input
            type="range"
            min={0}
            max={2000}
            step={50}
            disabled={disabled}
            value={settings.lastHoldMs}
            onChange={(event) => set('lastHoldMs', Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  )
}
