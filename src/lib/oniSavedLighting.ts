import { component, member } from './editor'
import { oniLightDefinitionForTag, type OniLightInstance } from './oniLighting'
import { oniStateMachineState } from './oniStateMachines'
import type { ParsedSave } from './save'

/** Resolve saved light controllers, including inactive lamps and creature variants. */
export function savedOniLights(save: ParsedSave): OniLightInstance[] {
  const lights: OniLightInstance[] = []
  for (const group of save.manager?.groups ?? []) {
    const definition = oniLightDefinitionForTag(group.tag)
    if (!definition) continue
    for (const instance of group.instances) {
      const state = oniStateMachineState(component(instance, 'StateMachineController')?.details, 'LightController')
      if (state && !/(?:^|\.)on$/i.test(state)) continue
      if (!state && definition.requiresActive) {
        const activeTime = member(component(instance, 'Operational')?.value, 'activeTime')?.value
        if (!activeTime || !('v' in activeTime) || typeof activeTime.v !== 'number' || activeTime.v <= 0) continue
      }
      lights.push({ x: instance.position.x, y: instance.position.y, definition })
    }
  }
  return lights
}
