import type { ParsedSave } from './save'
import { inspectOniCell } from './oniCellInspection'
import './oniCellTooltip.css'

/** DOM-only hover updates keep mouse movement out of React's map render cycle. */
export function createOniCellTooltip(save: ParsedSave) {
  const panel = document.createElement('div')
  panel.className = 'oni-cell-tooltip'
  panel.setAttribute('role', 'tooltip')
  panel.hidden = true
  document.body.append(panel)
  let previousCell = ''
  let width = 0, height = 0
  const hide = () => { panel.hidden = true; previousCell = '' }
  window.addEventListener('blur', hide)
  window.addEventListener('resize', hide)
  window.addEventListener('scroll', hide, true)
  document.addEventListener('visibilitychange', hide)
  return {
    show(x: number, y: number, clientX: number, clientY: number) {
      const key = `${x}:${y}`
      if (key !== previousCell) {
        const cell = inspectOniCell(save, x, y)
        if (!cell) { hide(); return }
        const title = document.createElement('strong'); title.textContent = cell.name
        const position = document.createElement('div'); position.className = 'oni-cell-position'; position.textContent = cell.position
        const list = document.createElement('dl')
        for (const [label, value] of cell.rows) {
          const term = document.createElement('dt'); term.textContent = label
          const description = document.createElement('dd'); description.textContent = value
          list.append(term, description)
        }
        panel.replaceChildren(title, position, list)
        panel.hidden = false
        const bounds = panel.getBoundingClientRect()
        width = bounds.width; height = bounds.height
        previousCell = key
      }
      const left = clientX + 18 + width < window.innerWidth - 8 ? clientX + 18 : clientX - width - 18
      const top = clientY + 18 + height < window.innerHeight - 8 ? clientY + 18 : clientY - height - 18
      panel.style.transform = `translate3d(${Math.max(8, Math.min(window.innerWidth - width - 8, left))}px, ${Math.max(8, Math.min(window.innerHeight - height - 8, top))}px, 0)`
    },
    hide,
    destroy() {
      window.removeEventListener('blur', hide)
      window.removeEventListener('resize', hide)
      window.removeEventListener('scroll', hide, true)
      document.removeEventListener('visibilitychange', hide)
      panel.remove()
    },
  }
}
