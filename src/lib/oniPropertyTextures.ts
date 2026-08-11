import { elementForHash } from './elements'
import { ONI_SUBSTANCE_BY_HASH } from './oniSubstances.generated'
import type { OniTerrainRenderInput } from './oniRenderer'

export type OniPropertyTextureData = {
  width: number
  height: number
  solidDigAmount: Uint8Array
  stateChange: Uint8Array
  fallingSolid: Uint8Array
  worldZone: Uint8Array
  gasColour: Uint8Array
  gasPressure: Uint8Array
  gasDanger: Uint8Array
  liquid: Uint8Array
  solidLiquidGasMass: Uint8Array
  materialData: Uint8Array
  liquidData: Uint8Array
}

const TEMPERATURE_STATE_CHANGE_RANGE = .05

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.trunc(value * 255)))
}

/**
 * Rebuilds the PropertyTextures inputs used by Substance.shader. The one-cell
 * border is intentional: ONI's SIMSAVE grid is two cells larger than the
 * playable world and PropertyTextures addresses that complete Grid.
 */
export function buildOniPropertyTextures(input: OniTerrainRenderInput): OniPropertyTextureData {
  const width = input.width + 2
  const height = input.height + 2
  const solidDigAmount = new Uint8Array(width * height * 3)
  const stateChange = new Uint8Array(width * height)
  const fallingSolid = new Uint8Array(width * height)
  const worldZone = new Uint8Array(width * height * 3)
  const gasColour = new Uint8Array(width * height * 4)
  const gasPressure = new Uint8Array(width * height)
  const gasDanger = new Uint8Array(width * height)
  // PropertyTextures.UpdateLiquid stores amount in R and the SubstanceHookup
  // colour in GBA (not RGBA). Keep that unusual channel layout verbatim.
  const liquid = new Uint8Array(width * height * 4)
  const solidLiquidGasMass = new Uint8Array(width * height * 4)
  const materialData = new Uint8Array(width * height * 4)
  // The native simulation owns this external buffer. SIMSAVE does not contain
  // it, so keep the input explicit rather than assigning invented channels.
  const liquidData = new Uint8Array(width * height * 4)

  const stateAt = (worldX: number, worldY: number): string | undefined => {
    const cell = input.cellAt(worldX, worldY)
    if (!cell) return undefined
    return ONI_SUBSTANCE_BY_HASH.get(cell.elementHash & 0xffff)?.state.toLowerCase()
      || elementForHash(cell.elementHash).state
  }

  for (let worldY = -1; worldY <= input.height; worldY += 1) {
    for (let worldX = -1; worldX <= input.width; worldX += 1) {
      const cell = input.cellAt(worldX, worldY)
      const simX = worldX + 1
      const simY = worldY + 1
      // Keep the SIMSAVE grid border and row order used by the property pass.
      const textureY = height - 1 - simY
      const pixel = textureY * width + simX
      if (!cell) continue

      const element = elementForHash(cell.elementHash)
      const material = ONI_SUBSTANCE_BY_HASH.get(cell.elementHash & 0xffff)
      const state = material?.state.toLowerCase() || element.state
      const naturalSolid = state === 'solid' && !input.isTerrainMaskedAt(worldX, worldY)
      const solidOffset = pixel * 3
      solidDigAmount[solidOffset] = naturalSolid ? 255 : 0
      solidDigAmount[solidOffset + 1] = naturalSolid ? byte(input.damageAt?.(worldX, worldY) ?? 0) : 0
      solidDigAmount[solidOffset + 2] = input.hasBackwallAt?.(worldX, worldY) ? 255 : 0

      if (material && state !== 'vacuum') {
        const lowRange = material.lowTemp * TEMPERATURE_STATE_CHANGE_RANGE
        const highRange = material.highTemp * TEMPERATURE_STATE_CHANGE_RANGE
        const lowDistance = lowRange > 0 ? Math.abs(cell.temperature - material.lowTemp) / lowRange : Number.POSITIVE_INFINITY
        const highDistance = highRange > 0 ? Math.abs(cell.temperature - material.highTemp) / highRange : Number.POSITIVE_INFINITY
        stateChange[pixel] = byte(Math.max(0, 1 - Math.min(lowDistance, highDistance)))
        if (material.name === 'Mud' || material.name === 'ToxicMud') fallingSolid[pixel] = byte(.65)
      }

      if (material && (state === 'gas' || state === 'liquid')) {
        const gasOffset = pixel * 4
        gasColour.set(material.colour, gasOffset)
      }
      if (state === 'gas') {
        const pressure = Math.max(Math.min(Math.max(cell.mass, 0) / 200, 1), cell.mass > 0 ? .15 : 0)
        gasPressure[pixel] = byte(pressure)
      }
      if (material && state === 'liquid') {
        const aboveState = stateAt(worldX, worldY + 1)
        // This is the exact UpdateLiquid branch. The decompiled assignment
        // using LiquidAmountOffset is immediately overwritten by Pow(...,.45).
        const amount = aboveState === 'liquid' || aboveState === 'solid'
          ? 1
          : Math.pow(Math.min(Math.max(cell.mass, 0) / 1000, 1), .45)
        const liquidOffset = pixel * 4
        liquid[liquidOffset] = byte(amount)
        liquid[liquidOffset + 1] = material.colour[0]
        liquid[liquidOffset + 2] = material.colour[1]
        liquid[liquidOffset + 3] = material.colour[2]
      }
      const mass = Math.max(cell.mass, 0)
      const massOffset = pixel * 4
      // PropertyTextures.UpdateSolidLiquidGasMass writes the three state
      // flags independently: R=solid, G=liquid, B=gas, A=mass.
      solidLiquidGasMass[massOffset] = state === 'solid' ? 255 : 0
      solidLiquidGasMass[massOffset + 1] = state === 'liquid' ? 255 : 0
      solidLiquidGasMass[massOffset + 2] = state === 'gas' || state === 'vacuum' ? 255 : 0
      solidLiquidGasMass[massOffset + 3] = mass > 0
        ? byte(Math.max(1 / 255, Math.min(1, mass / 2000)))
        : 0
      if (material) {
        // Sim.MaterialPropertiesAccessor is a uint. Texture2D receives its
        // little-endian bytes as RGBA: flags in R and SubstanceTexture in A.
        const flags = (material.glows ? 1 : 0)
          | (material.usesCaustics ? 2 : 0)
          | (material.metalic ? 4 : 0)
          | (material.isOpaqueLiquid ? 8 : 0)
        materialData[massOffset] = flags
        materialData[massOffset + 3] = material.substanceTexture & 0xff
      }
      gasDanger[pixel] = material?.name === 'Oxygen' ? 0 : 255

      if (worldX >= 0 && worldX < input.width && worldY >= 0 && worldY < input.height) {
        const zone = input.worldZones[worldY * input.width + worldX] ?? 3
        const color = input.zoneColors[zone] ?? input.zoneColors[3]
        if (color) {
          const zoneOffset = pixel * 3
          worldZone[zoneOffset] = color.r
          worldZone[zoneOffset + 1] = color.g
          worldZone[zoneOffset + 2] = color.b
        }
      }
    }
  }

  return { width, height, solidDigAmount, stateChange, fallingSolid, worldZone, gasColour, gasPressure, gasDanger, liquid, solidLiquidGasMass, materialData, liquidData }
}
