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
const LIQUID_TEX_MAX_MASS_KG = 2000

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.trunc(value * 255)))
}

function colorBytes(value: string | undefined, fallback: readonly [number, number, number]): [number, number, number] {
  if (!value) return [...fallback]
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) return [...fallback]
  const packed = Number.parseInt(match[1], 16)
  return [packed >>> 16 & 255, packed >>> 8 & 255, packed & 255]
}

function packedColorBytes(color: readonly [number, number, number]): [number, number, number] {
  // The game's uint32 color tables are written little-endian into ImageData.
  return [color[2], color[1], color[0]]
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
  // v21's kleiLiquidTex is a packed uint32 color plus coverage in A. Since
  // the target worker writes packed 0xRRGGBB values into ImageData, the
  // byte order exposed to the shader is B/G/R/A.
  const liquid = new Uint8Array(width * height * 4)
  const solidLiquidGasMass = new Uint8Array(width * height * 4)
  const materialData = new Uint8Array(width * height * 4)
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
      const foundation = input.isTerrainMaskedAt(worldX, worldY)
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
        const amount = aboveState === 'liquid'
          || aboveState === 'solid'
          || input.isTerrainMaskedAt(worldX, worldY + 1)
          ? 1
          : Math.pow(Math.min(Math.max(cell.mass, 0) / LIQUID_TEX_MAX_MASS_KG, 1), .45)
        const fallbackColor: readonly [number, number, number] = [material.colour[0], material.colour[1], material.colour[2]]
        const fluid = element.fluidMaterial
        const gradient = colorBytes(fluid?.gradientBottom, fallbackColor)
        const liquidOffset = pixel * 4
        const packedGradient = packedColorBytes(gradient)
        liquid[liquidOffset] = packedGradient[0]
        liquid[liquidOffset + 1] = packedGradient[1]
        liquid[liquidOffset + 2] = packedGradient[2]
        liquid[liquidOffset + 3] = byte(amount)

        const temperatureSpan = material.highTemp - material.lowTemp
        const temperatureRatio = temperatureSpan > 0
          ? Math.max(0, Math.min(1, (cell.temperature - material.lowTemp) / temperatureSpan))
          : .5
        const temperatureByte = Math.trunc(temperatureRatio * 255)
        const lowColor = packedColorBytes(colorBytes(fluid?.gradientBottom, fallbackColor))
        const highColor = packedColorBytes(colorBytes(fluid?.gradientTop, fallbackColor))
        const temperatureColor = temperatureByte < 128 ? lowColor : highColor
        const liquidDataOffset = pixel * 4
        liquidData[liquidDataOffset] = temperatureColor[0]
        liquidData[liquidDataOffset + 1] = temperatureColor[1]
        liquidData[liquidDataOffset + 2] = temperatureColor[2]
        liquidData[liquidDataOffset + 3] = temperatureByte
      }
      const mass = Math.max(cell.mass, 0)
      const massOffset = pixel * 4
      // PropertyTextures.UpdateSolidLiquidGasMass writes the state bytes in
      // solid/liquid/gas order. ImageData receives those bytes directly as
      // RGBA; the shader reads the same R/G/B order.
      solidLiquidGasMass[massOffset] = state === 'solid' ? 255 : 0
      solidLiquidGasMass[massOffset + 1] = state === 'liquid' ? 255 : 0
      solidLiquidGasMass[massOffset + 2] = state === 'gas' || state === 'vacuum' ? 255 : 0
      solidLiquidGasMass[massOffset + 3] = mass > 0
        ? byte(Math.max(1 / 255, Math.min(1, mass / 2000)))
        : 0
      if (foundation) {
        solidLiquidGasMass[massOffset] = 255
        solidLiquidGasMass[massOffset + 3] = 255
      }
      if (material) {
        // MaterialData32 is packed as flags | (textureLayer << 24). Keep the
        // worker's flag bits intact: glow=1, caustics=2, metal=4, opaque=8.
        const flags = (material.glows ? 1 : 0)
          | (material.usesCaustics ? 2 : 0)
          | (material.metalic ? 4 : 0)
          | (material.isOpaqueLiquid ? 8 : 0)
        materialData[massOffset] = flags
        materialData[massOffset + 1] = 0
        materialData[massOffset + 2] = 0
        materialData[massOffset + 3] = material.substanceTexture > 0 ? material.substanceTexture & 0xff : 13
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
