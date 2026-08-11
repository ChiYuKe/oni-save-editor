import { parseSave } from './save'

type ParseRequest = { buffer: ArrayBuffer }

// Save parsing walks the template directory and every object group. Keep it
// off the UI thread just like the browser editor architecture so opening a
// large colony does not stall WebView2's input or WebGL compositor.
self.onmessage = (event: MessageEvent<ParseRequest>) => {
  try {
    const parsed = parseSave(new Uint8Array(event.data.buffer))
    self.postMessage({ ok: true, save: parsed })
  } catch (cause) {
    self.postMessage({
      ok: false,
      error: cause instanceof Error ? cause.message : '无法解析这个存档文件。',
    })
  }
}
