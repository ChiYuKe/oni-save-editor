import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  AlertTriangle,
  Archive,
  Boxes,
  ChevronRight,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileUp,
  Gauge,
  Grid2x2,
  Hand,
  Layers3,
  Maximize2,
  Paintbrush,
  PaintBucket,
  Pipette,
  Minus,
  Plus,
  Redo2,
  Search,
  Save,
  Settings2,
  Square,
  SlidersHorizontal,
  Undo2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import './App.css'
import { buildSave, parseSave, type ParsedSave } from './lib/save'
import { ELEMENTS, defaultElementValues, elementForHash, elementOptions, formatHash, type FluidMaterialStyle } from './lib/elements'
import {
  component,
  editableMembers,
  formatNumber,
  gameValue,
  groupByTag,
  groupRows,
  isEditable,
  member,
  objectName,
  scalarNumber,
  scalarText,
  saveGameInstance,
  setValueFromText,
  topGroups,
  worldGrid,
  worldSize,
} from './lib/editor'
import type { SavedObjectInstance, Value } from './lib/model'
import { SIM_DISEASE_SIZE, getSimElementProfile, getWorldCell, readSimCell, setWorldCells, type SimCell } from './lib/sim'
import { createTerrainBoundaryPath, createTerrainCellPath } from './lib/terrainMasks'

type View = 'overview' | 'map' | 'dupes' | 'objects'
type MapLayer = 'grid' | 'biome' | 'minions' | 'buildings' | 'gas' | 'liquid' | 'ground' | 'backwall'
type MapOverlay = 'none' | 'temperature' | 'mass' | 'disease' | 'visibility' | 'spawnable' | 'damage'
type MapLayerVisibility = Record<MapLayer, boolean>
type MapEdit = { x: number; y: number; before: SimCell; after: SimCell }
type MapPreviewCell = { x: number; y: number; elementHash: number }
type MapSelection = { start: { x: number; y: number }; end: { x: number; y: number } }
type MapTool = 'inspect' | 'move' | 'paint' | 'erase' | 'eyedropper' | 'fill' | 'rectangle' | 'line'
type MapCellUpdate = { x: number; y: number; patch: Partial<SimCell> }
const MAP_CELL_PIXELS = 4
const MAP_ZOOM_MIN = 1
const MAP_ZOOM_MAX = 16
// Keep export cells on whole pixels so scaled terrain masks and textures stay crisp.
const PANORAMA_CELL_PIXELS = 11
const DEFAULT_ELEMENT_WORLD_UV_SCALE = 8
type GeyserTextureDefinition = { path: string; widthCells: number }
type BuildingTextureDefinition = { path: string; widthCells: number }
type ZoneColor = { r: number; g: number; b: number }

function assetPath(path: string): string {
  if (!path.startsWith('/')) return path
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
}

// SubworldZoneRenderData.zoneColours from the game build used by the bridge.
// Zone 7 is Space in the game and intentionally has no foreground tint here.
const WORLD_ZONE_COLORS: Record<number, ZoneColor> = {
  0: { r: 145, g: 198, b: 213 }, // Frozen
  1: { r: 135, g: 82, b: 160 }, // Crystal
  2: { r: 123, g: 151, b: 75 }, // Slime
  3: { r: 236, g: 189, b: 89 }, // Sandstone
  4: { r: 201, g: 152, b: 181 }, // Caustic
  5: { r: 222, g: 90, b: 59 }, // Magma
  6: { r: 201, g: 152, b: 181 }, // Oil
  8: { r: 201, g: 201, b: 151 }, // Ocean
  9: { r: 236, g: 90, b: 110 }, // Rust
  10: { r: 110, g: 236, b: 110 }, // Forest
  11: { r: 145, g: 198, b: 213 }, // Radioactive
  12: { r: 145, g: 198, b: 213 }, // Swamp
  13: { r: 145, g: 198, b: 213 }, // Wasteland
  14: { r: 173, g: 222, b: 212 }, // Rocket interior
 15: { r: 100, g: 100, b: 222 }, // Metallic
 16: { r: 222, g: 100, b: 222 }, // Barren
 17: { r: 100, g: 222, b: 100 }, // Moo
 18: { r: 100, g: 100, b: 222 },
 19: { r: 222, g: 100, b: 222 },
 20: { r: 100, g: 222, b: 100 },
 24: { r: 201, g: 152, b: 181 },
 25: { r: 63, g: 28, b: 6 },
 26: { r: 142, g: 192, b: 57 },
  27: { r: 192, g: 100, b: 16 }, // Current DLC zone
}

// The game samples these layers from the bgarray Texture2DArray. The values
// match SubworldZoneRenderData.zoneTextureArrayIndices in the game source.
const ZONE_TEXTURE_ARRAY_INDICES = [
  0, 1, 2, 3, 4, 5, 5, 3, 6, 7,
  8, 9, 10, 11, 12, 7, 3, 13, 0, 0,
  0, 14, 15, 16, 4, 6, 18, 17,
]
const BIOME_BACKGROUND_WORLD_CELLS = 20

function zoneColorForType(zoneType: number): ZoneColor | undefined {
  return WORLD_ZONE_COLORS[zoneType]
}

function zoneTextureIndexForType(zoneType: number): number | undefined {
  if (zoneType === 7 || zoneType === 255) return undefined
  return ZONE_TEXTURE_ARRAY_INDICES[zoneType] ?? 0
}

function biomeBackgroundAsset(textureIndex: number): string {
  return `/assets/background/biomes/slice-${textureIndex.toString().padStart(2, '0')}.png`
}

function drawBiomeBackground(
  context: CanvasRenderingContext2D,
  worldZones: Uint8Array,
  width: number,
  height: number,
  cellSize: number,
  originX: number,
  originY: number,
  range: { minX: number; maxX: number; minRow: number; maxRow: number },
  backgrounds: Record<number, HTMLImageElement>,
): void {
  const paths = new Map<number, Path2D>()
  const fallbackColors = new Map<number, ZoneColor>()
  for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
    const y = height - 1 - canvasY
    for (let x = range.minX; x <= range.maxX; x++) {
      const zoneType = worldZones[y * width + x] ?? 7
      const textureIndex = zoneTextureIndexForType(zoneType)
      if (textureIndex === undefined) continue
      const path = paths.get(textureIndex) ?? new Path2D()
      path.rect(originX + x * cellSize, originY + canvasY * cellSize, cellSize + .25, cellSize + .25)
      paths.set(textureIndex, path)
      if (!fallbackColors.has(textureIndex)) {
        const color = zoneColorForType(zoneType)
        if (color) fallbackColors.set(textureIndex, color)
      }
    }
  }

  context.save()
  context.globalAlpha = .84
  context.imageSmoothingEnabled = true
  for (const [textureIndex, path] of paths) {
    const image = backgrounds[textureIndex]
    if (image?.naturalWidth && image.naturalHeight) {
      const scale = (cellSize * BIOME_BACKGROUND_WORLD_CELLS) / image.naturalWidth
      const pattern = context.createPattern(image, 'repeat')
      if (pattern) {
        // Anchor the pattern to the map origin so panning moves the texture
        // with the world instead of making it slide under the cursor.
        pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, originX, originY]))
        context.fillStyle = pattern
        context.fill(path)
        continue
      }
    }
    const fallback = fallbackColors.get(textureIndex) ?? { r: 36, g: 43, b: 48 }
    context.fillStyle = `rgb(${fallback.r}, ${fallback.g}, ${fallback.b})`
    context.fill(path)
  }
  context.restore()
}

function pointInPolygon(x: number, y: number, vertices: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const currentVertex = vertices[index]
    const previousVertex = vertices[previous]
    const intersects = currentVertex.y > y !== previousVertex.y > y
      && x < (previousVertex.x - currentVertex.x) * (y - currentVertex.y) / (previousVertex.y - currentVertex.y) + currentVertex.x
    if (intersects) inside = !inside
  }
  return inside
}

function buildWorldZoneMap(save: ParsedSave, width: number, height: number): Uint8Array {
  const zoneMap = new Uint8Array(width * height)
  zoneMap.fill(7)
  const worldDetail = member(save.gameData, 'worldDetail')?.value
  if (!worldDetail || worldDetail.kind !== 'object') return zoneMap
  const overworldCells = member(worldDetail, 'overworldCells')?.value
  if (!overworldCells || overworldCells.kind !== 'list') return zoneMap

  for (const item of overworldCells.items) {
    if (item.kind !== 'object') continue
    const zoneValue = member(item, 'zoneType')?.value
    const zoneType = zoneValue && (zoneValue.kind === 'enum' || zoneValue.kind === 'byte' || zoneValue.kind === 'int32')
      ? zoneValue.v
      : undefined
    const polygonValue = member(item, 'poly')?.value
    if (zoneType === undefined || !polygonValue || polygonValue.kind !== 'object') continue
    const verticesValue = member(polygonValue, 'vertices')?.value
    if (!verticesValue || verticesValue.kind !== 'list') continue
    const vertices = verticesValue.items
      .filter((vertex): vertex is Extract<typeof vertex, { kind: 'vector2' }> => vertex.kind === 'vector2')
      .map((vertex) => ({ x: vertex.x, y: vertex.y }))
    if (vertices.length < 3) continue
    const minX = Math.max(0, Math.floor(Math.min(...vertices.map((vertex) => vertex.x))))
    const maxX = Math.min(width - 1, Math.ceil(Math.max(...vertices.map((vertex) => vertex.x))))
    const minY = Math.max(0, Math.floor(Math.min(...vertices.map((vertex) => vertex.y))))
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...vertices.map((vertex) => vertex.y))))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPolygon(x, y, vertices)) zoneMap[y * width + x] = zoneType
      }
    }
  }
  return zoneMap
}

function geyserAsset(fileName: string, widthCells: number): GeyserTextureDefinition {
  return { path: `/assets/geysers/${fileName}`, widthCells }
}

const GEYSER_TEXTURES: Record<string, GeyserTextureDefinition> = {
  gas_chlorine: geyserAsset('geyser_gas_chlorine_0_ui_False.png', 3.2),
  gas_co2_hot: geyserAsset('geyser_gas_co2_hot_0_ui_False.png', 3.2),
  gas_hydrogen_hot: geyserAsset('geyser_gas_hydrogen_hot_0_ui_False.png', 3.2),
  gas_methane: geyserAsset('geyser_gas_methane_0_ui_False.png', 3.2),
  gas_po2_hot: geyserAsset('geyser_gas_po2_hot_0_ui_False.png', 3.2),
  gas_po2_slimy: geyserAsset('geyser_gas_po2_slimy_0_ui_False.png', 3.2),
  gas_steam: geyserAsset('geyser_gas_steam_0_ui_False.png', 3.2),
  gas_steam_hot: geyserAsset('geyser_gas_steam_hot_0_ui_False.png', 3.2),
  liquid_co2: geyserAsset('geyser_liquid_co2_0_ui_False.png', 4),
  liquid_murky_brine: geyserAsset('geyser_liquid_murkybrine_0_ui_False.png', 4),
  liquid_oil: geyserAsset('geyser_liquid_oil_0_ui_False.png', 4),
  liquid_salt_water: geyserAsset('geyser_liquid_salt_water_0_ui_False.png', 4),
  liquid_salt_water_cool_slush: geyserAsset('geyser_liquid_salt_water_cool_slush_0_ui_False.png', 4),
  liquid_sulfur: geyserAsset('geyser_liquid_sulfur_0_ui_False.png', 4),
  liquid_water_filthy: geyserAsset('geyser_liquid_water_filthy_0_ui_False.png', 4),
  liquid_water_hot: geyserAsset('geyser_liquid_water_hot_0_ui_False.png', 4),
  liquid_water_slush: geyserAsset('geyser_liquid_water_slush_0_ui_False.png', 4),
  molten_aluminum: geyserAsset('geyser_molten_aluminum_0_ui_False.png', 4),
  molten_cobalt: geyserAsset('geyser_molten_cobalt_0_ui_False.png', 4),
  molten_copper: geyserAsset('geyser_molten_copper_0_ui_False.png', 4),
  molten_gold: geyserAsset('geyser_molten_gold_0_ui_False.png', 4),
  molten_iron: geyserAsset('geyser_molten_iron_0_ui_False.png', 4),
  molten_niobium: geyserAsset('geyser_molten_niobium_0_ui_False.png', 4),
  molten_tungsten: geyserAsset('geyser_molten_tungsten_0_ui_False.png', 4),
  molten_volcano_big: geyserAsset('geyser_molten_volcano_big_0_ui_False.png', 4),
  molten_volcano_small: geyserAsset('geyser_molten_volcano_small_0_ui_False.png', 4),
  oil_cap: geyserAsset('geyser_oil_cap_0_ui_False.png', 3.8),
  reef: geyserAsset('geyser_reef_0_ui_False.png', 4.2),
  side_chlorine: geyserAsset('geyser_side_chlorine_0_ui_False.png', 4.4),
  side_methane: geyserAsset('geyser_side_methane_0_ui_False.png', 4.4),
  side_oil: geyserAsset('geyser_side_oil_0_ui_False.png', 4.4),
  side_steam: geyserAsset('geyser_side_steam_0_ui_False.png', 4.4),
  aquatic_brackene_fountain: geyserAsset('aquatic_brackene_fountain_0_ui_False.png', 2.8),
}

// Prefab tags and exported sprite ids use different word orders for several geysers.
const GEYSER_TAG_ALIASES: Record<string, string> = {
  big_volcano: 'molten_volcano_big',
  chlorine_gas_cool: 'gas_chlorine',
  chlorine_gas: 'gas_chlorine',
  filthy_water: 'liquid_water_filthy',
  hot_co2: 'gas_co2_hot',
  hot_hydrogen: 'gas_hydrogen_hot',
  hot_steam: 'gas_steam_hot',
  hot_water: 'liquid_water_hot',
  methane: 'gas_methane',
  oil_drip: 'oil_cap',
  salt_water_cool_slush: 'liquid_salt_water_cool_slush',
  slush_salt_water: 'liquid_salt_water_cool_slush',
  slush_water: 'liquid_water_slush',
  slimy_po2: 'gas_po2_slimy',
  small_volcano: 'molten_volcano_small',
  steam: 'gas_steam',
  salt_water: 'liquid_salt_water',
}

function geyserTextureForTag(tag: string): GeyserTextureDefinition | undefined {
  const normalized = tag.toLowerCase()
  if (normalized === 'smallreefgeyser') return GEYSER_TEXTURES.reef
  if (normalized === 'geyser') return GEYSER_TEXTURES.side_steam
  if (normalized === 'chlorinegeyser') return GEYSER_TEXTURES.side_chlorine
  if (normalized === 'methanegeyser') return GEYSER_TEXTURES.side_methane
  if (normalized === 'oilwell') return GEYSER_TEXTURES.side_oil
  if (normalized === 'niobiumgeyser') return GEYSER_TEXTURES.molten_niobium
  if (normalized.includes('aquatic') || normalized.includes('brackene')) return GEYSER_TEXTURES.aquatic_brackene_fountain
  const key = normalized.replace(/^geysergeneric_/, '')
  return GEYSER_TEXTURES[GEYSER_TAG_ALIASES[key] ?? key]
}

const BUILDING_TEXTURES: Record<string, BuildingTextureDefinition> = {
  gasvent: { path: '/assets/buildings/ventgas_0_ui_False.png', widthCells: 1 },
  gasventhighpressure: { path: '/assets/buildings/ventgas_powered_0_ui_False.png', widthCells: 1 },
  liquidvent: { path: '/assets/buildings/ventliquid_0_ui_False.png', widthCells: 1 },
  solidvent: { path: '/assets/buildings/conveyer_dropper_0_ui_False.png', widthCells: 1 },
  underwatervent: { path: '/assets/buildings/underwater_vent_0_ui_False.png', widthCells: 4 },
  underwaterventdrill: { path: '/assets/buildings/underwater_vent_drill_0_ui_False.png', widthCells: 4 },
}

function buildingTextureForTag(tag: string): BuildingTextureDefinition | undefined {
  return BUILDING_TEXTURES[tag.toLowerCase()]
}

const MAP_LAYERS: Array<{ id: MapLayer; label: string; detail: string }> = [
  { id: 'grid', label: '网格', detail: '编辑器辅助' },
  { id: 'biome', label: '群落色', detail: 'WorldZone.Tint' },
  { id: 'minions', label: '复制人', detail: 'SceneLayer.Creatures' },
  { id: 'buildings', label: '建筑 / 喷泉', detail: 'SceneLayer.Building' },
  { id: 'gas', label: '气体', detail: 'SceneLayer.Gas' },
  { id: 'liquid', label: '液体', detail: 'SceneLayer.Liquid' },
  { id: 'ground', label: '地面 / 土块', detail: 'SceneLayer.Ground' },
  { id: 'backwall', label: '后墙', detail: 'SceneLayer.Backwall' },
]
const MAP_OVERLAYS: Array<{ id: MapOverlay; label: string }> = [
  { id: 'none', label: '无' },
  { id: 'temperature', label: '温度' },
  { id: 'mass', label: '质量' },
  { id: 'disease', label: '疾病' },
  { id: 'visibility', label: '可见性' },
  { id: 'spawnable', label: '可生成' },
  { id: 'damage', label: '损坏' },
]
const DEFAULT_MAP_LAYER_VISIBILITY: MapLayerVisibility = {
  grid: false,
  biome: true,
  minions: true,
  buildings: true,
  gas: true,
  liquid: true,
  ground: true,
  backwall: false,
}
type SaveFileHandle = {
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (data: Uint8Array) => Promise<void>; close: () => Promise<void> }>
}
type SavePickerOptions = {
  types: Array<{ description: string; accept: Record<string, string[]> }>
  multiple: boolean
}
type SavePickerWindow = Window & {
  showOpenFilePicker?: (options: SavePickerOptions) => Promise<SaveFileHandle[]>
}

const savePickerOptions: SavePickerOptions = {
  types: [{ description: 'Oxygen Not Included save', accept: { 'application/octet-stream': ['.sav'] } }],
  multiple: false,
}

const navItems: Array<{ id: View; label: string }> = [
  { id: 'overview', label: '总览' },
  { id: 'map', label: '地图' },
  { id: 'dupes', label: '复制人' },
  { id: 'objects', label: '对象' },
]

function App() {
  const [save, setSave] = useState<ParsedSave | null>(null)
  const [fileName, setFileName] = useState('')
  const [view, setView] = useState<View>('overview')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState('Minion')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [sourceHandle, setSourceHandle] = useState<SaveFileHandle | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const loadFile = useCallback(async (file: File, handle: SaveFileHandle | null = null) => {
    if (!file.name.toLowerCase().endsWith('.sav')) {
      setError('请选择 Oxygen Not Included 的 .sav 存档文件。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const parsed = parseSave(new Uint8Array(await file.arrayBuffer()))
      setSave(parsed)
      setFileName(file.name)
      setSourceHandle(handle)
      setDirty(false)
      setView('overview')
      setSelectedGroup('Minion')
      setSelectedIndex(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法解析这个存档文件。')
      setSave(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSave = useCallback((update: (current: ParsedSave) => void) => {
    setSave((current) => {
      if (!current) return current
      update(current)
      return { ...current }
    })
    setDirty(true)
  }, [])

  const downloadSave = useCallback(() => {
    if (!save) return
    try {
      const bytes = buildSave(save)
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName.replace(/\.sav$/i, '') + '-edited.sav'
      link.click()
      URL.revokeObjectURL(url)
      setDirty(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出存档失败。')
    }
  }, [fileName, save])

  const openPicker = useCallback(async () => {
    const pickerWindow = window as SavePickerWindow
    if (!pickerWindow.showOpenFilePicker) {
      fileInput.current?.click()
      return
    }
    try {
      const [handle] = await pickerWindow.showOpenFilePicker(savePickerOptions)
      if (handle) await loadFile(await handle.getFile(), handle)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : '无法打开存档文件。')
    }
  }, [loadFile])

  const replaceSave = useCallback(async () => {
    if (!save) return
    let targetHandle = sourceHandle
    let targetName = fileName
    try {
      if (!targetHandle) {
        const pickerWindow = window as SavePickerWindow
        if (!pickerWindow.showOpenFilePicker) {
          setError('当前浏览器不支持直接替换原文件，请使用“导出”。')
          return
        }
        const [handle] = await pickerWindow.showOpenFilePicker(savePickerOptions)
        if (!handle) return
        const targetFile = await handle.getFile()
        if (!targetFile.name.toLowerCase().endsWith('.sav')) {
          setError('请选择 Oxygen Not Included 的 .sav 存档文件。')
          return
        }
        targetHandle = handle
        targetName = targetFile.name
      }
      if (!window.confirm(`确认将修改后的“${targetName}”直接写回原存档吗？\n原文件将被覆盖。`)) return
      const writable = await targetHandle.createWritable()
      await writable.write(buildSave(save))
      await writable.close()
      setSourceHandle(targetHandle)
      setFileName(targetName)
      setDirty(false)
      setError('')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : '替换原存档失败。')
    }
  }, [fileName, save, sourceHandle])

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void loadFile(file)
  }

  return (
    <div className={`app-shell ${save ? 'saved-shell' : 'landing-shell'}`}>
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept=".sav,application/octet-stream"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void loadFile(file)
          event.target.value = ''
        }}
      />
      <header className="topbar">
        {save && view === 'map' && <div className="map-global-title"><div className="eyebrow">MAP WORKSPACE</div><h1>地图</h1></div>}
        <div className={`topbar-pill ${save ? 'is-loaded' : 'is-landing'}`}>
          <div className="brand-lockup">
            <div className="brand-mark"><Archive size={16} strokeWidth={2.5} /></div>
            <div>
              <div className="brand-name">缺氧存档编辑器</div>
              <div className="brand-caption">ONI SAVE EDITOR</div>
            </div>
          </div>
          {save && (
            <nav className="topnav" aria-label="工作区">
              {navItems.map(({ id, label }) => (
                <button key={id} className={view === id ? 'active' : ''} type="button" onClick={() => setView(id)}>{label}</button>
              ))}
            </nav>
          )}
          <div className="topbar-actions">
            {save ? (
              <>
                <div className="file-chip" title={fileName}>
                  <span className="status-dot" />
                  <span>{fileName}</span>
                  {dirty && <span className="dirty-dot" title="有未导出的修改" />}
                </div>
                <button className="button button-quiet" type="button" onClick={openPicker} title="打开另一个存档">
                  <FileUp size={15} /> <span>打开</span>
                </button>
                <button className="button button-replace" type="button" onClick={replaceSave} title="直接覆盖原存档文件">
                  <Save size={15} /> <span>替换</span>
                </button>
                <button className="button button-primary" type="button" onClick={downloadSave} title="导出修改后的存档">
                  <Download size={15} /> <span>导出</span>
                </button>
              </>
            ) : (
              <button className="button button-primary" type="button" onClick={openPicker}>
                <Upload size={15} /> <span>打开存档</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button type="button" className="icon-button" onClick={() => setError('')} title="关闭提示"><X size={16} /></button>
        </div>
      )}

      {!save ? (
        <EmptyState loading={loading} isDragging={isDragging} onPick={openPicker} onDrop={handleDrop} onDragChange={setIsDragging} />
      ) : (
        <div className="workspace">
          <main className={`main-content main-content-${view}`}>
            {view !== 'map' && <div className={`content-head content-head-${view}`}>
              <div>
                <div className="eyebrow">{view === 'overview' ? 'SAVE OVERVIEW' : view.toUpperCase()}</div>
                <h1>{navItems.find((item) => item.id === view)?.label}</h1>
              </div>
              <div className="head-meta"><span className="status-dot" />{dirty ? '待导出' : '已载入'}<ChevronRight size={14} />{fileName}</div>
            </div>}
            {view === 'overview' && <Overview save={save} onNavigate={setView} updateSave={updateSave} />}
            {view === 'map' && <MapView save={save} updateSave={updateSave} />}
            {view === 'dupes' && <DupesView save={save} updateSave={updateSave} onOpenObject={(index) => { setSelectedGroup('Minion'); setSelectedIndex(index); setView('objects') }} />}
            {view === 'objects' && <ObjectsView save={save} selectedGroup={selectedGroup} selectedIndex={selectedIndex} onSelect={(tag, index) => { setSelectedGroup(tag); setSelectedIndex(index) }} updateSave={updateSave} />}
          </main>
        </div>
      )}
    </div>
  )
}

function EmptyState({ loading, isDragging, onPick, onDrop, onDragChange }: { loading: boolean; isDragging: boolean; onPick: () => void; onDrop: (event: React.DragEvent<HTMLDivElement>) => void; onDragChange: (value: boolean) => void }) {
  return (
    <div className={`empty-state ${isDragging ? 'is-dragging' : ''}`} onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); onDragChange(true) }} onDragLeave={() => onDragChange(false)}>
      <ColonyBackdrop />
      <div className="hero-content">
        <div className="hero-wordmark" aria-label="Oxygen Not Included">
          <span>OXYGEN</span>
          <strong>NOT INCLUDED</strong>
        </div>
        <div className="hero-rule" />
        <h1>缺氧存档<br /><span>编辑器</span></h1>
        <div className="hero-caption">LOCAL SAVE EDITOR</div>
        <button className="button button-primary button-large" type="button" onClick={onPick} disabled={loading}>
          {loading ? <><span className="spinner" />解析中...</> : <><FileUp size={17} />选择存档</>}
        </button>
      </div>
    </div>
  )
}

function ColonyBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 1440
    canvas.height = 820
    const context = canvas.getContext('2d')
    if (!context) return
    const rooms = [
      [94, 174, 290, 170], [450, 106, 190, 238], [798, 166, 372, 164],
      [182, 484, 330, 146], [590, 444, 254, 188], [950, 474, 210, 144],
    ] as const
    const horizontalPaths = [[66, 392, 1290], [182, 546, 512], [730, 632, 844]] as const
    const verticalPaths = [[390, 80, 700], [730, 56, 756], [880, 392, 710]] as const
    const nodes = [[198, 244], [540, 194], [1030, 236], [314, 546], [720, 540], [1055, 545]] as const
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0

    const draw = (time: number) => {
      context.fillStyle = '#242529'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.strokeStyle = '#303237'
      context.lineWidth = 1
      for (let x = 0; x < canvas.width; x += 48) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, canvas.height)
        context.stroke()
      }
      for (let y = 0; y < canvas.height; y += 48) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(canvas.width, y)
        context.stroke()
      }

      for (const [x, y, width, height] of rooms) {
        context.strokeStyle = '#55575c'
        context.lineWidth = 2
        context.strokeRect(x, y, width, height)
        context.strokeStyle = '#2c2e33'
        context.lineWidth = 1
        context.strokeRect(x + 10, y + 10, width - 20, height - 20)
      }

      context.strokeStyle = '#e23e43'
      context.lineWidth = 5
      for (const [x1, y, x2] of horizontalPaths) {
        context.beginPath()
        context.moveTo(x1, y)
        context.lineTo(x2, y)
        context.stroke()
      }
      for (const [x, y1, y2] of verticalPaths) {
        context.beginPath()
        context.moveTo(x, y1)
        context.lineTo(x, y2)
        context.stroke()
      }

      context.fillStyle = '#e23e43'
      for (const [x, y] of nodes) {
        context.beginPath()
        context.arc(x, y, 7, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#242529'
        context.beginPath()
        context.arc(x, y, 3, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#e23e43'
      }

      if (!reduceMotion) {
        const horizontalProgress = (time / 2600) % 1
        for (const [index, [x1, y, x2]] of horizontalPaths.entries()) {
          const x = x1 + ((horizontalProgress + index * .26) % 1) * (x2 - x1)
          context.fillStyle = '#fff4f2'
          context.beginPath()
          context.arc(x, y, 4, 0, Math.PI * 2)
          context.fill()
        }
        const verticalProgress = (time / 3200) % 1
        for (const [index, [x, y1, y2]] of verticalPaths.entries()) {
          const y = y1 + ((verticalProgress + index * .33) % 1) * (y2 - y1)
          context.fillStyle = '#fff4f2'
          context.beginPath()
          context.arc(x, y, 4, 0, Math.PI * 2)
          context.fill()
        }
        const scanX = ((time / 10000) % 1) * canvas.width
        context.strokeStyle = 'rgba(255, 244, 242, .2)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(scanX, 0)
        context.lineTo(scanX, canvas.height)
        context.stroke()
        frame = requestAnimationFrame(draw)
      }
    }

    draw(0)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <div className="hero-art"><canvas ref={canvasRef} aria-hidden="true" /></div>
}

function Overview({ save, onNavigate, updateSave }: { save: ParsedSave; onNavigate: (view: View) => void; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const size = worldSize(save)
  const groups = save.manager?.groups ?? []
  const objectCount = groups.reduce((sum, group) => sum + group.instances.length, 0)
  const minions = groupByTag(save, 'Minion')?.instances.length ?? 0
  const cycle = scalarNumber(gameValue(save, 'GameClock', 'cycle'))
  const sandbox = gameValue(save, 'SaveGame', 'sandboxEnabled')
  const activeMods = member(save.saveFileRoot, 'active_mods')?.value
  const top = topGroups(save).slice(0, 7)

  return (
    <div className="view-stack">
      <div className="metric-grid">
        <Metric icon={<Gauge size={18} />} label="当前周期" value={formatNumber(cycle, 0)} note="GameClock" accent="teal" />
        <Metric icon={<Users size={18} />} label="复制人" value={String(minions)} note="Minion group" accent="blue" />
        <Metric icon={<Grid2x2 size={18} />} label="世界尺寸" value={`${size.width} × ${size.height}`} note="simulation grid" accent="amber" />
        <Metric icon={<Boxes size={18} />} label="对象实例" value={objectCount.toLocaleString()} note={`${groups.length} 个分组`} accent="red" />
      </div>
      <div className="split-grid overview-grid">
        <section className="surface quick-surface">
          <SectionHeading icon={<SlidersHorizontal size={16} />} title="快速设置" action="SaveGame" />
          <div className="settings-list">
            <InlineMember label="当前周期" value={gameValue(save, 'GameClock', 'cycle')} updateSave={updateSave} componentName="GameClock" memberName="cycle" />
            <InlineMember label="沙盒模式" value={sandbox} updateSave={updateSave} componentName="SaveGame" memberName="sandboxEnabled" />
            <InlineMember label="游戏速度" value={gameValue(save, 'SaveGame', 'speed')} updateSave={updateSave} componentName="SaveGame" memberName="speed" />
            <InlineMember label="时间倍率" value={gameValue(save, 'TimeOfDay', 'scale')} updateSave={updateSave} componentName="TimeOfDay" memberName="scale" />
          </div>
          <div className="surface-foot">修改会在导出时写回对应的 KSerialization 字段。</div>
        </section>
        <section className="surface file-surface">
          <SectionHeading icon={<Archive size={16} />} title="存档状态" action="HEADER" />
          <div className="info-table">
            <InfoRow label="压缩方式" value={save.header.compression === 1 ? 'zlib' : 'raw'} />
            <InfoRow label="模拟区" value={`${save.simSection?.bytes.length.toLocaleString() ?? 0} bytes`} />
            <InfoRow label="SaveManager" value={`${groups.length} groups`} />
            <InfoRow label="活动模组" value={activeMods?.kind === 'list' ? `${activeMods.items.length} mods` : scalarText(activeMods)} />
          </div>
        </section>
      </div>
      <section className="surface groups-surface">
        <SectionHeading icon={<Layers3 size={16} />} title="对象分布" action="TOP GROUPS" />
        <div className="group-bars">
          {top.map((group, index) => (
            <button key={group.tag} type="button" className="group-bar" onClick={() => onNavigate('objects')}>
              <span className="group-index">0{index + 1}</span>
              <span className="group-name">{group.tag}</span>
              <span className="bar-track"><span style={{ width: `${Math.max(3, (group.count / (top[0]?.count || 1)) * 100)}%` }} /></span>
              <strong>{group.count.toLocaleString()}</strong>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function MapView({ save, updateSave }: { save: ParsedSave; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const [visibleLayers, setVisibleLayers] = useState<MapLayerVisibility>(DEFAULT_MAP_LAYER_VISIBILITY)
  const [overlay, setOverlay] = useState<MapOverlay>('none')
  const [tool, setTool] = useState<MapTool>('inspect')
  const [brushSize, setBrushSize] = useState(1)
  const [lastCell, setLastCell] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<MapSelection | null>(null)
  const [selectedElement, setSelectedElement] = useState(0x0307)
  const undoStackRef = useRef<MapEdit[][]>([])
  const redoStackRef = useRef<MapEdit[][]>([])
  const elementProfilesRef = useRef(new Map<number, { properties: number; insulation: number } | undefined>())
  const strokeActiveRef = useRef(false)
  const pendingStrokeRef = useRef(new Map<string, MapCellUpdate>())
  const previewCellsRef = useRef(new Map<string, MapPreviewCell>())
  const previewFrameRef = useRef<number | null>(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [, refreshHistory] = useState(0)
  const size = worldSize(save)
  const sim = save.simData
  const selectedCell = sim && lastCell ? getWorldCell(sim, lastCell.x, lastCell.y) : undefined
  const overlayLabel = MAP_OVERLAYS.find((item) => item.id === overlay)?.label ?? '无'

  const toggleLayer = (layer: MapLayer) => {
    setVisibleLayers((current) => ({ ...current, [layer]: !current[layer] }))
  }

  const assignSimData = (current: ParsedSave, next: NonNullable<ParsedSave['simData']>) => {
    current.simData = next
    current.simSection!.bytes = next.bytes
    const streamed = member(current.saveFileRoot, 'streamed')?.value
    if (streamed?.kind !== 'dict') return
    const simIndex = streamed.keys.findIndex((key) => key.kind === 'string' && key.v === 'Sim')
    const streamedSim = simIndex >= 0 ? streamed.values[simIndex] : undefined
    if (streamedSim?.kind === 'raw-pod' && streamedSim.bytes.length === next.bytes.length) streamedSim.bytes = next.bytes
  }

  const commitCells = (updates: Array<{ x: number; y: number; patch: Partial<SimCell> }>) => {
    if (!sim || updates.length === 0) return
    const next = setWorldCells(sim, updates)
    if (!next) return
    const edits: MapEdit[] = []
    const seen = new Set<string>()
    updates.forEach(({ x, y }) => {
      const key = `${x}:${y}`
      if (seen.has(key)) return
      const before = getWorldCell(sim, x, y)
      const after = getWorldCell(next, x, y)
      if (before && after) edits.push({ x, y, before, after })
      seen.add(key)
    })
    if (edits.length > 0) {
      undoStackRef.current.push(edits)
      refreshHistory((value) => value + 1)
    }
    redoStackRef.current = []
    updateSave((current) => assignSimData(current, next))
  }

  const patchCell = (coordinates: { x: number; y: number } | null, patch: Partial<SimCell>) => {
    if (!coordinates) return
    commitCells([{ x: coordinates.x, y: coordinates.y, patch }])
  }

  const elementPatch = (hash: number, current?: SimCell): Partial<SimCell> => {
    const profile = sim
      ? (elementProfilesRef.current.has(hash)
        ? elementProfilesRef.current.get(hash)
        : (() => {
            const next = getSimElementProfile(sim, hash)
            elementProfilesRef.current.set(hash, next)
            return next
          })())
      : undefined
    if (hash === 0xbf75) return { elementHash: hash, properties: profile?.properties ?? 0x39, insulation: profile?.insulation ?? 0x2d, temperature: 0, mass: 0 }
    const defaults = defaultElementValues(hash)
    return {
      elementHash: hash,
      properties: profile?.properties ?? current?.properties ?? 0,
      insulation: profile?.insulation ?? current?.insulation ?? 0xff,
      temperature: current && current.temperature > 0 ? current.temperature : defaults.temperature,
      mass: current && current.mass > 0 ? current.mass : defaults.mass,
    }
  }

  const queueStrokeCells = (cells: MapCellUpdate[]) => {
    if (cells.length === 0) return
    cells.forEach((cell) => {
      pendingStrokeRef.current.set(`${cell.x}:${cell.y}`, cell)
      previewCellsRef.current.set(`${cell.x}:${cell.y}`, {
        x: cell.x,
        y: cell.y,
        elementHash: cell.patch.elementHash ?? 0xbf75,
      })
    })
    refreshPreview()
  }

  const refreshPreview = (immediate = false) => {
    if (immediate) {
      if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current)
      previewFrameRef.current = null
      setPreviewVersion((value) => value + 1)
      return
    }
    if (previewFrameRef.current !== null) return
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null
      setPreviewVersion((value) => value + 1)
    })
  }

  useEffect(() => () => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.key !== '[' && event.key !== ']') return
      event.preventDefault()
      setBrushSize((current) => Math.max(1, Math.min(21, current + (event.key === ']' ? 2 : -2))))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const patchBrush = (x: number, y: number) => {
    if (!sim) return
    const radius = Math.floor(brushSize / 2)
    const cells: MapCellUpdate[] = []
    for (let offsetY = -radius; offsetY <= radius; offsetY++) {
      for (let offsetX = -radius; offsetX <= radius; offsetX++) {
        const cellX = x + offsetX
        const cellY = y + offsetY
        if (cellX < 0 || cellY < 0 || cellX >= size.width || cellY >= size.height) continue
        const current = getWorldCell(sim, cellX, cellY)
        cells.push({
          x: cellX,
          y: cellY,
          patch: tool === 'erase' ? elementPatch(0xbf75, current) : elementPatch(selectedElement, current),
        })
      }
    }
    if (!strokeActiveRef.current) {
      commitCells(cells)
      return
    }
    queueStrokeCells(cells)
  }

  const previewShape = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (!strokeActiveRef.current) return
    pendingStrokeRef.current.clear()
    previewCellsRef.current.clear()
    const points = tool === 'rectangle'
      ? rectangleCells(start, end)
      : lineCells(start, end, brushSize, size.width, size.height)
    queueStrokeCells(points.map(({ x, y }) => ({
      x,
      y,
      patch: tool === 'erase' ? elementPatch(0xbf75) : elementPatch(selectedElement),
    })))
  }

  const fillCell = (x: number, y: number) => {
    if (!sim) return
    const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
    const start = readSimCell(sim, view, x + 1, y + 1)
    if (!start) return
    const nextElement = selectedElement
    if (start.elementHash === nextElement) return
    const visited = new Uint8Array(size.width * size.height)
    const queue: Array<{ x: number; y: number }> = [{ x, y }]
    const cells: MapCellUpdate[] = []
    let cursor = 0
    while (cursor < queue.length) {
      const current = queue[cursor++]
      if (current.x < 0 || current.y < 0 || current.x >= size.width || current.y >= size.height) continue
      const index = current.y * size.width + current.x
      if (visited[index]) continue
      visited[index] = 1
      const cell = readSimCell(sim, view, current.x + 1, current.y + 1)
      if (!cell || cell.elementHash !== start.elementHash) continue
      cells.push({ x: current.x, y: current.y, patch: elementPatch(nextElement, cell) })
      queue.push({ x: current.x - 1, y: current.y }, { x: current.x + 1, y: current.y }, { x: current.x, y: current.y - 1 }, { x: current.x, y: current.y + 1 })
    }
    commitCells(cells)
  }

  const handleCell = (x: number, y: number) => {
    if (tool === 'inspect' || tool === 'eyedropper') {
      const cell = sim ? getWorldCell(sim, x, y) : undefined
      setLastCell({ x, y })
      if (cell) setSelectedElement(cell.elementHash)
      return
    }
    if (tool === 'fill') {
      fillCell(x, y)
      return
    }
    patchBrush(x, y)
  }

  const beginStroke = () => {
    strokeActiveRef.current = true
    pendingStrokeRef.current.clear()
    previewCellsRef.current.clear()
    refreshPreview(true)
  }

  const endStroke = () => {
    if (!strokeActiveRef.current) return
    strokeActiveRef.current = false
    const updates = [...pendingStrokeRef.current.values()]
    pendingStrokeRef.current.clear()
    previewCellsRef.current.clear()
    refreshPreview(true)
    if (updates.length > 0) commitCells(updates)
  }

  const applyHistory = (edits: MapEdit[], direction: 'undo' | 'redo') => {
    const updates = edits.map((edit) => ({ x: edit.x, y: edit.y, patch: direction === 'undo' ? edit.before : edit.after }))
    const next = sim ? setWorldCells(sim, updates) : undefined
    if (!next) return
    updateSave((current) => assignSimData(current, next))
  }

  const undo = () => {
    const edits = undoStackRef.current.pop()
    if (!edits) return
    redoStackRef.current.push(edits)
    applyHistory(edits, 'undo')
  }

  const redo = () => {
    const edits = redoStackRef.current.pop()
    if (!edits) return
    undoStackRef.current.push(edits)
    applyHistory(edits, 'redo')
  }

  const selectedElementList = elementOptions(selectedCell?.elementHash ?? selectedElement)
  const selectionBounds = selection ? normalizedSelection(selection) : undefined

  return (
    <div className="map-workbench">
      <aside className="map-tool-rail">
        <div className="tool-rail-title">TOOLS</div>
        <div className="tool-rail-buttons">
          <button type="button" className={tool === 'inspect' ? 'selected' : ''} onClick={() => setTool('inspect')} title="选择并查看单元"><Search size={19} /><span>选择</span></button>
          <button type="button" className={tool === 'move' ? 'selected' : ''} onClick={() => setTool('move')} title="移动地图视图"><Hand size={19} /><span>移动</span></button>
          <button type="button" className={tool === 'paint' ? 'selected' : ''} onClick={() => setTool('paint')} disabled={!sim} title="连续涂抹所选元素"><Paintbrush size={19} /><span>画笔</span></button>
          <button type="button" className={tool === 'erase' ? 'selected' : ''} onClick={() => setTool('erase')} disabled={!sim} title="连续擦除单元内容"><Eraser size={19} /><span>橡皮</span></button>
          <button type="button" className={tool === 'eyedropper' ? 'selected' : ''} onClick={() => setTool('eyedropper')} disabled={!sim} title="吸取地图中的元素"><Pipette size={19} /><span>吸管</span></button>
          <button type="button" className={tool === 'fill' ? 'selected' : ''} onClick={() => setTool('fill')} disabled={!sim} title="填充相连的同类区域"><PaintBucket size={19} /><span>油漆桶</span></button>
          <button type="button" className={tool === 'rectangle' ? 'selected' : ''} onClick={() => setTool('rectangle')} disabled={!sim} title="绘制填充矩形"><Square size={19} /><span>矩形</span></button>
          <button type="button" className={tool === 'line' ? 'selected' : ''} onClick={() => setTool('line')} disabled={!sim} title="绘制直线"><Minus size={19} /><span>直线</span></button>
        </div>
        <div className="tool-rail-divider" />
        <div className="tool-rail-bottom"><span className="status-dot" /><span>{size.width} × {size.height}</span><small>{sim ? `SIM v${sim.version}` : '无模拟区'}</small></div>
      </aside>
      <section className="map-center-panel">
        <div className="map-center-toolbar">
          <div className="toolbar-group map-overlay-control"><span className="toolbar-label">分析覆盖</span><select value={overlay} onChange={(event) => setOverlay(event.target.value as MapOverlay)}>
            {MAP_OVERLAYS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></div>
          <div className="toolbar-spacer" />
          <div className="map-readout"><span className="status-dot" />{size.width} × {size.height}<span className="muted">{sim ? `SIM v${sim.version}` : '无模拟区'}</span></div>
        </div>
        <div className="map-canvas-panel">
          <MapCanvas save={save} visibleLayers={visibleLayers} overlay={overlay} tool={tool} brushSize={brushSize} selectedCell={lastCell} selection={selection} previewCells={previewCellsRef.current} previewVersion={previewVersion} onCell={handleCell} onSelectionChange={(next) => { setSelection(next); if (next) setLastCell(null) }} onShape={previewShape} onStrokeStart={beginStroke} onStrokeEnd={endStroke} />
          <div className="map-legend"><span><i className="legend-visible" />独立图层</span><span><i className="legend-entity" />{overlay === 'none' ? '无分析覆盖' : `${overlayLabel}覆盖`}</span><span><i className="legend-damage" />选中单元</span><span className="legend-help">SIM 网格含四周边界层</span></div>
        </div>
      </section>
      <aside className="map-parameter-rail map-info">
          <section className="map-layer-settings">
            <SectionHeading icon={<Layers3 size={16} />} title="图层" action="STACK" />
            <div className="map-layer-stack">
              {MAP_LAYERS.map((item) => <button key={item.id} type="button" className={`map-layer-row ${visibleLayers[item.id] ? 'visible' : 'hidden'}`} onClick={() => toggleLayer(item.id)} title={`${visibleLayers[item.id] ? '隐藏' : '显示'}${item.label}`}>
                {visibleLayers[item.id] ? <Eye size={15} /> : <EyeOff size={15} />}
                <span className={`layer-swatch layer-swatch-${item.id}`} />
                <span className="map-layer-name">{item.label}</span>
                <small>{item.detail}</small>
              </button>)}
            </div>
          </section>
          <div className="map-section-divider" />
          <section className="map-tool-settings">
            <SectionHeading icon={<SlidersHorizontal size={16} />} title="工具参数" action={tool.toUpperCase()} />
            <label className="rail-control"><span>元素</span><select value={selectedElement} onChange={(event) => setSelectedElement(Number(event.target.value))}>
              {elementOptions(selectedElement).map((element) => <option key={element.hash} value={element.hash}>{element.name}</option>)}
            </select></label>
            <label className="rail-control rail-brush-control"><span>笔刷大小</span><input type="range" min="1" max="21" step="2" value={brushSize} disabled={!sim || !['paint', 'erase', 'line'].includes(tool)} onChange={(event) => setBrushSize(Number(event.target.value))} /><output>{brushSize} × {brushSize}</output></label>
            <div className="history-buttons tool-history"><button type="button" title="撤销上一次编辑" aria-label="撤销上一次编辑" disabled={undoStackRef.current.length === 0} onClick={undo}><Undo2 size={16} /></button><button type="button" title="重做上一次编辑" aria-label="重做上一次编辑" disabled={redoStackRef.current.length === 0} onClick={redo}><Redo2 size={16} /></button></div>
          </section>
          <div className="map-section-divider" />
          <SectionHeading icon={<Settings2 size={16} />} title={selectionBounds ? '区域选择' : '单元检查'} action={selectionBounds ? `${selectionBounds.width}×${selectionBounds.height}` : selectedCell ? formatHash(selectedCell.elementHash) : 'SIM'} />
          <div className="map-info-copy">直接读取存档中的 SIM cell。元素替换、温度和质量会随着导出写回原始二进制结构。</div>
          {selectionBounds ? <>
            <div className="coordinate-box selection-coordinate-box"><span>当前选区</span><strong>{selectionBounds.width}×{selectionBounds.height}</strong><small>{selectionBounds.cells} 格 · {selectionBounds.minX}, {selectionBounds.minY} 至 {selectionBounds.maxX}, {selectionBounds.maxY}</small></div>
            <div className="map-stat"><span>覆盖格子</span><strong>{selectionBounds.cells.toLocaleString()} 格</strong></div>
            <div className="inspector-empty map-empty selection-empty"><Square size={18} /><span>可继续使用其他工具编辑选区</span></div>
          </> : <>
          <div className="coordinate-box"><span>当前单元</span><strong>{lastCell ? `${lastCell.x}, ${lastCell.y}` : '—'}</strong><small>{lastCell ? `world index ${lastCell.y * size.width + lastCell.x}` : '点击地图查看坐标'}</small></div>
          {selectedCell && lastCell ? <>
            <label className="sim-field"><span>元素</span><select value={selectedCell.elementHash} onChange={(event) => patchCell(lastCell, elementPatch(Number(event.target.value), selectedCell))}>
              {selectedElementList.map((element) => <option key={element.hash} value={element.hash}>{element.name}</option>)}
            </select></label>
            <label className="sim-field"><span>温度 °C</span><input type="number" step="0.1" value={(selectedCell.temperature - 273.15).toFixed(2)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) patchCell(lastCell, { temperature: value + 273.15 }) }} /></label>
            <label className="sim-field"><span>质量 kg</span><input type="number" min="0" step="0.001" value={selectedCell.mass.toFixed(3)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) patchCell(lastCell, { mass: value }) }} /></label>
            <div className="map-stat"><span>状态</span><strong>{elementForHash(selectedCell.elementHash).state}</strong></div>
            <div className="map-stat"><span>属性字节</span><strong>{formatHash(selectedCell.properties)}</strong></div>
            <div className="map-stat"><span>绝缘 / 强度</span><strong>{selectedCell.insulation} / {selectedCell.strengthInfo}</strong></div>
          </> : <div className="inspector-empty map-empty"><Search size={18} /><span>选择一个单元查看数据</span></div>}
          </>}
          <div className="map-stat"><span>模拟网格</span><strong>{sim ? `${sim.width} × ${sim.height}` : '—'}</strong></div>
      </aside>
    </div>
  )
}

function rectangleCells(start: { x: number; y: number }, end: { x: number; y: number }): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = []
  for (let y = Math.min(start.y, end.y); y <= Math.max(start.y, end.y); y++) {
    for (let x = Math.min(start.x, end.x); x <= Math.max(start.x, end.x); x++) cells.push({ x, y })
  }
  return cells
}

function normalizedSelection(selection: MapSelection): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number; cells: number } {
  const minX = Math.min(selection.start.x, selection.end.x)
  const maxX = Math.max(selection.start.x, selection.end.x)
  const minY = Math.min(selection.start.y, selection.end.y)
  const maxY = Math.max(selection.start.y, selection.end.y)
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  return { minX, maxX, minY, maxY, width, height, cells: width * height }
}

function lineCells(start: { x: number; y: number }, end: { x: number; y: number }, brushSize: number, width: number, height: number): Array<{ x: number; y: number }> {
  const cells = new Map<string, { x: number; y: number }>()
  const radius = Math.floor(brushSize / 2)
  const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  for (let step = 0; step <= steps; step++) {
    const progress = steps === 0 ? 0 : step / steps
    const centerX = Math.round(start.x + (end.x - start.x) * progress)
    const centerY = Math.round(start.y + (end.y - start.y) * progress)
    for (let offsetY = -radius; offsetY <= radius; offsetY++) {
      for (let offsetX = -radius; offsetX <= radius; offsetX++) {
        const x = centerX + offsetX
        const y = centerY + offsetY
        if (x >= 0 && y >= 0 && x < width && y < height) cells.set(`${x}:${y}`, { x, y })
      }
    }
  }
  return [...cells.values()]
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, select, textarea, button, [contenteditable="true"]'))
}

function buildingLayerColor(tag: string): string {
  let hash = 0
  for (let index = 0; index < tag.length; index++) hash = (hash * 31 + tag.charCodeAt(index)) | 0
  return ['#e4b067', '#8fb5c3', '#c98a78', '#a9a0ca'][Math.abs(hash) % 4]
}

function createElementPatterns(context: CanvasRenderingContext2D, textures: Record<string, HTMLImageElement>, cellSize: number, worldOriginX: number, worldBottomY: number): Map<string, CanvasPattern | null> {
  const patterns = new Map<string, CanvasPattern | null>()
  Object.entries(textures).forEach(([path, image]) => {
    const pattern = context.createPattern(image, 'repeat')
    if (pattern) {
      const element = ELEMENTS.find((candidate) => candidate.texture === path)
      const worldUvScale = element?.worldUvScale ?? DEFAULT_ELEMENT_WORLD_UV_SCALE
      const scaleX = (cellSize * worldUvScale) / image.naturalWidth
      const scaleY = (cellSize * worldUvScale) / image.naturalHeight
      const yOffset = worldBottomY - cellSize * worldUvScale
      pattern.setTransform(new DOMMatrix([scaleX, 0, 0, scaleY, worldOriginX, yOffset]))
    }
    patterns.set(path, pattern)
  })
  return patterns
}

type RgbColor = { r: number; g: number; b: number }
type FluidRenderCell = {
  x: number
  y: number
  px: number
  py: number
  cellSize: number
  cell: SimCell
  style: FluidMaterialStyle
  state: 'gas' | 'liquid'
  surfaceTop: boolean
  edgeLeft: boolean
  edgeRight: boolean
  edgeBottom: boolean
  contactPath?: Path2D
}
const fluidColorCache = new Map<string, RgbColor>()

function fluidRgb(color: string): RgbColor {
  const cached = fluidColorCache.get(color)
  if (cached) return cached
  const normalized = color.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized
  const parsed = Number.parseInt(value, 16)
  const result = Number.isFinite(parsed)
    ? { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 }
    : { r: 255, g: 255, b: 255 }
  fluidColorCache.set(color, result)
  return result
}

function fluidRgba(color: string, alpha: number): string {
  const { r, g, b } = fluidRgb(color)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}

function fluidDensity(cell: SimCell, state: 'gas' | 'liquid'): number {
  const mass = Math.max(0, cell.mass)
  if (state === 'gas') return .2 + .8 * (1 - Math.exp(-mass / 2.2))
  return .2 + .8 * (1 - Math.exp(-mass / 520))
}

function fluidPhase(worldX: number, worldY: number, timeSeconds: number, speed: number): number {
  const base = worldX * .73 + worldY * .41
  return Math.sin(base + timeSeconds * speed * 2.1) * .5 + Math.sin(worldX * .19 - worldY * .67 + timeSeconds * speed * 1.3) * .3 + Math.sin(worldX * .047 + worldY * .11 + timeSeconds * speed * .7) * .2
}

function drawFluidBase(context: CanvasRenderingContext2D, style: FluidMaterialStyle, cell: SimCell, state: 'gas' | 'liquid', px: number, py: number, cellSize: number): void {
  const density = fluidDensity(cell, state)
  const alpha = state === 'gas'
    ? .08 + density * .28
    : style.opaque ? .34 + density * .22 : .19 + density * .3
  // The shader's body is translucent and screen-blended. A flat base keeps adjacent
  // cells from creating artificial seams; the continuous light pass adds the depth.
  context.fillStyle = fluidRgba(style.gradientBottom, alpha)
  context.fillRect(px, py, cellSize, cellSize)
}

function fluidSurfaceRuns(cells: FluidRenderCell[]): FluidRenderCell[][] {
  const rows = new Map<number, FluidRenderCell[]>()
  for (const cell of cells) {
    if (cell.state !== 'liquid' || !cell.surfaceTop) continue
    const row = rows.get(cell.y) ?? []
    row.push(cell)
    rows.set(cell.y, row)
  }
  const runs: FluidRenderCell[][] = []
  for (const row of rows.values()) {
    row.sort((left, right) => left.x - right.x)
    let run: FluidRenderCell[] = []
    for (const cell of row) {
      const previous = run[run.length - 1]
      if (previous && (cell.x !== previous.x + 1 || cell.cell.elementHash !== previous.cell.elementHash)) {
        runs.push(run)
        run = []
      }
      run.push(cell)
    }
    if (run.length > 0) runs.push(run)
  }
  return runs
}

function drawFluidSurfaceRuns(context: CanvasRenderingContext2D, runs: FluidRenderCell[][], timeSeconds: number, animated: boolean): void {
  if (runs.length === 0) return
  for (const run of runs) {
    const first = run[0]
    const last = run[run.length - 1]
    const style = first.style
    const cellSize = first.cellSize
    const left = first.px
    const right = last.px + cellSize
    const sampleStep = Math.max(3, cellSize * .45)
    const sampleCount = Math.max(4, Math.ceil((right - left) / sampleStep))
    const surfaceY = (x: number) => first.py + cellSize * (.035 + fluidPhase(first.x + (x - left) / cellSize, first.y, timeSeconds, style.flowSpeed) * .018)
    const density = run.reduce((total, cell) => total + fluidDensity(cell.cell, 'liquid'), 0) / run.length

    context.save()
    context.globalCompositeOperation = animated ? 'screen' : 'source-over'
    context.beginPath()
    context.moveTo(left, surfaceY(left))
    for (let index = 1; index <= sampleCount; index++) {
      const x = left + (right - left) * index / sampleCount
      context.lineTo(x, surfaceY(Math.min(right, x)))
    }
    if (!animated) {
      context.lineTo(right, first.py + cellSize * .23)
      context.lineTo(left, first.py + cellSize * .23)
      context.closePath()
      const surfaceGradient = context.createLinearGradient(0, first.py, 0, first.py + cellSize * .25)
      surfaceGradient.addColorStop(0, fluidRgba('#ffffff', .11 + density * .08))
      surfaceGradient.addColorStop(.24, fluidRgba(style.gradientTop, .08 + density * .06))
      surfaceGradient.addColorStop(1, fluidRgba(style.gradientBottom, 0))
      context.fillStyle = surfaceGradient
      context.fill()
    }
    context.beginPath()
    context.moveTo(left, surfaceY(left))
    for (let index = 1; index <= sampleCount; index++) {
      const x = left + (right - left) * index / sampleCount
      context.lineTo(x, surfaceY(Math.min(right, x)))
    }
    context.strokeStyle = fluidRgba('#ffffff', animated ? .06 + density * .08 : .16 + density * .09)
    context.lineWidth = Math.max(1, Math.min(3, cellSize * .045))
    context.lineCap = 'round'
    context.stroke()
    context.restore()
  }
}

function fluidBoundaryCells(cells: FluidRenderCell[]): FluidRenderCell[] {
  return cells.filter((cell) => cell.contactPath !== undefined)
}

function drawFluidBoundaryGlow(context: CanvasRenderingContext2D, liquidCells: FluidRenderCell[], animated: boolean): void {
  if (liquidCells.length === 0) return
  context.save()
  context.globalCompositeOperation = animated ? 'screen' : 'source-over'
  for (const cell of liquidCells) {
    if (!cell.contactPath) continue
    context.save()
    context.translate(cell.px, cell.py)
    context.scale(cell.cellSize, cell.cellSize)
    const liquid = cell.state === 'liquid'
    context.strokeStyle = fluidRgba(liquid ? '#d9ffff' : cell.style.gradientTop, animated ? liquid ? .09 : .035 : liquid ? .2 : .07)
    context.lineWidth = Math.max(liquid ? .8 : .55, Math.min(liquid ? 2.5 : 1.5, cell.cellSize * (liquid ? .06 : .035))) / Math.max(1, cell.cellSize)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.shadowColor = fluidRgba(liquid ? '#8feef4' : cell.style.gradientTop, animated ? liquid ? .22 : .07 : liquid ? .38 : .12)
    context.shadowBlur = Math.max(1, Math.min(liquid ? 14 : 7, cell.cellSize * (liquid ? .42 : .2))) / Math.max(1, cell.cellSize)
    context.stroke(cell.contactPath)
    context.restore()
  }
  context.restore()
}

type FluidRegion = {
  path: Path2D
  style: FluidMaterialStyle
  state: 'gas' | 'liquid'
  minX: number
  minY: number
  maxX: number
  maxY: number
  cellSize: number
}

function fluidRegions(cells: FluidRenderCell[]): FluidRegion[] {
  const regions = new Map<number, FluidRegion>()
  for (const cell of cells) {
    if (cell.state !== 'liquid' && cell.state !== 'gas') continue
    const key = cell.cell.elementHash
    let region = regions.get(key)
    if (!region) {
      region = { path: new Path2D(), style: cell.style, state: cell.state, minX: cell.px, minY: cell.py, maxX: cell.px + cell.cellSize, maxY: cell.py + cell.cellSize, cellSize: cell.cellSize }
      regions.set(key, region)
    }
    region.path.rect(cell.px, cell.py, cell.cellSize, cell.cellSize)
    region.minX = Math.min(region.minX, cell.px)
    region.minY = Math.min(region.minY, cell.py)
    region.maxX = Math.max(region.maxX, cell.px + cell.cellSize)
    region.maxY = Math.max(region.maxY, cell.py + cell.cellSize)
  }
  return [...regions.values()]
}

function drawFluidRegionBase(context: CanvasRenderingContext2D, regions: FluidRegion[]): void {
  for (const region of regions) {
    if (region.state !== 'liquid') continue
    const height = region.maxY - region.minY
    context.save()
    context.clip(region.path)
    const bodyGradient = context.createLinearGradient(0, region.minY, 0, region.maxY)
    bodyGradient.addColorStop(0, fluidRgba(region.style.gradientTop, .16))
    bodyGradient.addColorStop(.42, fluidRgba(region.style.gradientTop, .025))
    bodyGradient.addColorStop(1, fluidRgba(region.style.gradientBottom, .13))
    context.fillStyle = bodyGradient
    context.fillRect(region.minX, region.minY, region.maxX - region.minX, height)
    context.restore()
  }
}

function drawFluidRegionAnimation(context: CanvasRenderingContext2D, regions: FluidRegion[], timeSeconds: number): void {
  for (const region of regions) {
    const style = region.style
    const isLiquid = region.state === 'liquid'
    const width = region.maxX - region.minX
    const height = region.maxY - region.minY
    context.save()
    context.clip(region.path)
    context.globalCompositeOperation = 'screen'

    // A slow broad sheen approximates the material's Fresnel response without
    // introducing a repeated stripe at every cell boundary.
    const travel = ((timeSeconds * style.flowSpeed * Math.max(region.cellSize, width) * .18) % Math.max(region.cellSize, width * 1.6)) - width * .35
    const sheen = context.createLinearGradient(region.minX + travel, region.minY, region.minX + travel + Math.max(region.cellSize * 2, width * .28), region.maxY)
    sheen.addColorStop(0, fluidRgba('#ffffff', 0))
    sheen.addColorStop(.5, fluidRgba('#ffffff', isLiquid ? style.opaque ? .035 : .055 : .016))
    sheen.addColorStop(1, fluidRgba('#ffffff', 0))
    context.fillStyle = sheen
    context.fillRect(region.minX, region.minY, width, height)

    if (isLiquid && style.glows) {
      const glow = context.createRadialGradient(
        region.minX + width * (.32 + Math.sin(timeSeconds * style.flowSpeed) * .18),
        region.minY + height * .4,
        0,
        region.minX + width * .32,
        region.minY + height * .4,
        Math.max(region.cellSize * 2, width * .55),
      )
      glow.addColorStop(0, fluidRgba(style.gradientTop, .12))
      glow.addColorStop(1, fluidRgba(style.gradientTop, 0))
      context.fillStyle = glow
      context.fillRect(region.minX, region.minY, width, height)
    }

    const ribbonCount = isLiquid ? style.usesCaustics ? 6 : 3 : 2
    const ribbonAmplitude = isLiquid
      ? Math.max(region.cellSize * 1.6, Math.min(height * .16, region.cellSize * 6))
      : Math.max(region.cellSize * .45, Math.min(height * .08, region.cellSize * 2))
    const samples = Math.max(12, Math.ceil(width / Math.max(16, region.cellSize * 1.2)))
    for (let ribbon = 0; ribbon < ribbonCount; ribbon++) {
      const anchor = (ribbon + .55) / (ribbonCount + .8)
      const slope = (ribbon % 2 === 0 ? 1 : -1) * height * (.07 + (ribbon % 3) * .025)
      context.beginPath()
      for (let index = 0; index <= samples; index++) {
        const x = region.minX - region.cellSize * 2 + (width + region.cellSize * 4) * index / samples
        const normalizedX = (x - region.minX) / Math.max(1, width)
        const wave = Math.sin(x * .006 + timeSeconds * style.flowSpeed * 1.7 + ribbon * 1.83) * ribbonAmplitude
          + Math.sin(x * .017 - timeSeconds * style.flowSpeed * 1.1 + ribbon * .67) * ribbonAmplitude * .34
        const y = region.minY + height * anchor + slope * (normalizedX - .5) + wave
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.strokeStyle = fluidRgba('#8cebf1', isLiquid ? style.usesCaustics ? .045 : .022 : .012)
      context.lineWidth = Math.max(1.5, Math.min(12, region.cellSize * (isLiquid ? style.usesCaustics ? .16 : .1 : .06)))
      context.lineCap = 'round'
      context.shadowColor = fluidRgba('#70e6ee', isLiquid ? style.usesCaustics ? .24 : .11 : .05)
      context.shadowBlur = Math.max(2, Math.min(24, region.cellSize * (isLiquid ? style.usesCaustics ? .85 : .45 : .25)))
      context.stroke()

      if (isLiquid && style.usesCaustics && ribbon % 2 === 0) {
        context.strokeStyle = fluidRgba('#d8ffff', .06)
        context.lineWidth = Math.max(1, Math.min(4, region.cellSize * .045))
        context.shadowBlur = Math.max(2, Math.min(12, region.cellSize * .32))
        context.stroke()
      }
    }
    context.restore()
  }
}

function drawGeyserTexture(context: CanvasRenderingContext2D, image: HTMLImageElement, definition: GeyserTextureDefinition, cellSize: number, centerX: number, centerY: number): void {
  if (!image.naturalWidth || !image.naturalHeight) return
  const width = cellSize * definition.widthCells
  const height = width * image.naturalHeight / image.naturalWidth
  context.save()
  context.globalAlpha = .98
  context.imageSmoothingEnabled = false
  context.drawImage(image, centerX - width / 2, centerY - height / 2, width, height)
  context.restore()
}

function visibleMapRange(width: number, height: number, cellSize: number, originX: number, originY: number, viewportWidth: number, viewportHeight: number): { minX: number; maxX: number; minRow: number; maxRow: number } {
  return {
    minX: Math.max(0, Math.floor(-originX / cellSize) - 1),
    maxX: Math.min(width - 1, Math.ceil((viewportWidth - originX) / cellSize) + 1),
    minRow: Math.max(0, Math.floor(-originY / cellSize) - 1),
    maxRow: Math.min(height - 1, Math.ceil((viewportHeight - originY) / cellSize) + 1),
  }
}

function terrainMaterialOrder(hash: number | undefined): number {
  if (hash === undefined) return Number.NEGATIVE_INFINITY
  const element = elementForHash(hash)
  if (element.state !== 'solid') return Number.NEGATIVE_INFINITY
  return element.terrainOrder ?? element.hash
}

function floodFillCoordinates(
  sim: NonNullable<ParsedSave['simData']>,
  width: number,
  height: number,
  startX: number,
  startY: number,
): Array<{ x: number; y: number }> {
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return []
  const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
  const start = readSimCell(sim, view, startX + 1, startY + 1)
  if (!start) return []
  const targetHash = start.elementHash
  const visited = new Uint8Array(width * height)
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
  const cells: Array<{ x: number; y: number }> = []
  let cursor = 0
  while (cursor < queue.length) {
    const current = queue[cursor++]
    if (current.x < 0 || current.y < 0 || current.x >= width || current.y >= height) continue
    const index = current.y * width + current.x
    if (visited[index]) continue
    visited[index] = 1
    const cell = readSimCell(sim, view, current.x + 1, current.y + 1)
    if (!cell || cell.elementHash !== targetHash) continue
    cells.push(current)
    queue.push(
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    )
  }
  return cells
}

function MapCanvas({ save, visibleLayers, overlay, tool, brushSize, selectedCell, selection, previewCells, previewVersion, onCell, onSelectionChange, onShape, onStrokeStart, onStrokeEnd }: { save: ParsedSave; visibleLayers: MapLayerVisibility; overlay: MapOverlay; tool: MapTool; brushSize: number; selectedCell: { x: number; y: number } | null; selection: MapSelection | null; previewCells: Map<string, MapPreviewCell>; previewVersion: number; onCell: (x: number, y: number) => void; onSelectionChange: (selection: MapSelection | null) => void; onShape: (start: { x: number; y: number }, end: { x: number; y: number }) => void; onStrokeStart: () => void; onStrokeEnd: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fluidCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const canvasLayerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const renderCacheRef = useRef<{ bytes: Uint8Array | null; cells: Map<number, SimCell | undefined>; paths: Map<string, Path2D>; zoneBytes: Uint8Array | null; zones: Uint8Array | null }>({ bytes: null, cells: new Map(), paths: new Map(), zoneBytes: null, zones: null })
  const pointerRef = useRef<{ mode: 'pan' | 'select' | 'brush' | 'shape' | 'point'; startX: number; startY: number; panX: number; panY: number; moved: boolean; lastCell: { x: number; y: number } | null; startCell: { x: number; y: number } | null } | null>(null)
  const visitedBrushCellsRef = useRef(new Set<string>())
  const brushCellRef = useRef<{ x: number; y: number } | null>(null)
  const fillRegionCacheRef = useRef<{ bytes: Uint8Array | null; regions: Map<number, Array<{ x: number; y: number }>> }>({ bytes: null, regions: new Map() })
  const spacePanRef = useRef(false)
  const [textures, setTextures] = useState<Record<string, HTMLImageElement>>({})
  const [biomeBackgrounds, setBiomeBackgrounds] = useState<Record<number, HTMLImageElement>>({})
  const [geyserTextures, setGeyserTextures] = useState<Record<string, HTMLImageElement>>({})
  const [buildingTextures, setBuildingTextures] = useState<Record<string, HTMLImageElement>>({})
  const [zoomPercent, setZoomPercent] = useState(50)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [spacePan, setSpacePan] = useState(false)
  const [brushCell, setBrushCell] = useState<{ x: number; y: number } | null>(null)
  const [selectionDraft, setSelectionDraft] = useState<MapSelection | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const size = worldSize(save)
  const fitCellSize = viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(MAP_CELL_PIXELS, viewportSize.width / size.width, viewportSize.height / size.height)
    : MAP_CELL_PIXELS
  const zoom = MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * zoomPercent / 100
  const displayCellSize = fitCellSize * zoom
  const devicePixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  // Keep the physical cell size fractional. Rounding every cell independently
  // makes the rendered grid drift away from the CSS hit-test coordinates.
  const renderCellSize = Math.max(1, displayCellSize * devicePixelRatio)
  const originX = ((viewportSize.width - size.width * displayCellSize) / 2 + pan.x) * devicePixelRatio
  const originY = ((viewportSize.height - size.height * displayCellSize) / 2 + pan.y) * devicePixelRatio
  const viewportPixelWidth = Math.max(1, Math.ceil(viewportSize.width * devicePixelRatio))
  const viewportPixelHeight = Math.max(1, Math.ceil(viewportSize.height * devicePixelRatio))

  const cachedSimCell = (sim: NonNullable<ParsedSave['simData']>, view: DataView, x: number, y: number): SimCell | undefined => {
    const cache = renderCacheRef.current
    if (cache.bytes !== sim.bytes) {
      cache.bytes = sim.bytes
      cache.cells.clear()
      cache.paths.clear()
    }
    const key = y * sim.width + x
    if (cache.cells.has(key)) return cache.cells.get(key)
    const cell = readSimCell(sim, view, x, y)
    cache.cells.set(key, cell)
    return cell
  }

  const cachedTerrainPath = (sim: NonNullable<ParsedSave['simData']>, key: string, factory: () => Path2D): Path2D => {
    const cache = renderCacheRef.current
    if (cache.bytes !== sim.bytes) {
      cache.bytes = sim.bytes
      cache.cells.clear()
      cache.paths.clear()
    }
    const cached = cache.paths.get(key)
    if (cached) return cached
    const path = factory()
    cache.paths.set(key, path)
    return path
  }

  const cachedWorldZoneMap = useCallback((sim: NonNullable<ParsedSave['simData']>): Uint8Array => {
    const cache = renderCacheRef.current
    if (cache.zoneBytes !== sim.bytes || !cache.zones) {
      cache.zoneBytes = sim.bytes
      cache.zones = buildWorldZoneMap(save, size.width, size.height)
    }
    return cache.zones
  }, [save, size.height, size.width])

  const setZoomPercentAround = (requestedPercent: number, clientX?: number, clientY?: number) => {
    const nextPercent = Math.max(0, Math.min(100, Math.round(requestedPercent)))
    if (nextPercent === zoomPercent) return
    const nextZoom = MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * nextPercent / 100
    const viewport = viewportRef.current
    if (!viewport || clientX === undefined || clientY === undefined) {
      setZoomPercent(nextPercent)
      return
    }
    const rect = viewport.getBoundingClientRect()
    const anchorX = clientX - rect.left - viewport.clientLeft
    const anchorY = clientY - rect.top - viewport.clientTop
    const currentOriginX = (viewport.clientWidth - size.width * displayCellSize) / 2 + pan.x
    const currentOriginY = (viewport.clientHeight - size.height * displayCellSize) / 2 + pan.y
    const worldX = (anchorX - currentOriginX) / displayCellSize
    const worldY = (anchorY - currentOriginY) / displayCellSize
    const nextCellSize = fitCellSize * nextZoom
    const nextOriginX = (viewport.clientWidth - size.width * nextCellSize) / 2
    const nextOriginY = (viewport.clientHeight - size.height * nextCellSize) / 2
    setPan({
      x: anchorX - nextOriginX - worldX * nextCellSize,
      y: anchorY - nextOriginY - worldY * nextCellSize,
    })
    setZoomPercent(nextPercent)
  }

  const pointToCell = (clientX: number, clientY: number): { x: number; y: number } | undefined => {
    const viewport = viewportRef.current
    if (!viewport || displayCellSize <= 0) return undefined
    const rect = viewport.getBoundingClientRect()
    const mapOriginX = (viewport.clientWidth - size.width * displayCellSize) / 2 + pan.x
    const mapOriginY = (viewport.clientHeight - size.height * displayCellSize) / 2 + pan.y
    const localX = clientX - rect.left - viewport.clientLeft
    const localY = clientY - rect.top - viewport.clientTop
    const mapX = (localX - mapOriginX) / displayCellSize
    const mapY = (localY - mapOriginY) / displayCellSize
    if (mapX < 0 || mapX >= size.width || mapY < 0 || mapY >= size.height) return undefined
    const x = Math.floor(mapX)
    const screenY = Math.floor(mapY)
    return { x, y: size.height - 1 - screenY }
  }

  const updateBrushCell = (cell: { x: number; y: number } | null) => {
    const previous = brushCellRef.current
    if (previous?.x === cell?.x && previous?.y === cell?.y) return
    brushCellRef.current = cell
    setBrushCell(cell)
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const updateSize = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    const paths = new Set(Object.values(BUILDING_TEXTURES).map((definition) => definition.path))
    paths.forEach((path) => {
      const image = new Image()
      image.onload = () => { if (active) setBuildingTextures((current) => ({ ...current, [path]: image })) }
      image.src = assetPath(path)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return
      event.preventDefault()
      if (spacePanRef.current) return
      spacePanRef.current = true
      setSpacePan(true)
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spacePanRef.current = false
      setSpacePan(false)
    }
    const clearSpacePan = () => {
      spacePanRef.current = false
      setSpacePan(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearSpacePan)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearSpacePan)
    }
  }, [])

  useEffect(() => {
    let active = true
    ELEMENTS.filter((element) => element.texture).forEach((element) => {
      const image = new Image()
      image.onload = () => { if (active) setTextures((current) => ({ ...current, [element.texture!]: image })) }
      image.src = assetPath(element.texture!)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const loads = Array.from({ length: 19 }, (_, textureIndex) => new Promise<{ textureIndex: number; image: HTMLImageElement } | null>((resolve) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => resolve({ textureIndex, image })
      image.onerror = () => resolve(null)
      image.src = assetPath(biomeBackgroundAsset(textureIndex))
    }))
    void Promise.all(loads).then((entries) => {
      if (!active) return
      const next: Record<number, HTMLImageElement> = {}
      entries.forEach((entry) => {
        if (entry) next[entry.textureIndex] = entry.image
      })
      setBiomeBackgrounds(next)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const paths = new Set(Object.values(GEYSER_TEXTURES).map((definition) => definition.path))
    paths.forEach((path) => {
      const image = new Image()
      image.onload = () => { if (active) setGeyserTextures((current) => ({ ...current, [path]: image })) }
      image.src = assetPath(path)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const sim = save.simData
    if (!canvas || !sim || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    const cellSize = renderCellSize
    canvas.width = viewportPixelWidth
    canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = false
    // Leave empty cells transparent so the viewport can show the space scene
    // behind the SIM grid. Terrain, backwalls, fluids, and overlays paint on
    // top of this layer as usual.
    context.clearRect(0, 0, canvas.width, canvas.height)
    const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
    const worldZones = cachedWorldZoneMap(sim)
    const patterns = createElementPatterns(context, textures, cellSize, originX, originY + size.height * cellSize)
    const visibleGrid = worldGrid(save, 'GridVisible')?.bytes
    const spawnableGrid = worldGrid(save, 'GridSpawnable')?.bytes
    const damageGrid = worldGrid(save, 'GridDamage')?.bytes
    const range = visibleMapRange(size.width, size.height, cellSize, originX, originY, canvas.width, canvas.height)
    const fluidCells: FluidRenderCell[] = []

    if (visibleLayers.biome) {
      drawBiomeBackground(context, worldZones, size.width, size.height, cellSize, originX, originY, range, biomeBackgrounds)
    }

    const cellAt = (x: number, y: number) => cachedSimCell(sim, view, x + 1, y + 1)
    const sameLiquidAt = (cell: SimCell, x: number, y: number) => {
      const neighbour = cellAt(x, y)
      return Boolean(neighbour && neighbour.elementHash === cell.elementHash && elementForHash(neighbour.elementHash).state === 'liquid')
    }
    const solidAt = (x: number, y: number) => {
      const neighbour = cellAt(x, y)
      return Boolean(neighbour && elementForHash(neighbour.elementHash).state === 'solid')
    }
    const simIndexAt = (x: number, y: number) => (y + 1) * sim.width + x + 1
    const bytesPresent = (offset: number, length: number) => {
      for (let index = 0; index < length; index++) if (sim.bytes[offset + index] !== 0) return true
      return false
    }
    for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
      const y = size.height - 1 - canvasY
      for (let x = range.minX; x <= range.maxX; x++) {
        const cell = cellAt(x, y)
        if (!cell) continue
        const element = elementForHash(cell.elementHash)
        const px = originX + x * cellSize
        const py = originY + canvasY * cellSize
        const zoneColor = visibleLayers.biome ? zoneColorForType(worldZones[y * size.width + x] ?? 7) : undefined
        const fluidContactPath = element.state !== 'solid' && visibleLayers.ground && (
          solidAt(x - 1, y) || solidAt(x + 1, y) || solidAt(x, y - 1) || solidAt(x, y + 1)
        )
          ? cachedTerrainPath(sim, `fluid-contact:${x}:${y}`, () => createTerrainBoundaryPath((neighbourX, neighbourY) => !solidAt(neighbourX, neighbourY), x, y))
          : undefined
        const backwallOffset = sim.backwallOffset + simIndexAt(x, y) * sim.backwallSize
        const backwallPresent = bytesPresent(backwallOffset, sim.backwallSize)
        const backwallIntensity = .35 + (sim.bytes[backwallOffset] / 255) * .45
        if (visibleLayers.backwall && backwallPresent) {
          context.fillStyle = `rgba(185, 164, 132, ${backwallIntensity})`
          context.fillRect(px, py, cellSize, cellSize)
        }
        const isSolid = element.state === 'solid'
        const elementLayerVisible = element.state === 'solid' && visibleLayers.ground
          || element.state === 'liquid' && visibleLayers.liquid
          || element.state === 'gas' && visibleLayers.gas
        if (!isSolid) {
          // Every cell must set its own fill style. Otherwise vacuum and unknown
          // elements inherit the previous cell's texture from the canvas state.
          // Vacuum is transparent in the game; the space scene must remain
          // visible underneath it. Special void cells still keep their fill.
          const showElement = element.state === 'special' || elementLayerVisible
          if (showElement && (element.state === 'liquid' || element.state === 'gas') && element.fluidMaterial) {
            fluidCells.push({
              x,
              y,
              px,
              py,
              cellSize,
              cell,
              style: element.fluidMaterial,
              state: element.state,
              surfaceTop: element.state === 'liquid' && !sameLiquidAt(cell, x, y + 1),
              edgeLeft: element.state === 'liquid' && !sameLiquidAt(cell, x - 1, y),
              edgeRight: element.state === 'liquid' && !sameLiquidAt(cell, x + 1, y),
              edgeBottom: element.state === 'liquid' && !sameLiquidAt(cell, x, y - 1),
              contactPath: fluidContactPath,
            })
            drawFluidBase(context, element.fluidMaterial, cell, element.state, px, py, cellSize)
          } else {
            if (showElement) {
              context.fillStyle = patterns.get(element.texture ?? '') ?? element.color
              context.fillRect(px, py, cellSize, cellSize)
            }
          }
        }
        const isNaturalSolid = visibleLayers.ground && isSolid
        const materialOrder = terrainMaterialOrder(cell.elementHash)
        const terrainConnected = (neighbourX: number, neighbourY: number) => terrainMaterialOrder(cellAt(neighbourX, neighbourY)?.elementHash) >= materialOrder
        const solidConnected = (neighbourX: number, neighbourY: number) => terrainMaterialOrder(cellAt(neighbourX, neighbourY)?.elementHash) > Number.NEGATIVE_INFINITY
        const terrainBoundary = isNaturalSolid && (!terrainConnected(x - 1, y)
          || !terrainConnected(x + 1, y)
          || !terrainConnected(x, y - 1)
          || !terrainConnected(x, y + 1))
        const solidBoundary = isNaturalSolid && (!solidConnected(x - 1, y)
          || !solidConnected(x + 1, y)
          || !solidConnected(x, y - 1)
          || !solidConnected(x, y + 1))
        const terrainPath = terrainBoundary
          ? cachedTerrainPath(sim, `terrain:${x}:${y}`, () => createTerrainCellPath(terrainConnected, x, y))
          : undefined
        const solidPath = solidBoundary
          ? cachedTerrainPath(sim, `solid:${x}:${y}`, () => createTerrainCellPath(solidConnected, x, y))
          : undefined
        const terrainEdgePath = terrainBoundary
          ? cachedTerrainPath(sim, `terrain-edge:${x}:${y}`, () => createTerrainBoundaryPath(terrainConnected, x, y))
          : undefined
        const solidEdgePath = solidBoundary
          ? cachedTerrainPath(sim, `solid-edge:${x}:${y}`, () => createTerrainBoundaryPath(solidConnected, x, y))
          : undefined
        if (isNaturalSolid) {
          const drawTerrainElement = (fillElement: typeof element, paths: Path2D[]) => {
            context.save()
            if (paths.length > 0) {
              context.translate(px, py)
              context.scale(cellSize, cellSize)
              paths.forEach((path) => context.clip(path))
              // Keep the world-space texture transform after installing normalized mask paths.
              context.setTransform(1, 0, 0, 1, 0, 0)
            }
            context.fillStyle = patterns.get(fillElement.texture ?? '') ?? fillElement.color
            context.fillRect(px, py, cellSize, cellSize)
            if (zoneColor) {
              // The game applies the zone colour to the foreground substance,
              // so natural terrain keeps the colony's palette as well.
              context.fillStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, .16)`
              context.fillRect(px, py, cellSize, cellSize)
            }
            // ONI's ground textures are intentionally subdued below the black contour.
            context.fillStyle = 'rgba(0, 0, 0, .2)'
            context.fillRect(px, py, cellSize, cellSize)
            context.restore()
          }
          const drawTerrainOutline = (path: Path2D | undefined) => {
            if (!path) return
            context.save()
            context.translate(px, py)
            context.scale(cellSize, cellSize)
            context.strokeStyle = 'rgba(4, 6, 7, .94)'
            context.lineWidth = Math.max(.8, Math.min(2.5, cellSize * .06)) / Math.max(1, cellSize)
            context.lineCap = 'round'
            context.lineJoin = 'round'
            context.stroke(path)
            context.restore()
          }
          const terrainPaths = [solidPath, terrainPath].filter((path): path is Path2D => path !== undefined)
          let lowerElement = element
          if (terrainPath) {
            lowerElement = [
              cellAt(x - 1, y),
              cellAt(x + 1, y),
              cellAt(x, y - 1),
              cellAt(x, y + 1),
            ].map((neighbour) => {
              if (!neighbour) return undefined
              const neighbourElement = elementForHash(neighbour.elementHash)
              const neighbourOrder = terrainMaterialOrder(neighbour.elementHash)
              return neighbourOrder < materialOrder ? { element: neighbourElement, order: neighbourOrder } : undefined
            }).filter((candidate): candidate is { element: typeof element; order: number } => candidate !== undefined)
              .sort((left, right) => right.order - left.order)[0]?.element ?? element
          }
          if (lowerElement !== element) {
            drawTerrainElement(lowerElement, solidPath ? [solidPath] : [])
          }
          drawTerrainElement(element, terrainPaths)
          drawTerrainOutline(solidEdgePath)
          drawTerrainOutline(terrainEdgePath)
        } else if (isSolid) {
          // Hidden ground remains transparent and reveals the scene background.
        }
        if (overlay === 'temperature') {
          context.fillStyle = temperatureColor(cell.temperature)
          context.globalAlpha = .72
          context.fillRect(px, py, cellSize, cellSize)
          context.globalAlpha = 1
        } else if (overlay === 'mass') {
          const intensity = Math.min(1, Math.log10(1 + Math.max(0, cell.mass)) / 2.2)
          context.fillStyle = `rgba(117, 171, 191, ${0.12 + intensity * 0.88})`
          context.fillRect(px, py, cellSize, cellSize)
        } else if (overlay === 'visibility') {
          const value = visibleGrid?.[y * size.width + x] ?? 0
          context.fillStyle = value > 0 ? `rgba(127, 169, 212, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'
          context.fillRect(px, py, cellSize, cellSize)
        } else if (overlay === 'spawnable') {
          const value = spawnableGrid?.[y * size.width + x] ?? 0
          context.fillStyle = value > 0 ? `rgba(112, 157, 123, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'
          context.fillRect(px, py, cellSize, cellSize)
        } else if (overlay === 'damage') {
          const damageOffset = (y * size.width + x) * 4
          const damageValue = Math.max(
            damageGrid?.[damageOffset] ?? 0,
            damageGrid?.[damageOffset + 1] ?? 0,
            damageGrid?.[damageOffset + 2] ?? 0,
            damageGrid?.[damageOffset + 3] ?? 0,
          )
          context.fillStyle = damageValue > 0 ? `rgba(198, 123, 113, ${.2 + damageValue / 255 * .72})` : 'rgba(16, 23, 25, .84)'
          context.fillRect(px, py, cellSize, cellSize)
        } else if (overlay === 'disease') {
          const diseaseOffset = sim.diseaseOffset + simIndexAt(x, y) * SIM_DISEASE_SIZE
          let diseaseLevel = 0
          for (let index = 0; index < SIM_DISEASE_SIZE; index++) diseaseLevel += sim.bytes[diseaseOffset + index]
          const intensity = Math.min(.9, .12 + diseaseLevel / 2040)
          context.fillStyle = diseaseLevel > 0 ? `rgba(194, 102, 111, ${intensity})` : 'rgba(16, 23, 25, .84)'
          context.fillRect(px, py, cellSize, cellSize)
        }
      }
    }

    if (overlay === 'none') {
      const regions = fluidRegions(fluidCells)
      drawFluidRegionBase(context, regions)
      drawFluidBoundaryGlow(context, fluidBoundaryCells(fluidCells), false)
      drawFluidSurfaceRuns(context, fluidSurfaceRuns(fluidCells), 0, false)
    }

    context.save()
    context.fillStyle = '#e4b067'
    if (visibleLayers.minions) {
      for (const minion of groupByTag(save, 'Minion')?.instances ?? []) {
        const x = Math.round(minion.position.x)
        const y = Math.round(size.height - 1 - minion.position.y)
        if (x >= 0 && y >= 0 && x < size.width && y < size.height) {
          context.fillRect(originX + x * cellSize + 1, originY + y * cellSize + 1, cellSize - 2, cellSize - 2)
        }
      }
    }
    if (visibleLayers.buildings) {
      for (const group of save.manager?.groups ?? []) {
        for (const instance of group.instances) {
          const isBuilding = Boolean(component(instance, 'BuildingComplete'))
          const geyserTexture = geyserTextureForTag(group.tag)
          const buildingTexture = buildingTextureForTag(group.tag)
          const isGeyser = Boolean(component(instance, 'Geyser')) || Boolean(geyserTexture) || /geyser|fountain/i.test(group.tag)
          if (!isBuilding && !isGeyser && !buildingTexture) continue
          const x = Math.floor(instance.position.x)
          const y = Math.floor(instance.position.y)
          const canvasY = size.height - 1 - y
          if (x < 0 || canvasY < 0 || x >= size.width || canvasY >= size.height) continue
          const px = originX + x * cellSize
          const py = originY + canvasY * cellSize
          if (isGeyser && !buildingTexture) {
            const centerX = originX + instance.position.x * cellSize
            const centerY = originY + (size.height - instance.position.y - .5) * cellSize
            const image = geyserTexture ? geyserTextures[geyserTexture.path] : undefined
            if (image && geyserTexture) {
              drawGeyserTexture(context, image, geyserTexture, cellSize, centerX, centerY)
            } else {
              const fallbackX = px + cellSize / 2
              const fallbackY = py + cellSize / 2
              const radius = Math.max(2, cellSize * .34)
              context.fillStyle = 'rgba(112, 190, 203, .9)'
              context.strokeStyle = '#e8d096'
              context.lineWidth = Math.max(1, Math.ceil(cellSize / 8))
              context.beginPath()
              context.arc(fallbackX, fallbackY, radius, 0, Math.PI * 2)
              context.fill()
              context.stroke()
              context.fillStyle = '#2a5965'
              context.fillRect(fallbackX - Math.max(1, cellSize * .08), fallbackY - Math.max(1, cellSize * .08), Math.max(2, cellSize * .16), Math.max(2, cellSize * .16))
            }
          } else if (buildingTexture) {
            const centerX = px + cellSize / 2
            const centerY = py + cellSize / 2
            const image = buildingTextures[buildingTexture.path]
            if (image) {
              drawGeyserTexture(context, image, buildingTexture, cellSize, centerX, centerY)
            } else {
              context.fillStyle = buildingLayerColor(group.tag)
              context.fillRect(px + 1, py + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2))
            }
          } else {
            context.fillStyle = buildingLayerColor(group.tag)
            context.fillRect(px + 1, py + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2))
            context.strokeStyle = 'rgba(248, 235, 200, .85)'
            context.lineWidth = Math.max(1, Math.ceil(cellSize / 5))
            context.strokeRect(px + .5, py + .5, cellSize - 1, cellSize - 1)
          }
        }
      }
    }
    context.restore()
  }, [biomeBackgrounds, buildingTextures, cachedWorldZoneMap, displayCellSize, geyserTextures, originX, originY, overlay, pan.x, pan.y, renderCellSize, save, size.height, size.width, textures, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers])

  useEffect(() => {
    const canvas = fluidCanvasRef.current
    const sim = save.simData
    if (!canvas || !sim || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    canvas.width = viewportPixelWidth
    canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = false
    const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
    const cellSize = renderCellSize
    const range = visibleMapRange(size.width, size.height, cellSize, originX, originY, canvas.width, canvas.height)
    const cellAt = (x: number, y: number) => cachedSimCell(sim, view, x + 1, y + 1)
    const sameLiquidAt = (cell: SimCell, x: number, y: number) => {
      const neighbour = cellAt(x, y)
      return Boolean(neighbour && neighbour.elementHash === cell.elementHash && elementForHash(neighbour.elementHash).state === 'liquid')
    }
    const solidAt = (x: number, y: number) => {
      const neighbour = cellAt(x, y)
      return Boolean(neighbour && elementForHash(neighbour.elementHash).state === 'solid')
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fluidCells: FluidRenderCell[] = []
    if (overlay === 'none') {
      for (let canvasY = range.minRow; canvasY <= range.maxRow; canvasY++) {
        const y = size.height - 1 - canvasY
        for (let x = range.minX; x <= range.maxX; x++) {
          const cell = cellAt(x, y)
          if (!cell) continue
          const element = elementForHash(cell.elementHash)
          const isVisible = element.state === 'gas' && visibleLayers.gas || element.state === 'liquid' && visibleLayers.liquid
          if (!isVisible || !element.fluidMaterial || (element.state !== 'gas' && element.state !== 'liquid')) continue
          const fluidContactPath = visibleLayers.ground && (
            solidAt(x - 1, y) || solidAt(x + 1, y) || solidAt(x, y - 1) || solidAt(x, y + 1)
          )
            ? cachedTerrainPath(sim, `fluid-contact:${x}:${y}`, () => createTerrainBoundaryPath((neighbourX, neighbourY) => !solidAt(neighbourX, neighbourY), x, y))
            : undefined
          fluidCells.push({
            x,
            y,
            px: originX + x * cellSize,
            py: originY + canvasY * cellSize,
            cellSize,
            cell,
            style: element.fluidMaterial,
            state: element.state,
            surfaceTop: element.state === 'liquid' && !sameLiquidAt(cell, x, y + 1),
            edgeLeft: element.state === 'liquid' && !sameLiquidAt(cell, x - 1, y),
            edgeRight: element.state === 'liquid' && !sameLiquidAt(cell, x + 1, y),
            edgeBottom: element.state === 'liquid' && !sameLiquidAt(cell, x, y - 1),
            contactPath: fluidContactPath,
          })
        }
      }
    }
    const surfaceRuns = fluidSurfaceRuns(fluidCells)
    const regions = fluidRegions(fluidCells)
    let frame = 0
    let lastFrameTime = -Infinity
    const draw = (time: number) => {
      if (lastFrameTime > -Infinity && time - lastFrameTime < 32) {
        frame = requestAnimationFrame(draw)
        return
      }
      lastFrameTime = time
      context.clearRect(0, 0, canvas.width, canvas.height)
      if (fluidCells.length > 0) {
        const timeSeconds = time / 1000
        drawFluidSurfaceRuns(context, surfaceRuns, timeSeconds, true)
        drawFluidRegionAnimation(context, regions, timeSeconds)
      }
      if (!reduceMotion && fluidCells.length > 0) frame = requestAnimationFrame(draw)
    }
    draw(0)
    return () => cancelAnimationFrame(frame)
  }, [fluidCanvasRef, originX, originY, overlay, renderCellSize, save, size.height, size.width, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers.gas, visibleLayers.ground, visibleLayers.liquid])

  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || !size.width || !size.height || !viewportSize.width || !viewportSize.height) return
    const cellSize = renderCellSize
    canvas.width = viewportPixelWidth
    canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    const patterns = createElementPatterns(context, textures, cellSize, originX, originY + size.height * cellSize)
    const range = visibleMapRange(size.width, size.height, cellSize, originX, originY, canvas.width, canvas.height)
    if (visibleLayers.grid && displayCellSize >= 3) {
      context.strokeStyle = 'rgba(237, 230, 207, .14)'
      context.lineWidth = Math.max(1, Math.ceil(renderCellSize / displayCellSize))
      context.beginPath()
      for (let x = range.minX; x <= range.maxX + 1; x++) {
        const position = originX + x * cellSize
        context.moveTo(position, 0)
        context.lineTo(position, canvas.height)
      }
      for (let y = range.minRow; y <= range.maxRow + 1; y++) {
        const position = originY + y * cellSize
        context.moveTo(0, position)
        context.lineTo(canvas.width, position)
      }
      context.stroke()
    }
    const sim = save.simData
    const previewFluidCells: FluidRenderCell[] = []
    const previewHashAt = (x: number, y: number): number | undefined => {
      const preview = previewCells.get(`${x}:${y}`)
      if (preview) return preview.elementHash
      return sim ? getWorldCell(sim, x, y)?.elementHash : undefined
    }
    const samePreviewLiquidAt = (x: number, y: number, elementHash: number) => {
      const neighbourHash = previewHashAt(x, y)
      return neighbourHash === elementHash && elementForHash(neighbourHash).state === 'liquid'
    }
    const previewSolidAt = (x: number, y: number) => {
      const neighbourHash = previewHashAt(x, y)
      return neighbourHash !== undefined && elementForHash(neighbourHash).state === 'solid'
    }
    for (const preview of previewCells.values()) {
      const element = elementForHash(preview.elementHash)
      const px = originX + preview.x * cellSize
      const py = originY + (size.height - 1 - preview.y) * cellSize
      const baseCell = sim ? getWorldCell(sim, preview.x, preview.y) : undefined
      if (baseCell && (element.state === 'liquid' || element.state === 'gas') && element.fluidMaterial) {
        const previewCell: SimCell = { ...baseCell, elementHash: preview.elementHash }
        const contactPath = visibleLayers.ground && (
          previewSolidAt(preview.x - 1, preview.y)
          || previewSolidAt(preview.x + 1, preview.y)
          || previewSolidAt(preview.x, preview.y - 1)
          || previewSolidAt(preview.x, preview.y + 1)
        )
          ? createTerrainBoundaryPath((neighbourX, neighbourY) => !previewSolidAt(neighbourX, neighbourY), preview.x, preview.y)
          : undefined
        previewFluidCells.push({
          x: preview.x,
          y: preview.y,
          px,
          py,
          cellSize,
          cell: previewCell,
          style: element.fluidMaterial,
          state: element.state,
          surfaceTop: element.state === 'liquid' && !samePreviewLiquidAt(preview.x, preview.y + 1, preview.elementHash),
          edgeLeft: element.state === 'liquid' && !samePreviewLiquidAt(preview.x - 1, preview.y, preview.elementHash),
          edgeRight: element.state === 'liquid' && !samePreviewLiquidAt(preview.x + 1, preview.y, preview.elementHash),
          edgeBottom: element.state === 'liquid' && !samePreviewLiquidAt(preview.x, preview.y - 1, preview.elementHash),
          contactPath,
        })
        drawFluidBase(context, element.fluidMaterial, previewCell, element.state, px, py, cellSize)
      } else {
        context.fillStyle = patterns.get(element.texture ?? '') ?? element.color
        context.fillRect(px, py, cellSize, cellSize)
        context.strokeStyle = 'rgba(240, 208, 141, .8)'
        context.lineWidth = Math.max(1, Math.ceil(cellSize / 4))
        context.strokeRect(px + .5, py + .5, cellSize - 1, cellSize - 1)
      }
    }
    drawFluidRegionBase(context, fluidRegions(previewFluidCells))
    drawFluidBoundaryGlow(context, fluidBoundaryCells(previewFluidCells), false)
    drawFluidSurfaceRuns(context, fluidSurfaceRuns(previewFluidCells), 0, false)
    if (tool === 'fill' && !spacePan && brushCell && sim) {
      const fillCache = fillRegionCacheRef.current
      if (fillCache.bytes !== sim.bytes) {
        fillCache.bytes = sim.bytes
        fillCache.regions.clear()
      }
      const startIndex = brushCell.y * size.width + brushCell.x
      let fillCells = fillCache.regions.get(startIndex)
      if (!fillCells) {
        fillCells = floodFillCoordinates(sim, size.width, size.height, brushCell.x, brushCell.y)
        fillCells.forEach((cell) => fillCache.regions.set(cell.y * size.width + cell.x, fillCells!))
      }
      if (fillCells.length > 0) {
        const fillSet = new Set(fillCells.map((cell) => `${cell.x}:${cell.y}`))
        const fillPath = new Path2D()
        const boundaryPath = new Path2D()
        const inViewport = (cell: { x: number; y: number }) => {
          const canvasY = size.height - 1 - cell.y
          return cell.x >= range.minX && cell.x <= range.maxX && canvasY >= range.minRow && canvasY <= range.maxRow
        }
        fillCells.forEach((cell) => {
          if (!inViewport(cell)) return
          const px = originX + cell.x * cellSize
          const py = originY + (size.height - 1 - cell.y) * cellSize
          fillPath.rect(px, py, cellSize + .25, cellSize + .25)
          if (!fillSet.has(`${cell.x - 1}:${cell.y}`)) {
            boundaryPath.moveTo(px, py)
            boundaryPath.lineTo(px, py + cellSize)
          }
          if (!fillSet.has(`${cell.x + 1}:${cell.y}`)) {
            boundaryPath.moveTo(px + cellSize, py)
            boundaryPath.lineTo(px + cellSize, py + cellSize)
          }
          if (!fillSet.has(`${cell.x}:${cell.y - 1}`)) {
            boundaryPath.moveTo(px, py + cellSize)
            boundaryPath.lineTo(px + cellSize, py + cellSize)
          }
          if (!fillSet.has(`${cell.x}:${cell.y + 1}`)) {
            boundaryPath.moveTo(px, py)
            boundaryPath.lineTo(px + cellSize, py)
          }
        })
        context.save()
        context.fillStyle = 'rgba(240, 208, 141, .2)'
        context.fill(fillPath)
        context.strokeStyle = 'rgba(240, 208, 141, .9)'
        context.lineWidth = Math.max(1, Math.min(3, cellSize * .06))
        context.lineJoin = 'round'
        context.stroke(boundaryPath)
        context.restore()
      }
    }
    if (selectedCell) {
      context.strokeStyle = '#f0d08d'
      context.lineWidth = Math.max(1, Math.ceil(cellSize / 4))
      context.strokeRect(originX + selectedCell.x * cellSize + .5, originY + (size.height - 1 - selectedCell.y) * cellSize + .5, cellSize - 1, cellSize - 1)
    }
    const activeSelection = selectionDraft ?? selection
    if (activeSelection) {
      const bounds = normalizedSelection(activeSelection)
      const left = originX + bounds.minX * cellSize
      const top = originY + (size.height - 1 - bounds.maxY) * cellSize
      const selectionWidth = bounds.width * cellSize
      const selectionHeight = bounds.height * cellSize
      const pixelRatio = displayCellSize > 0 ? cellSize / displayCellSize : 1
      context.save()
      context.fillStyle = selectionDraft ? 'rgba(240, 208, 141, .24)' : 'rgba(240, 208, 141, .18)'
      context.fillRect(left, top, selectionWidth, selectionHeight)
      context.strokeStyle = 'rgba(240, 208, 141, .98)'
      context.lineWidth = Math.max(1.5 * pixelRatio, Math.min(3 * pixelRatio, cellSize * .08))
      context.strokeRect(left + context.lineWidth / 2, top + context.lineWidth / 2, selectionWidth - context.lineWidth, selectionHeight - context.lineWidth)
      const labelFontSize = Math.max(8 * pixelRatio, Math.min(16 * pixelRatio, Math.min(selectionWidth / 4.5, selectionHeight / 3.8)))
      if (selectionWidth >= 28 * pixelRatio && selectionHeight >= 24 * pixelRatio) {
        context.font = `600 ${labelFontSize}px "Microsoft YaHei", sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        const title = `${bounds.width}×${bounds.height}`
        const count = `${bounds.cells.toLocaleString()}格`
        const labelWidth = Math.max(context.measureText(title).width, context.measureText(count).width) + 16 * pixelRatio
        const labelHeight = labelFontSize * 2.7
        const labelLeft = left + (selectionWidth - labelWidth) / 2
        const labelTop = top + (selectionHeight - labelHeight) / 2
        context.fillStyle = 'rgba(21, 25, 31, .78)'
        context.fillRect(labelLeft, labelTop, labelWidth, labelHeight)
        context.fillStyle = '#fff4d6'
        context.fillText(title, left + selectionWidth / 2, labelTop + labelFontSize * .78)
        context.fillStyle = 'rgba(255, 244, 214, .7)'
        context.fillText(count, left + selectionWidth / 2, labelTop + labelFontSize * 1.92)
      }
      context.restore()
    }
    const brushTool = tool === 'paint' || tool === 'erase' || tool === 'line'
    if (brushTool && !spacePan && brushCell) {
      const radius = Math.floor(brushSize / 2)
      const left = originX + (brushCell.x - radius) * cellSize
      const top = originY + (size.height - 1 - brushCell.y - radius) * cellSize
      const brushPixels = brushSize * cellSize
      context.fillStyle = tool === 'erase' ? 'rgba(255, 226, 196, .16)' : 'rgba(240, 208, 141, .18)'
      context.strokeStyle = tool === 'erase' ? '#f3c59e' : '#f0d08d'
      context.lineWidth = Math.max(1, Math.min(3, cellSize * .08))
      context.fillRect(left, top, brushPixels, brushPixels)
      context.strokeRect(left + context.lineWidth / 2, top + context.lineWidth / 2, brushPixels - context.lineWidth, brushPixels - context.lineWidth)
    }
  }, [brushCell, brushSize, displayCellSize, originX, originY, pan.x, pan.y, previewCells, previewVersion, renderCellSize, save, selectedCell, selection, selectionDraft, size.height, size.width, spacePan, textures, tool, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width, visibleLayers.grid, visibleLayers.ground])

  const canvasStyle = {
    width: '100%',
    height: '100%',
  }
  const mapBackgroundStyle = {
    '--map-space-background': `url("${assetPath('/assets/background/space_bg.png')}")`,
    '--map-starfield-background': `url("${assetPath('/assets/background/starfield.png')}")`,
  } as CSSProperties

  const loadMapImage = (path: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`无法加载地图背景：${path}`))
    image.src = assetPath(path)
  })

  const paintMapBackground = (context: CanvasRenderingContext2D, width: number, height: number, spaceBackground: HTMLImageElement, starfield: HTMLImageElement) => {
    context.fillStyle = '#090d16'
    context.fillRect(0, 0, width, height)
    const coverScale = Math.max(width / spaceBackground.naturalWidth, height / spaceBackground.naturalHeight)
    const coverWidth = spaceBackground.naturalWidth * coverScale
    const coverHeight = spaceBackground.naturalHeight * coverScale
    context.globalAlpha = .86
    context.drawImage(spaceBackground, (width - coverWidth) / 2, (height - coverHeight) / 2, coverWidth, coverHeight)
    context.globalCompositeOperation = 'screen'
    context.globalAlpha = .2
    for (let y = -starfield.naturalHeight; y < height; y += starfield.naturalHeight) {
      for (let x = -starfield.naturalWidth; x < width; x += starfield.naturalWidth) {
        context.drawImage(starfield, x, y)
      }
    }
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
    context.imageSmoothingEnabled = false
  }

  const downloadMapCanvas = async (canvas: HTMLCanvasElement, fileName: string) => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const exportCurrentMapImage = async () => {
    const baseCanvas = canvasRef.current
    const fluidCanvas = fluidCanvasRef.current
    if (!baseCanvas || !fluidCanvas || !baseCanvas.width || !baseCanvas.height) return
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = baseCanvas.width
    exportCanvas.height = baseCanvas.height
    const context = exportCanvas.getContext('2d')
    if (!context) return
    try {
      const [spaceBackground, starfield] = await Promise.all([
        loadMapImage('/assets/background/space_bg.png'),
        loadMapImage('/assets/background/starfield.png'),
      ])
      paintMapBackground(context, exportCanvas.width, exportCanvas.height, spaceBackground, starfield)
      context.drawImage(baseCanvas, 0, 0)
      context.drawImage(fluidCanvas, 0, 0)
      await downloadMapCanvas(exportCanvas, '缺氧地图-当前视图.png')
    } catch {
      return
    }
  }

  const exportPanoramaImage = async () => {
    const sim = save.simData
    if (!sim || !size.width || !size.height) return
    const exportCellSize = Math.max(1, Math.min(PANORAMA_CELL_PIXELS, Math.floor(16000 / Math.max(size.width, size.height))))
    const exportWidth = size.width * exportCellSize
    const exportHeight = size.height * exportCellSize
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = exportWidth
    exportCanvas.height = exportHeight
    const context = exportCanvas.getContext('2d')
    if (!context) return

    try {
      const [spaceBackground, starfield, ...loadedBiomeBackgrounds] = await Promise.all([
        loadMapImage('/assets/background/space_bg.png'),
        loadMapImage('/assets/background/starfield.png'),
        ...Array.from({ length: 19 }, (_, textureIndex) => loadMapImage(biomeBackgroundAsset(textureIndex))),
      ])
      paintMapBackground(context, exportWidth, exportHeight, spaceBackground, starfield)

      const view = new DataView(sim.bytes.buffer, sim.bytes.byteOffset, sim.bytes.byteLength)
      const worldZones = cachedWorldZoneMap(sim)
      const exportBiomeBackgrounds: Record<number, HTMLImageElement> = { ...biomeBackgrounds }
      loadedBiomeBackgrounds.forEach((image, textureIndex) => { exportBiomeBackgrounds[textureIndex] = image })
      const originX = 0
      const originY = 0
      const cellSize = exportCellSize
      if (visibleLayers.biome) {
        drawBiomeBackground(
          context,
          worldZones,
          size.width,
          size.height,
          cellSize,
          originX,
          originY,
          { minX: 0, maxX: size.width - 1, minRow: 0, maxRow: size.height - 1 },
          exportBiomeBackgrounds,
        )
      }
      const patterns = createElementPatterns(context, textures, cellSize, originX, originY + size.height * cellSize)
      const visibleGrid = worldGrid(save, 'GridVisible')?.bytes
      const spawnableGrid = worldGrid(save, 'GridSpawnable')?.bytes
      const damageGrid = worldGrid(save, 'GridDamage')?.bytes
      const fluidCells: FluidRenderCell[] = []
      const cellAt = (x: number, y: number) => cachedSimCell(sim, view, x + 1, y + 1)
      const sameLiquidAt = (cell: SimCell, x: number, y: number) => {
        const neighbour = cellAt(x, y)
        return Boolean(neighbour && neighbour.elementHash === cell.elementHash && elementForHash(neighbour.elementHash).state === 'liquid')
      }
      const solidAt = (x: number, y: number) => {
        const neighbour = cellAt(x, y)
        return Boolean(neighbour && elementForHash(neighbour.elementHash).state === 'solid')
      }
      const simIndexAt = (x: number, y: number) => (y + 1) * sim.width + x + 1
      const bytesPresent = (offset: number, length: number) => {
        for (let index = 0; index < length; index++) if (sim.bytes[offset + index] !== 0) return true
        return false
      }

      // Render every cell at export resolution. This does not depend on the current
      // viewport, zoom, device pixel ratio, selection, or brush preview.
      for (let canvasY = 0; canvasY < size.height; canvasY++) {
        const y = size.height - 1 - canvasY
        for (let x = 0; x < size.width; x++) {
          const cell = cellAt(x, y)
          if (!cell) continue
          const element = elementForHash(cell.elementHash)
          const px = originX + x * cellSize
          const py = originY + canvasY * cellSize
          const zoneColor = visibleLayers.biome ? zoneColorForType(worldZones[y * size.width + x] ?? 7) : undefined
          const fluidContactPath = element.state !== 'solid' && visibleLayers.ground && (
            solidAt(x - 1, y) || solidAt(x + 1, y) || solidAt(x, y - 1) || solidAt(x, y + 1)
          )
            ? cachedTerrainPath(sim, `fluid-contact:${x}:${y}`, () => createTerrainBoundaryPath((neighbourX, neighbourY) => !solidAt(neighbourX, neighbourY), x, y))
            : undefined
          const backwallOffset = sim.backwallOffset + simIndexAt(x, y) * sim.backwallSize
          const backwallPresent = bytesPresent(backwallOffset, sim.backwallSize)
          const backwallIntensity = .35 + (sim.bytes[backwallOffset] / 255) * .45
          if (visibleLayers.backwall && backwallPresent) {
            context.fillStyle = `rgba(185, 164, 132, ${backwallIntensity})`
            context.fillRect(px, py, cellSize, cellSize)
          }
          const isSolid = element.state === 'solid'
          const elementLayerVisible = element.state === 'solid' && visibleLayers.ground
            || element.state === 'liquid' && visibleLayers.liquid
            || element.state === 'gas' && visibleLayers.gas
          if (!isSolid) {
            const showElement = element.state === 'special' || elementLayerVisible
            if (showElement && (element.state === 'liquid' || element.state === 'gas') && element.fluidMaterial) {
              fluidCells.push({
                x,
                y,
                px,
                py,
                cellSize,
                cell,
                style: element.fluidMaterial,
                state: element.state,
                surfaceTop: element.state === 'liquid' && !sameLiquidAt(cell, x, y + 1),
                edgeLeft: element.state === 'liquid' && !sameLiquidAt(cell, x - 1, y),
                edgeRight: element.state === 'liquid' && !sameLiquidAt(cell, x + 1, y),
                edgeBottom: element.state === 'liquid' && !sameLiquidAt(cell, x, y - 1),
                contactPath: fluidContactPath,
              })
              drawFluidBase(context, element.fluidMaterial, cell, element.state, px, py, cellSize)
            } else if (showElement) {
              context.fillStyle = patterns.get(element.texture ?? '') ?? element.color
              context.fillRect(px, py, cellSize, cellSize)
            }
          }
          const isNaturalSolid = visibleLayers.ground && isSolid
          const materialOrder = terrainMaterialOrder(cell.elementHash)
          const terrainConnected = (neighbourX: number, neighbourY: number) => terrainMaterialOrder(cellAt(neighbourX, neighbourY)?.elementHash) >= materialOrder
          const solidConnected = (neighbourX: number, neighbourY: number) => terrainMaterialOrder(cellAt(neighbourX, neighbourY)?.elementHash) > Number.NEGATIVE_INFINITY
          const terrainBoundary = isNaturalSolid && (!terrainConnected(x - 1, y) || !terrainConnected(x + 1, y) || !terrainConnected(x, y - 1) || !terrainConnected(x, y + 1))
          const solidBoundary = isNaturalSolid && (!solidConnected(x - 1, y) || !solidConnected(x + 1, y) || !solidConnected(x, y - 1) || !solidConnected(x, y + 1))
          const terrainPath = terrainBoundary ? cachedTerrainPath(sim, `terrain:${x}:${y}`, () => createTerrainCellPath(terrainConnected, x, y)) : undefined
          const solidPath = solidBoundary ? cachedTerrainPath(sim, `solid:${x}:${y}`, () => createTerrainCellPath(solidConnected, x, y)) : undefined
          const terrainEdgePath = terrainBoundary ? cachedTerrainPath(sim, `terrain-edge:${x}:${y}`, () => createTerrainBoundaryPath(terrainConnected, x, y)) : undefined
          const solidEdgePath = solidBoundary ? cachedTerrainPath(sim, `solid-edge:${x}:${y}`, () => createTerrainBoundaryPath(solidConnected, x, y)) : undefined
          if (isNaturalSolid) {
            const drawTerrainElement = (fillElement: typeof element, paths: Path2D[]) => {
              context.save()
              if (paths.length > 0) {
                context.translate(px, py)
                context.scale(cellSize, cellSize)
                paths.forEach((path) => context.clip(path))
                context.setTransform(1, 0, 0, 1, 0, 0)
              }
              context.fillStyle = patterns.get(fillElement.texture ?? '') ?? fillElement.color
              context.fillRect(px, py, cellSize, cellSize)
              if (zoneColor) {
                context.fillStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, .16)`
                context.fillRect(px, py, cellSize, cellSize)
              }
              context.fillStyle = 'rgba(0, 0, 0, .2)'
              context.fillRect(px, py, cellSize, cellSize)
              context.restore()
            }
            const drawTerrainOutline = (path: Path2D | undefined) => {
              if (!path) return
              context.save()
              context.translate(px, py)
              context.scale(cellSize, cellSize)
              context.strokeStyle = 'rgba(4, 6, 7, .94)'
              context.lineWidth = Math.max(.8, Math.min(2.5, cellSize * .06)) / Math.max(1, cellSize)
              context.lineCap = 'round'
              context.lineJoin = 'round'
              context.stroke(path)
              context.restore()
            }
            const terrainPaths = [solidPath, terrainPath].filter((path): path is Path2D => path !== undefined)
            let lowerElement = element
            if (terrainPath) {
              lowerElement = [cellAt(x - 1, y), cellAt(x + 1, y), cellAt(x, y - 1), cellAt(x, y + 1)]
                .map((neighbour) => {
                  if (!neighbour) return undefined
                  const neighbourElement = elementForHash(neighbour.elementHash)
                  const neighbourOrder = terrainMaterialOrder(neighbour.elementHash)
                  return neighbourOrder < materialOrder ? { element: neighbourElement, order: neighbourOrder } : undefined
                })
                .filter((candidate): candidate is { element: typeof element; order: number } => candidate !== undefined)
                .sort((left, right) => right.order - left.order)[0]?.element ?? element
            }
            if (lowerElement !== element) drawTerrainElement(lowerElement, solidPath ? [solidPath] : [])
            drawTerrainElement(element, terrainPaths)
            drawTerrainOutline(solidEdgePath)
            drawTerrainOutline(terrainEdgePath)
          }
          if (overlay === 'temperature') {
            context.fillStyle = temperatureColor(cell.temperature)
            context.globalAlpha = .72
            context.fillRect(px, py, cellSize, cellSize)
            context.globalAlpha = 1
          } else if (overlay === 'mass') {
            const intensity = Math.min(1, Math.log10(1 + Math.max(0, cell.mass)) / 2.2)
            context.fillStyle = `rgba(117, 171, 191, ${0.12 + intensity * 0.88})`
            context.fillRect(px, py, cellSize, cellSize)
          } else if (overlay === 'visibility') {
            const value = visibleGrid?.[y * size.width + x] ?? 0
            context.fillStyle = value > 0 ? `rgba(127, 169, 212, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'
            context.fillRect(px, py, cellSize, cellSize)
          } else if (overlay === 'spawnable') {
            const value = spawnableGrid?.[y * size.width + x] ?? 0
            context.fillStyle = value > 0 ? `rgba(112, 157, 123, ${.2 + value / 255 * .72})` : 'rgba(16, 23, 25, .84)'
            context.fillRect(px, py, cellSize, cellSize)
          } else if (overlay === 'damage') {
            const damageOffset = (y * size.width + x) * 4
            const damageValue = Math.max(damageGrid?.[damageOffset] ?? 0, damageGrid?.[damageOffset + 1] ?? 0, damageGrid?.[damageOffset + 2] ?? 0, damageGrid?.[damageOffset + 3] ?? 0)
            context.fillStyle = damageValue > 0 ? `rgba(198, 123, 113, ${.2 + damageValue / 255 * .72})` : 'rgba(16, 23, 25, .84)'
            context.fillRect(px, py, cellSize, cellSize)
          } else if (overlay === 'disease') {
            const diseaseOffset = sim.diseaseOffset + simIndexAt(x, y) * SIM_DISEASE_SIZE
            let diseaseLevel = 0
            for (let index = 0; index < SIM_DISEASE_SIZE; index++) diseaseLevel += sim.bytes[diseaseOffset + index]
            const intensity = Math.min(.9, .12 + diseaseLevel / 2040)
            context.fillStyle = diseaseLevel > 0 ? `rgba(194, 102, 111, ${intensity})` : 'rgba(16, 23, 25, .84)'
            context.fillRect(px, py, cellSize, cellSize)
          }
        }
      }

      if (overlay === 'none') {
        drawFluidRegionBase(context, fluidRegions(fluidCells))
        drawFluidBoundaryGlow(context, fluidBoundaryCells(fluidCells), false)
        drawFluidSurfaceRuns(context, fluidSurfaceRuns(fluidCells), 0, false)
      }

      context.save()
      context.fillStyle = '#e4b067'
      if (visibleLayers.minions) {
        for (const minion of groupByTag(save, 'Minion')?.instances ?? []) {
          const x = Math.round(minion.position.x)
          const y = Math.round(size.height - 1 - minion.position.y)
          if (x >= 0 && y >= 0 && x < size.width && y < size.height) {
            context.fillRect(originX + x * cellSize + 1, originY + y * cellSize + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2))
          }
        }
      }
      if (visibleLayers.buildings) {
        for (const group of save.manager?.groups ?? []) {
          for (const instance of group.instances) {
            const isBuilding = Boolean(component(instance, 'BuildingComplete'))
            const geyserTexture = geyserTextureForTag(group.tag)
            const buildingTexture = buildingTextureForTag(group.tag)
            const isGeyser = Boolean(component(instance, 'Geyser')) || Boolean(geyserTexture) || /geyser|fountain/i.test(group.tag)
            if (!isBuilding && !isGeyser && !buildingTexture) continue
            const x = Math.floor(instance.position.x)
            const y = Math.floor(instance.position.y)
            const canvasY = size.height - 1 - y
            if (x < 0 || canvasY < 0 || x >= size.width || canvasY >= size.height) continue
            const px = originX + x * cellSize
            const py = originY + canvasY * cellSize
            if (isGeyser && !buildingTexture) {
              const centerX = originX + instance.position.x * cellSize
              const centerY = originY + (size.height - instance.position.y - .5) * cellSize
              const image = geyserTexture ? geyserTextures[geyserTexture.path] : undefined
              if (image && geyserTexture) {
                drawGeyserTexture(context, image, geyserTexture, cellSize, centerX, centerY)
              } else {
                const fallbackX = px + cellSize / 2
                const fallbackY = py + cellSize / 2
                const radius = Math.max(2, cellSize * .34)
                context.fillStyle = 'rgba(112, 190, 203, .9)'
                context.strokeStyle = '#e8d096'
                context.lineWidth = Math.max(1, Math.ceil(cellSize / 8))
                context.beginPath()
                context.arc(fallbackX, fallbackY, radius, 0, Math.PI * 2)
                context.fill()
                context.stroke()
                context.fillStyle = '#2a5965'
                context.fillRect(fallbackX - Math.max(1, cellSize * .08), fallbackY - Math.max(1, cellSize * .08), Math.max(2, cellSize * .16), Math.max(2, cellSize * .16))
              }
            } else if (buildingTexture) {
              const image = buildingTextures[buildingTexture.path]
              if (image) {
                drawGeyserTexture(context, image, buildingTexture, cellSize, px + cellSize / 2, py + cellSize / 2)
              } else {
                context.fillStyle = buildingLayerColor(group.tag)
                context.fillRect(px + 1, py + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2))
              }
            } else {
              context.fillStyle = buildingLayerColor(group.tag)
              context.fillRect(px + 1, py + 1, Math.max(1, cellSize - 2), Math.max(1, cellSize - 2))
              context.strokeStyle = 'rgba(248, 235, 200, .85)'
              context.lineWidth = Math.max(1, Math.ceil(cellSize / 5))
              context.strokeRect(px + .5, py + .5, cellSize - 1, cellSize - 1)
            }
          }
        }
      }
      context.restore()
      await downloadMapCanvas(exportCanvas, `缺氧地图-全景-${exportCellSize}px.png`)
    } catch {
      return
    }
  }

  return <div
    ref={viewportRef}
    style={mapBackgroundStyle}
    className={`canvas-frame canvas-viewport ${isPanning ? 'is-panning' : ''} ${spacePan ? 'is-space-pan' : ''} ${tool === 'inspect' ? 'is-select-mode' : ''} ${tool !== 'inspect' && tool !== 'move' ? 'is-brush-mode' : ''}`}
    onWheel={(event) => { event.preventDefault(); event.stopPropagation(); setZoomPercentAround(zoomPercent + (event.deltaY < 0 ? 5 : -5), event.clientX, event.clientY) }}
    onPointerDown={(event) => {
      if (event.button !== 0 && event.button !== 1) return
      if (event.button === 1) event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const temporaryPan = event.button === 1 || spacePanRef.current
      const mode = temporaryPan || tool === 'move' ? 'pan' : tool === 'inspect' ? 'select' : tool === 'paint' || tool === 'erase' ? 'brush' : tool === 'rectangle' || tool === 'line' ? 'shape' : 'point'
      const startCell = pointToCell(event.clientX, event.clientY) ?? null
      pointerRef.current = { mode, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y, moved: false, lastCell: null, startCell }
      if (mode === 'brush') {
        visitedBrushCellsRef.current.clear()
        onStrokeStart()
        const cell = startCell
        if (cell) {
          const key = `${cell.x}:${cell.y}`
          visitedBrushCellsRef.current.add(key)
          pointerRef.current.lastCell = cell
          onCell(cell.x, cell.y)
        }
      } else if (mode === 'shape') {
        onStrokeStart()
        if (startCell) onShape(startCell, startCell)
      } else if (mode === 'point') {
        if (startCell) onCell(startCell.x, startCell.y)
      } else if (mode === 'select') {
        onSelectionChange(null)
        setSelectionDraft(startCell ? { start: startCell, end: startCell } : null)
      } else {
        if (canvasLayerRef.current) canvasLayerRef.current.style.transform = 'translate3d(0, 0, 0)'
        setIsPanning(true)
      }
    }}
    onPointerMove={(event) => {
      const pointer = pointerRef.current
      const cell = pointToCell(event.clientX, event.clientY) ?? null
      const brushTool = tool === 'paint' || tool === 'erase' || tool === 'line'
      const previewTool = brushTool || tool === 'fill'
      if (previewTool && !spacePanRef.current && pointer?.mode !== 'pan') updateBrushCell(cell)
      else updateBrushCell(null)
      if (!pointer) return
      if (pointer.mode === 'brush') {
        if (!cell) return
        const path = pointer.lastCell ? lineCells(pointer.lastCell, cell, 1, size.width, size.height) : [cell]
        path.forEach((point) => {
          const key = `${point.x}:${point.y}`
          if (visitedBrushCellsRef.current.has(key)) return
          visitedBrushCellsRef.current.add(key)
          onCell(point.x, point.y)
        })
        pointer.lastCell = cell
        return
      }
      if (pointer.mode === 'shape') {
        if (cell && pointer.startCell) onShape(pointer.startCell, cell)
        return
      }
      if (pointer.mode === 'select') {
        const dx = event.clientX - pointer.startX
        const dy = event.clientY - pointer.startY
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pointer.moved = true
        if (pointer.moved && pointer.startCell && cell) setSelectionDraft({ start: pointer.startCell, end: cell })
        return
      }
      if (pointer.mode === 'point') return
      const dx = event.clientX - pointer.startX
      const dy = event.clientY - pointer.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pointer.moved = true
      if (pointer.moved && canvasLayerRef.current) {
        canvasLayerRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      }
    }}
    onPointerUp={(event) => {
      const pointer = pointerRef.current
      if (pointer?.mode === 'select') {
        const endCell = pointToCell(event.clientX, event.clientY) ?? selectionDraft?.end ?? pointer.startCell
        if (!pointer.moved && pointer.startCell) {
          onSelectionChange(null)
          onCell(pointer.startCell.x, pointer.startCell.y)
        } else if (pointer.moved && pointer.startCell && endCell) {
          onSelectionChange({ start: pointer.startCell, end: endCell })
        }
        setSelectionDraft(null)
      }
      if (pointer?.mode === 'brush' || pointer?.mode === 'shape') onStrokeEnd()
      if (pointer?.mode === 'pan' && pointer.moved) {
        const dx = event.clientX - pointer.startX
        const dy = event.clientY - pointer.startY
        setPan({ x: pointer.panX + dx, y: pointer.panY + dy })
      }
      if (canvasLayerRef.current) canvasLayerRef.current.style.transform = 'translate3d(0, 0, 0)'
      pointerRef.current = null
      visitedBrushCellsRef.current.clear()
      setIsPanning(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }}
    onPointerLeave={() => { if (!pointerRef.current) updateBrushCell(null) }}
    onPointerCancel={() => { if (pointerRef.current?.mode === 'brush' || pointerRef.current?.mode === 'shape') onStrokeEnd(); if (canvasLayerRef.current) canvasLayerRef.current.style.transform = 'translate3d(0, 0, 0)'; pointerRef.current = null; visitedBrushCellsRef.current.clear(); updateBrushCell(null); setSelectionDraft(null); setIsPanning(false) }}
  >
    <div ref={canvasLayerRef} className="canvas-layer">
      <canvas
        ref={canvasRef}
        style={canvasStyle}
      />
      <canvas ref={fluidCanvasRef} className="canvas-fluid" style={canvasStyle} aria-hidden="true" />
      <canvas ref={overlayRef} className="canvas-overlay" style={canvasStyle} aria-hidden="true" />
    </div>
    <div className="canvas-controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" title="缩小地图" aria-label="缩小地图" onClick={() => setZoomPercentAround(zoomPercent - 10)}><Minus size={15} /></button>
      <input type="range" min="0" max="100" step="1" value={zoomPercent} aria-label="地图缩放" onChange={(event) => setZoomPercentAround(Number(event.target.value))} />
      <output>{zoomPercent}</output>
      <button type="button" title="放大地图" aria-label="放大地图" onClick={() => setZoomPercentAround(zoomPercent + 10)}><Plus size={15} /></button>
      <button type="button" className="canvas-reset" title="重置视图" aria-label="重置视图" onClick={() => { setZoomPercent(50); setPan({ x: 0, y: 0 }) }}>50</button>
      <button type="button" title="导出当前地图视图" aria-label="导出当前地图视图" onClick={() => { void exportCurrentMapImage() }}><Download size={15} /></button>
      <button type="button" title="导出整张高清全景地图" aria-label="导出整张高清全景地图" onClick={() => { void exportPanoramaImage() }}><Maximize2 size={15} /></button>
    </div>
  </div>
}

function temperatureColor(kelvin: number): string {
  const celsius = kelvin - 273.15
  const hue = Math.max(0, Math.min(220, 220 - (celsius + 40) * 0.75))
  const lightness = Math.max(30, Math.min(70, 46 + Math.abs(celsius - 20) * 0.04))
  return `hsl(${hue} 58% ${lightness}%)`
}

function DupesView({ save, updateSave, onOpenObject }: { save: ParsedSave; updateSave: (update: (save: ParsedSave) => void) => void; onOpenObject: (index: number) => void }) {
  const group = groupByTag(save, 'Minion')
  const rows = groupRows(group)
  const [selected, setSelected] = useState(0)
  const active = rows[selected]
  return (
    <div className="view-stack">
      <div className="view-intro"><div><p>已解析的殖民者实例</p><strong>{rows.length} 名复制人</strong></div><button className="button button-quiet" type="button" onClick={() => onOpenObject(selected)}><Boxes size={15} />打开对象详情</button></div>
      <section className="surface dupes-layout">
        <div className="dupe-list">
          <div className="list-head"><span>复制人</span><span>位置</span></div>
          {rows.map((row) => <button key={row.index} className={`dupe-row ${active?.index === row.index ? 'selected' : ''}`} type="button" onClick={() => setSelected(row.index)}><span className="dupe-avatar">{row.name.slice(0, 1)}</span><span className="dupe-name"><strong>{row.name}</strong><small>Minion #{row.index + 1}</small></span><span className="dupe-pos">{formatNumber(row.position.x, 1)}, {formatNumber(row.position.y, 1)}</span><ChevronRight size={15} /></button>)}
        </div>
        {active && <DupeInspector instance={active.instance} updateSave={updateSave} />}
      </section>
    </div>
  )
}

function DupeInspector({ instance, updateSave }: { instance: SavedObjectInstance; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const identity = component(instance, 'MinionIdentity')?.value
  const health = scalarNumber(member(component(instance, 'Health')?.value, 'canBeIncapacitated')?.value)
  const temperature = scalarNumber(member(component(instance, 'PrimaryElement')?.value, '_Temperature')?.value)
  const edit = (memberName: string, text: string) => updateSave(() => { const value = member(component(instance, 'MinionIdentity')?.value, memberName)?.value; if (value) setValueFromText(value, text) })
  return <aside className="dupe-inspector"><SectionHeading icon={<Users size={16} />} title={objectName('Minion', instance, 0)} action="INSPECTOR" /><div className="inspector-grid"><EditableField label="名称" value={member(identity, 'name')?.value} onCommit={(text) => edit('name', text)} /><TransformFields instance={instance} updateSave={updateSave} /></div><div className="dupe-facts"><InfoRow label="体温" value={temperature === undefined ? '—' : `${formatNumber(temperature - 273.15, 1)} °C`} /><InfoRow label="组件" value={`${instance.components.length}`} /><InfoRow label="禁用伤残" value={health === undefined ? '—' : health ? '是' : '否'} /></div></aside>
}

function ObjectsView({ save, selectedGroup, selectedIndex, onSelect, updateSave }: { save: ParsedSave; selectedGroup: string; selectedIndex: number; onSelect: (tag: string, index: number) => void; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const [query, setQuery] = useState('')
  const [groupQuery, setGroupQuery] = useState('')
  const groupList = topGroups(save).filter((group) => group.tag.toLowerCase().includes(groupQuery.toLowerCase()))
  const group = groupByTag(save, selectedGroup)
  const rows = groupRows(group).filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) || String(row.index + 1).includes(query))
  const active = group?.instances[selectedIndex] ?? rows[0]?.instance
  const activeIndex = active && group ? group.instances.indexOf(active) : selectedIndex
  return (
    <div className="objects-layout">
      <section className="surface object-groups"><div className="panel-title"><div><span className="eyebrow">SAVE MANAGER</span><h2>对象分组</h2></div><span className="panel-count">{groupList.length}</span></div><label className="search-box"><Search size={15} /><input value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} placeholder="搜索分组" /></label><div className="object-group-list">{groupList.map((item) => <button key={item.tag} className={`object-group-row ${selectedGroup === item.tag ? 'selected' : ''}`} type="button" onClick={() => onSelect(item.tag, 0)}><span className="group-symbol"><Boxes size={14} /></span><span>{item.tag}</span><strong>{item.count.toLocaleString()}</strong></button>)}</div></section>
      <section className="surface object-records"><div className="panel-title"><div><span className="eyebrow">{selectedGroup}</span><h2>实例列表</h2></div><span className="panel-count">{group?.instances.length ?? 0}</span></div><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称或编号" /></label><div className="records-table"><div className="records-head"><span>名称 / ID</span><span>位置</span><span>组件</span></div>{rows.slice(0, 100).map((row) => <button key={row.index} type="button" className={`record-row ${activeIndex === row.index ? 'selected' : ''}`} onClick={() => onSelect(selectedGroup, row.index)}><span><strong>{row.name}</strong><small>#{row.index + 1}</small></span><span>{formatNumber(row.position.x, 1)}, {formatNumber(row.position.y, 1)}</span><span>{row.components}</span></button>)}{rows.length > 100 && <div className="table-note">仅显示前 100 条匹配结果</div>}</div></section>
      <ObjectInspector instance={active} groupTag={selectedGroup} updateSave={updateSave} />
    </div>
  )
}

function ObjectInspector({ instance, groupTag, updateSave }: { instance: SavedObjectInstance | undefined; groupTag: string; updateSave: (update: (save: ParsedSave) => void) => void }) {
  const [componentName, setComponentName] = useState('')
  useEffect(() => { setComponentName(instance?.components.find((item) => item.value && editableMembers(item.value).length > 0)?.typeName ?? instance?.components[0]?.typeName ?? '') }, [instance])
  const active = component(instance, componentName) ?? instance?.components[0]
  if (!instance) return <aside className="surface inspector-empty"><Boxes size={22} /><span>选择一个实例查看详情</span></aside>
  return <aside className="surface object-inspector"><div className="panel-title"><div><span className="eyebrow">{groupTag} INSPECTOR</span><h2>{objectName(groupTag, instance, 0)}</h2></div><Settings2 size={17} className="title-icon" /></div><TransformFields instance={instance} updateSave={updateSave} /><div className="component-heading"><span>组件</span><span>{instance.components.length}</span></div><div className="component-tabs">{instance.components.map((item) => <button key={item.typeName} type="button" className={active?.typeName === item.typeName ? 'selected' : ''} onClick={() => setComponentName(item.typeName)}>{item.typeName.split('.').pop()}<span>{item.value ? item.value.members.length : 'raw'}</span></button>)}</div>{active && <div className="component-editor"><div className="component-name"><span>{active.typeName}</span><small>{active.value ? `${active.value.members.length} fields` : `${active.raw?.length ?? active.details?.length ?? 0} bytes`}</small></div>{active.value ? <div className="field-list">{editableMembers(active.value).map((item) => <EditableField key={item.name} label={item.name} value={item.value} onCommit={(text) => updateSave(() => { setValueFromText(item.value, text) })} />)}</div> : <div className="raw-notice"><AlertTriangle size={15} />该组件保留为原始字节，暂不直接编辑。</div>}</div>}</aside>
}

function TransformFields({ instance, updateSave }: { instance: SavedObjectInstance; updateSave: (update: (save: ParsedSave) => void) => void }) {
  return <div className="transform-fields"><div className="field-label">位置 <span>WORLD COORDINATES</span></div><div className="transform-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis}</span><input value={instance.position[axis]} type="number" step="0.5" onChange={(event) => updateSave(() => { instance.position[axis] = Number(event.target.value) })} /></label>)}</div></div>
}

function InlineMember({ label, value, updateSave, componentName, memberName }: { label: string; value: Value | undefined; updateSave: (update: (save: ParsedSave) => void) => void; componentName: string; memberName: string }) {
  return <div className="inline-member"><span>{label}</span><EditableField compact value={value} onCommit={(text) => updateSave((save) => { const instance = saveGameInstance(save); const current = member(instance?.components.find((item) => item.typeName === componentName)?.value, memberName)?.value; if (current) setValueFromText(current, text) })} /></div>
}

function EditableField({ label, value, onCommit, compact = false }: { label?: string; value: Value | undefined; onCommit: (text: string) => void; compact?: boolean }) {
  const [draft, setDraft] = useState(scalarText(value))
  useEffect(() => setDraft(scalarText(value)), [value])
  if (!value || !isEditable(value)) return <div className="field-value muted">{scalarText(value)}</div>
  if (value.kind === 'boolean') return <label className={`toggle-field ${compact ? 'compact' : ''}`}><span>{label}</span><input type="checkbox" checked={value.v} onChange={(event) => onCommit(event.target.checked ? 'true' : 'false')} /><i /></label>
  return <label className={`editable-field ${compact ? 'compact' : ''}`}><span>{label}</span><input value={draft} type={value.kind === 'string' ? 'text' : 'number'} onChange={(event) => setDraft(event.target.value)} onBlur={() => { onCommit(draft); setDraft(scalarText(value)) }} /></label>
}

function Metric({ icon, label, value, note, accent }: { icon: React.ReactNode; label: string; value: string; note: string; accent: string }) {
  return <div className={`metric surface accent-${accent}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>
}

function SectionHeading({ icon, title, action }: { icon: React.ReactNode; title: string; action: string }) {
  return <div className="section-heading"><div><span className="section-icon">{icon}</span><h2>{title}</h2></div><span className="section-action">{action}</span></div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="info-row"><span>{label}</span><strong>{value}</strong></div>
}

export default App
