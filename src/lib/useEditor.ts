import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import type { Frame, GifSettings, TextOverlay } from '../types'

type Document = { frames: Frame[]; settings: GifSettings; overlays: TextOverlay[] }
type History = { past: Document[]; present: Document; future: Document[]; key: string; time: number }
const LIMIT = 30
const HISTORY_PIXELS = 72000000

function boundHistory(history: History): History {
  const urls = new Set<string>()
  let pixels = 0
  const add = (doc: Document) => {
    for (const frame of doc.frames) {
      if (urls.has(frame.url)) continue
      urls.add(frame.url)
      pixels += frame.width * frame.height
    }
  }
  add(history.present)
  const retained: Document[] = []
  for (const doc of [...history.past].reverse()) {
    add(doc)
    if (pixels > HISTORY_PIXELS) break
    retained.unshift(doc)
  }
  return { ...history, past: retained }
}

export function useEditor(initial: Document) {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [], key: '', time: 0 })
  const resources = useRef(new Set<string>())
  useEffect(() => {
    const retained = new Set([...history.past, history.present, ...history.future]
      .flatMap(doc => doc.frames.map(frame => frame.url)))
    for (const url of resources.current) if (!retained.has(url)) URL.revokeObjectURL(url)
    resources.current = retained
  }, [history])
  useEffect(() => () => { for (const url of resources.current) URL.revokeObjectURL(url) }, [])

  const update = useCallback(<K extends keyof Document>(key: K, value: SetStateAction<Document[K]>) => {
    const now = Date.now()
    setHistory(current => {
      const next = typeof value === 'function'
        ? (value as (old: Document[K]) => Document[K])(current.present[key]) : value
      if (next === current.present[key]) return current
      const coalesce = key !== 'frames' && current.key === key && now - current.time < 500
      return boundHistory({
        past: coalesce ? current.past : [...current.past, current.present].slice(-LIMIT),
        present: { ...current.present, [key]: next }, future: [], key, time: now,
      })
    })
  }, [])
  const setFrames = useCallback((value: SetStateAction<Frame[]>) => update('frames', value), [update])
  const setSettings = useCallback((value: SetStateAction<GifSettings>) => update('settings', value), [update])
  const setOverlays = useCallback((value: SetStateAction<TextOverlay[]>) => update('overlays', value), [update])
  const undo = useCallback(() => setHistory(current => current.past.length ? {
    past: current.past.slice(0, -1), present: current.past.at(-1)!,
    future: [current.present, ...current.future], key: '', time: 0,
  } : current), [])
  const redo = useCallback(() => setHistory(current => current.future.length ? {
    past: [...current.past, current.present], present: current.future[0]!,
    future: current.future.slice(1), key: '', time: 0,
  } : current), [])
  return { ...history.present, setFrames, setSettings, setOverlays, undo, redo,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0 }
}
