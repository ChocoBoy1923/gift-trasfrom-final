import { GIFEncoder } from 'gifenc'
import { decodeGif } from '../src/lib/decodeGif'
import { filesToFrames, revokeFrames } from '../src/lib/images'
import { reduceFrames, transformFrames } from '../src/lib/editor'
import { estimateDurationMs, playbackSequence, resolveOutputSize } from '../src/lib/format'
import { captureTimes } from '../src/lib/video'
import { encodeGif } from '../src/lib/encodeGif'
import type { Frame, GifSettings } from '../src/types'

const results: string[] = []
const resources: Frame[] = []
const settings: GifSettings = { delayMs: 120, loopMode: 'infinite', loopCount: 3, widthMode: 'original', customWidth: 480,
  fit: 'contain', background: '#ffffff', quality: 'small', playback: 'forward', firstHoldMs: 0, lastHoldMs: 0 }
function assert(ok: boolean, message: string) { if (!ok) throw new Error(message) }
async function check(name: string, fn: () => void | Promise<void>) { await fn(); results.push(`PASS ${name}`) }
function fixture(dispose = 3) {
  const gif = GIFEncoder()
  const palette = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]]
  for (const [i, pixels] of [[1, 0, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0], [0, 0, 3, 0, 0, 0]].entries()) {
    gif.writeFrame(new Uint8Array(pixels), 3, 2, { palette, transparent: true, transparentIndex: 0,
      dispose: i === 1 ? dispose : 1, delay: [60, 140, 200][i], repeat: 0 })
  }
  gif.finish()
  return new File([new Uint8Array(gif.bytes()).buffer], 'fixture.gif', { type: 'image/gif' })
}
function pixel(frame: Frame, x: number, y = 0) {
  const canvas = document.createElement('canvas'); canvas.width = frame.width; canvas.height = frame.height
  const ctx = canvas.getContext('2d')!; ctx.drawImage(frame.image, 0, 0)
  return Array.from(ctx.getImageData(x, y, 1, 1).data).join(',')
}

try {
  const file = fixture()
  const frames = await decodeGif(file, 300); resources.push(...frames)
  await check('GIF frame count and source delays', () => {
    assert(frames.length === 3, 'frame count'); assert(frames.map(f => f.delayMs).join(',') === '60,140,200', 'source delays')
  })
  await check('Transparent overlay and restore-previous disposal', () => {
    assert(pixel(frames[1], 0) === '255,0,0,255', 'prior red must remain')
    assert(pixel(frames[1], 1) === '0,255,0,255', 'green overlay')
    assert(pixel(frames[2], 0) === '255,0,0,255', 'restore previous red')
    assert(pixel(frames[2], 1) === '0,0,0,0', 'green must be removed')
    assert(pixel(frames[2], 2) === '0,0,255,255', 'blue overlay')
  })
  await check('Restore-background disposal', async () => {
    const cleared = await decodeGif(fixture(2), 300); resources.push(...cleared)
    assert(pixel(cleared[2], 0) === '0,0,0,0', 'background cleared')
  })
  await check('Concatenate multiple GIFs in file order', async () => {
    const merged = await filesToFrames([file, file], 0); resources.push(...merged.frames)
    assert(merged.frames.length === 6, 'all GIF frames retained')
    assert(merged.frames.map(f => f.delayMs).join(',') === '60,140,200,60,140,200', 'order and timing')
  })
  await check('Reject over-limit GIF as a whole', async () => {
    const rejected = await filesToFrames([file], 299)
    assert(rejected.frames.length === 0 && rejected.errors.length === 1, 'must report overflow')
  })
  await check('Rotation and horizontal flip preserve pixels and timing', async () => {
    const right = await transformFrames(frames, 'right'); resources.push(...right)
    assert(right[0].width === 2 && right[0].height === 3, 'rotated dimensions')
    assert(pixel(right[0], 1) === '255,0,0,255', 'rotation pixel')
    const flip = await transformFrames(frames, 'flip'); resources.push(...flip)
    assert(pixel(flip[0], 2) === '255,0,0,255', 'flip pixel')
    assert(flip[1].delayMs === 140 && flip[1].id === frames[1].id, 'identity and delay')
  })
  await check('Frame reduction retains duration, including odd final frame', () => {
    const reduced = reduceFrames(frames, settings)
    assert(reduced.length === 2, 'half frames')
    assert(estimateDurationMs(reduced, settings) === 400, 'timeline duration')
  })
  await check('Reverse and ping-pong timeline', () => {
    assert(playbackSequence(frames, 'reverse').map(f => f.delayMs).join(',') === '200,140,60', 'reverse')
    assert(playbackSequence(frames, 'pingpong').map(f => f.delayMs).join(',') === '60,140,200,140', 'ping-pong')
  })
  await check('Trim captures within selected interval without extra endpoint frame', () => {
    const times = captureTimes(2, 5, 10, 300)
    assert(times.length === 30 && times[0] === 2 && times.at(-1)! < 5, 'trim bounds')
    assert(captureTimes(0, 0, 10, 300).length === 0, 'empty interval')
  })
  await check('Bound tall output dimensions', () => {
    const size = resolveOutputSize([{ ...frames[0], width: 100, height: 10000 }], { ...settings, widthMode: '800' })
    assert(size.width <= 1280 && size.height <= 1280, 'output size cap')
  })
  await check('Encode, reimport and verify reverse timing', async () => {
    const encoded = await encodeGif({ frames, settings: { ...settings, playback: 'reverse' }, overlays: [], width: 3, height: 2, onProgress: () => {} })
    const imported = await decodeGif(new File([encoded.blob], 'roundtrip.gif'), 300); resources.push(...imported)
    URL.revokeObjectURL(encoded.url)
    assert(imported.map(f => f.delayMs).join(',') === '200,140,60', 'roundtrip delays')
    assert(pixel(imported[0], 2) === '0,0,255,255', 'exported reverse first frame')
  })
  results.push(`\n${results.length} checks passed`)
} catch (error) { results.push(`FAIL ${error instanceof Error ? error.stack : error}`) }
finally { revokeFrames(resources); document.querySelector('#results')!.textContent = results.join('\n') }
