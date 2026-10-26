import { ONI_OBJECT_ICONS } from './oniObjectIcons.generated'
import { ONI_GEYSER_TYPES } from './oniResourceData.generated'
import { buildingTextureLookupKeys, geyserTextureForTag } from './oniObjectVisuals'
const geysers = new Map<string,string>(ONI_GEYSER_TYPES.map(type => ['geysergeneric_'+type.id, type.iconPath]))
/** Exact saved prefab first; known building aliases and native geysers follow. */
export function objectGroupIcon(tag: string): string | undefined {
  const key = tag.trim().toLowerCase()
  return ONI_OBJECT_ICONS[key] ?? geysers.get(key)
    ?? buildingTextureLookupKeys(tag).map(key => ONI_OBJECT_ICONS[key]).find(Boolean)
    ?? geyserTextureForTag(tag)?.path
}
