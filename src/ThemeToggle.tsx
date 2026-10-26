import { useSyncExternalStore } from 'react'
import { Sun, Moon } from 'lucide-react'
type Theme = 'dark' | 'light'
const key = 'oni-editor-theme'
let theme: Theme = 'dark'
try { if (localStorage.getItem(key) === 'light') theme = 'light' } catch { /* Private or restricted storage: keep the preference in memory. */ }
const listeners = new Set<() => void>()
function apply(next: Theme) {
  theme = next
  document.documentElement.dataset.theme = next
  for (const listener of listeners) listener()
}
apply(theme)
window.addEventListener('storage', event => {
  if (event.key === key || event.key === null) apply(event.newValue === 'light' ? 'light' : 'dark')
})
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function ThemeToggle() {
  const current = useSyncExternalStore(subscribe, () => theme)
  const label = current === 'dark' ? '切换到白天模式' : '切换到深色模式'
  return <button className="theme-toggle" type="button" aria-label={label} title={label} onClick={() => {
    const next = current === 'dark' ? 'light' : 'dark'
    apply(next)
    try { localStorage.setItem(key, next) } catch { /* Switching still works without persistent storage. */ }
  }}>{current === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
}
