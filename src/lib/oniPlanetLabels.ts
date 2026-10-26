import { readResourcePlanets } from './oniResourceStatistics'
import type { ParsedSave } from './save'
import './oniPlanetLabels.css'

/** Screen-sized labels anchored to saved world bounds; camera updates never rebuild map tiles. */
export function createOniPlanetLabels(host: HTMLElement, save: ParsedSave, worldHeight: number) {
  const layer = document.createElement('div')
  layer.className = 'oni-planet-labels'
  layer.setAttribute('aria-label', '星球区域名称')
  const labels = readResourcePlanets(save).map(planet => {
    const label = document.createElement('div')
    label.className = 'oni-planet-label'
    label.dataset.planetId = String(planet.id)
    label.textContent = planet.name
    label.title = `${planet.name} · ${planet.type} · 星球 ID ${planet.id}`
    layer.append(label)
    return { planet, label }
  })
  host.append(layer)
  return {
    update(originX: number, originY: number, cellSize: number) {
      // Only show region labels at overview distances, leaving close-up editing unobstructed.
      layer.hidden = cellSize > 6 || cellSize <= 0
      if (layer.hidden) return
      for (const { planet, label } of labels) {
        const width = planet.width * cellSize
        const x = originX + (planet.x + planet.width / 2) * cellSize
        const y = originY + (worldHeight - planet.y - planet.height) * cellSize + 10
        label.hidden = x + width / 2 < 0 || x - width / 2 > host.clientWidth || y + 32 < 0 || y > host.clientHeight
        label.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, 0)`
        label.style.maxWidth = `${Math.max(28, width - 10)}px`
      }
    },
    destroy() { layer.remove() },
  }
}
