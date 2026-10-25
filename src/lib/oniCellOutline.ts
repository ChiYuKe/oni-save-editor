import type { GridOutlineRect } from './oniGridSelection'
import './oniCellOutline.css'

export function createOniCellOutline(host: HTMLElement) {
  const elements = new Map<string, HTMLDivElement>()
  for (const [kind, label] of [['hover', '悬停格子'], ['selected', '选中格子'], ['range', '选中区域']]) {
    const box = document.createElement('div')
    box.className = `oni-cell-outline oni-cell-outline-${kind}`
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', label)
    box.hidden = true
    host.append(box)
    elements.set(kind, box)
  }
  return {
    update(kind: 'hover' | 'selected' | 'range', rect?: GridOutlineRect) {
      const box = elements.get(kind)!
      box.hidden = !rect
      if (!rect) return
      box.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`
      box.style.width = `${rect.width}px`; box.style.height = `${rect.height}px`
    },
    destroy() { for (const box of elements.values()) box.remove(); elements.clear() },
  }
}
