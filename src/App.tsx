import { createOniMapOverview } from './lib/oniMapOverview'
import { sceneViewportForCamera } from './lib/oniSceneViewport'
import { createOniCellOutline } from './lib/oniCellOutline'
import { gridSelectionRect } from './lib/oniGridSelection'
import { createOniCellTooltip } from './lib/oniCellTooltip'
import { OniFluidFrameClock } from './lib/oniFluidFrameClock'
import { fluidViewportForCamera } from './lib/oniFluidViewport'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
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
  FileText,
  Gauge,
  Grid2x2,
  Hand,
  Layers3,
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
import { ONI_CHUNK_LAYERS } from './lib/oniRenderLayers'
import { buildSave, type ParsedSave } from './lib/save'
import { ELEMENTS, defaultElementValues, elementForHash, elementOptions, formatHash } from './lib/elements'
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
  worldSize,
} from './lib/editor'
import type { SavedObjectInstance, Value } from './lib/model'
import { getWorldCell, readSimCell, setWorldCells, type SimCell } from './lib/sim'
import {
  createTerrainBoundaryPath,
  createTerrainCellPath,
} from './lib/terrainMasks'
import { parseYamlTemplate, templateVisualElementForName, type TemplateEntity, type YamlTemplate } from './lib/yamlTemplates'
import { PixiWorldScene } from './lib/pixiWorldScene'
import { createOniChunkRenderer, type OniChunkLayer } from './lib/oniWorldChunkRenderer'
import { drawMinionKanim, loadMinionKanimAssets, type MinionKanimAssets } from './lib/oniMinionKanim'

type View = 'overview' | 'map' | 'dupes' | 'objects'
type MapLayer = 'grid' | 'biome' | 'minions' | 'entities' | 'buildings' | 'geysers' | 'power' | 'plumbing' | 'ventilation' | 'automation' | 'shipment' | 'gas' | 'liquid' | 'ground' | 'backwall'
type MapOverlay = 'none' | 'temperature' | 'mass' | 'disease' | 'visibility' | 'spawnable' | 'damage'
type MapLayerVisibility = Record<MapLayer, boolean>
type MapEdit = { x: number; y: number; before: SimCell; after: SimCell }
type MapPreviewCell = { x: number; y: number; elementHash: number }
type MapSelection = { start: { x: number; y: number }; end: { x: number; y: number } }
type MapTool = 'inspect' | 'move' | 'paint' | 'erase' | 'eyedropper' | 'fill' | 'rectangle' | 'line'
type MapCellUpdate = { x: number; y: number; patch: Partial<SimCell> }
type MapViewport = { zoomPercent: number; pan: { x: number; y: number } }
// Start at the source grid's full extent. A save can place its active asteroid
// far away from the global grid centre, so a magnified centred view may contain
// only unexplored fog even though the colony data rendered correctly.
const DEFAULT_MAP_VIEWPORT: MapViewport = { zoomPercent: 0, pan: { x: 0, y: 0 } }
const MAP_ZOOM_MIN = 1
const MAP_ZOOM_MAX = 16
const DEFAULT_ELEMENT_WORLD_UV_SCALE = 8
function assetPath(path: string): string {
  if (!path.startsWith('/')) return path
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
}

// The game samples these layers from the bgarray Texture2DArray. The values
// match SubworldZoneRenderData.zoneTextureArrayIndices in the game source.



function loadAssetImage(path: string, onLoad: (image: HTMLImageElement) => void): void {
  const image = new Image()
  let settled = false
  const finish = () => {
    if (settled || !image.naturalWidth || !image.naturalHeight) return
    settled = true
    onLoad(image)
  }
  image.decoding = 'async'
  image.onload = finish
  image.src = assetPath(path)
  // Cached assets may already be complete before the load callback is attached.
  if (image.complete) finish()
}











function minionAccessoryGuids(instance: SavedObjectInstance): string[] {
  const accessorizer = component(instance, 'Accessorizer')?.value
  const accessories = member(accessorizer, 'accessories')?.value
  if (accessories?.kind !== 'list') return []
  return accessories.items.flatMap((item) => {
    if (item.kind !== 'object') return []
    const guidReference = member(item, 'guid')?.value
    if (guidReference?.kind !== 'object') return []
    const guid = member(guidReference, 'Guid')?.value
    return guid?.kind === 'string' && guid.v ? [guid.v] : []
  })
}

function numericValue(value: Value | undefined): number | undefined {
  return value?.kind === 'sbyte' || value?.kind === 'byte' || value?.kind === 'int16' || value?.kind === 'uint16'
    || value?.kind === 'int32' || value?.kind === 'uint32' || value?.kind === 'enum' ? value.v : undefined
}

function minionWearableAnimNames(instance: SavedObjectInstance): string[] {
  const wearables = member(component(instance, 'WearableAccessorizer')?.value, 'wearables')?.value
  if (wearables?.kind !== 'dict') return []
  let highestType = -1
  let selected: Value | undefined
  wearables.keys.forEach((key, index) => {
    const type = numericValue(key)
    if (type !== undefined && type > highestType) {
      highestType = type
      selected = wearables.values[index]
    }
  })
  if (selected?.kind !== 'object') return []
  const animNames = member(selected, 'animNames')?.value
  return animNames?.kind === 'list' ? animNames.items.flatMap((item) => item.kind === 'string' && item.v ? [item.v] : []) : []
}

function saveMinionWearableAnimNames(save: ParsedSave): string[] {
  const minions = save.manager?.groups.find((group) => group.tag === 'Minion')?.instances ?? []
  return [...new Set(minions.flatMap(minionWearableAnimNames))].sort()
}

function minionFacesLeft(instance: SavedObjectInstance): boolean {
  const value = member(component(instance, 'Facing')?.value, 'facingLeft')?.value
  return value?.kind === 'boolean' ? value.v : false
}





/**
 * Unity renders the game's orthographic scene from larger Z toward smaller Z.
 * Grid.GetLayerZ makes higher/front SceneLayer values increasingly negative,
 * so canvas must paint saved objects in descending Z order.
 */









const MAP_LAYERS: Array<{ id: MapLayer; label: string; detail: string }> = [
  { id: 'grid', label: '网格', detail: '编辑器辅助' },
  { id: 'biome', label: '群落色', detail: 'WorldZone.Tint' },
  { id: 'minions', label: '复制人', detail: 'SceneLayer.Creatures' },
  { id: 'entities', label: '生物 / 实体', detail: 'IEntityConfig KAnim' },
  { id: 'buildings', label: '建筑', detail: 'SceneLayer.Building' },
  { id: 'geysers', label: '喷泉', detail: 'SceneLayer.Geyser' },
  { id: 'power', label: '电力', detail: 'SceneLayer.Wires' },
  { id: 'plumbing', label: '液体管道', detail: 'SceneLayer.LiquidConduits' },
  { id: 'ventilation', label: '气体管道', detail: 'SceneLayer.GasConduits' },
  { id: 'automation', label: '自动化线', detail: 'SceneLayer.LogicWires' },
  { id: 'shipment', label: '运输管道', detail: 'SceneLayer.SolidConduits' },
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
  entities: true,
  buildings: true,
  geysers: true,
  power: true,
  plumbing: true,
  ventilation: true,
  automation: true,
  shipment: true,
  // LightingSettings.ShowGas is enabled in the game scene, so GasTest is part
  // of the normal map view rather than an opt-in analysis overlay.
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
type ImportedYamlTemplate = { path: string; template: YamlTemplate }
type DroppedFile = { file: File; path: string }
type BrowserFileEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (success: (file: File) => void, error?: (cause: unknown) => void) => void
  createReader?: () => BrowserDirectoryReader
}
type BrowserDirectoryReader = { readEntries: (success: (entries: BrowserFileEntry[]) => void, error?: (cause: unknown) => void) => void }
type DataTransferItemWithEntry = { webkitGetAsEntry?: () => BrowserFileEntry | null }

const savePickerOptions: SavePickerOptions = {
  types: [{ description: 'Oxygen Not Included save', accept: { 'application/octet-stream': ['.sav'] } }],
  multiple: false,
}

const documentPickerOptions: SavePickerOptions = {
  types: [{ description: 'Oxygen Not Included save or YAML template', accept: { 'application/octet-stream': ['.sav'], 'text/yaml': ['.yaml', '.yml'] } }],
  multiple: false,
}

function readDroppedFileEntry(entry: BrowserFileEntry, parentPath: string): Promise<DroppedFile[]> {
  if (entry.isFile && entry.file) {
    return new Promise((resolve, reject) => {
      entry.file?.((file) => resolve([{ file, path: `${parentPath}${entry.name}` }]), reject)
    })
  }
  if (!entry.isDirectory || !entry.createReader) return Promise.resolve([])
  const reader = entry.createReader()
  const readAllEntries = async (): Promise<BrowserFileEntry[]> => {
    const entries: BrowserFileEntry[] = []
    while (true) {
      const batch = await new Promise<BrowserFileEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      if (batch.length === 0) return entries
      entries.push(...batch)
    }
  }
  return readAllEntries().then(async (entries) => {
    const children = await Promise.all(entries.map((child) => readDroppedFileEntry(child, `${parentPath}${entry.name}/`)))
    return children.flat()
  })
}

async function droppedFilesFromTransfer(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => (item as unknown as DataTransferItemWithEntry).webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is BrowserFileEntry => entry !== null)
  if (entries.length > 0) {
    const groups = await Promise.all(entries.map((entry) => readDroppedFileEntry(entry, '')))
    return groups.flat()
  }
  return Array.from(dataTransfer.files).map((file) => ({
    file,
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }))
}

const navItems: Array<{ id: View; label: string }> = [
  { id: 'overview', label: '总览' },
  { id: 'map', label: '地图' },
  { id: 'dupes', label: '复制人' },
  { id: 'objects', label: '对象' },
]

function parseSaveOffThread(bytes: Uint8Array): Promise<ParsedSave> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./lib/saveWorker.ts', import.meta.url), { type: 'module' })
    const finish = () => worker.terminate()
    worker.onmessage = (event: MessageEvent<{ ok: boolean; save?: ParsedSave; error?: string }>) => {
      finish()
      if (event.data.ok && event.data.save) resolve(event.data.save)
      else reject(new Error(event.data.error || '无法解析这个存档文件。'))
    }
    worker.onerror = (event) => {
      finish()
      reject(new Error(event.message || '存档后台解析线程失败。'))
    }
    worker.postMessage({ buffer: bytes.buffer }, [bytes.buffer])
  })
}

function App() {
  const [save, setSave] = useState<ParsedSave | null>(null)
  const [yamlTemplate, setYamlTemplate] = useState<YamlTemplate | null>(null)
  const [yamlDocuments, setYamlDocuments] = useState<ImportedYamlTemplate[]>([])
  const [selectedYamlPath, setSelectedYamlPath] = useState('')
  const [fileName, setFileName] = useState('')
  const [view, setView] = useState<View>('overview')
  const [mapViewport, setMapViewport] = useState<MapViewport>(DEFAULT_MAP_VIEWPORT)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState('Minion')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [sourceHandle, setSourceHandle] = useState<SaveFileHandle | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const loadYamlSources = useCallback(async (sources: DroppedFile[]) => {
    const yamlSources = sources.filter(({ file }) => /\.ya?ml$/i.test(file.name))
    if (yamlSources.length === 0) {
      setError('拖入的内容中没有 YAML 文件。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const results = await Promise.all(yamlSources.map(async ({ file, path }) => {
        try {
          return { path, template: parseYamlTemplate(await file.text(), path) }
        } catch {
          return null
        }
      }))
      const parsed = results.filter((item): item is ImportedYamlTemplate => item !== null)
      if (parsed.length === 0) throw new Error('无法解析拖入的 YAML 文件。')
      const first = parsed[0]
      setYamlDocuments(parsed)
      setSelectedYamlPath(first.path)
      setYamlTemplate(first.template)
      setSave(null)
      setFileName(parsed.length === 1 ? first.path : `${first.path.split('/')[0]} · ${parsed.length} 个 YAML`)
      setSourceHandle(null)
      setDirty(false)
      setMapViewport(DEFAULT_MAP_VIEWPORT)
      if (parsed.length < yamlSources.length) setError(`有 ${yamlSources.length - parsed.length} 个 YAML 无法解析，已跳过。`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法解析这个 YAML 文件。')
      setYamlDocuments([])
      setSelectedYamlPath('')
      setYamlTemplate(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadYamlFile = useCallback(async (file: File) => {
    if (!/\.ya?ml$/i.test(file.name)) {
      setError('请选择 YAML 模板文件。')
      return
    }
    await loadYamlSources([{ file, path: file.name }])
  }, [loadYamlSources])

  const loadFile = useCallback(async (file: File, handle: SaveFileHandle | null = null) => {
    if (!file.name.toLowerCase().endsWith('.sav')) {
      setError('请选择 Oxygen Not Included 的 .sav 存档文件。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const parsed = await parseSaveOffThread(new Uint8Array(await file.arrayBuffer()))
      setSave(parsed)
      setYamlTemplate(null)
      setYamlDocuments([])
      setSelectedYamlPath('')
      setFileName(file.name)
      setSourceHandle(handle)
      setDirty(false)
      const requestedView = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('view') : null
      setView(requestedView === 'map' ? 'map' : 'overview')
      setMapViewport(DEFAULT_MAP_VIEWPORT)
      setSelectedGroup('Minion')
      setSelectedIndex(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法解析这个存档文件。')
      setSave(null)
      setYamlTemplate(null)
      setYamlDocuments([])
      setSelectedYamlPath('')
    } finally {
      setLoading(false)
    }
  }, [])

  // The C# desktop shell sends the selected save through this small bridge.
  // Keeping the same File-based path as the browser UI means the desktop
  // build uses the exact same binary parser, WebGL layers and edit history.
  useEffect(() => {
    const onHostSave = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; data?: string }>).detail
      if (!detail?.data) return
      try {
        const encoded = atob(detail.data)
        const bytes = new Uint8Array(encoded.length)
        for (let index = 0; index < encoded.length; index += 1) bytes[index] = encoded.charCodeAt(index)
        void loadFile(new File([bytes], detail.name || 'save.sav', { type: 'application/octet-stream' }))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '桌面外壳传入的存档无法读取。')
      }
    }
    window.addEventListener('oni-host-open-save', onHostSave)
    return () => window.removeEventListener('oni-host-open-save', onHostSave)
  }, [loadFile])

  useEffect(() => {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('fixture') !== '1') return
    let active = true
    void fetch('/__oni_fixture__').then(async (response) => {
      if (!response.ok) throw new Error(`本地视觉测试存档读取失败：HTTP ${response.status}`)
      const encodedName = response.headers.get('X-Fixture-Name')
      const name = encodedName ? decodeURIComponent(encodedName) : 'visual-fixture.sav'
      if (active) await loadFile(new File([await response.arrayBuffer()], name))
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '本地视觉测试存档读取失败。') })
    return () => { active = false }
  }, [loadFile])

  const updateSave = useCallback((update: (current: ParsedSave) => void) => {
    setSave((current) => {
      if (!current) return current
      update(current)
      return { ...current }
    })
    setDirty(true)
  }, [])

  const returnHome = useCallback(() => {
    if (dirty && !window.confirm('当前有未导出的修改，确定返回主界面吗？')) return
    setSave(null)
    setYamlTemplate(null)
    setYamlDocuments([])
    setSelectedYamlPath('')
    setFileName('')
    setSourceHandle(null)
    setDirty(false)
    setError('')
    setView('overview')
    setMapViewport(DEFAULT_MAP_VIEWPORT)
  }, [dirty])

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
      const [handle] = await pickerWindow.showOpenFilePicker(documentPickerOptions)
      if (handle) {
        const file = await handle.getFile()
        if (/\.ya?ml$/i.test(file.name)) await loadYamlFile(file)
        else await loadFile(file, handle)
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : '无法打开存档文件。')
    }
  }, [loadFile, loadYamlFile])

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
    void droppedFilesFromTransfer(event.dataTransfer).then((droppedFiles) => {
      const yamlFiles = droppedFiles.filter(({ file }) => /\.ya?ml$/i.test(file.name))
      if (yamlFiles.length > 0) void loadYamlSources(yamlFiles)
      else if (droppedFiles[0]) void loadFile(droppedFiles[0].file)
    })
  }

  const hasDocument = Boolean(save || yamlTemplate)

  return (
    <div className={`app-shell ${save ? `saved-shell view-${view}` : yamlTemplate ? 'template-shell' : 'landing-shell'}`}>
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept=".sav,.yaml,.yml,application/octet-stream,text/yaml"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            if (/\.ya?ml$/i.test(file.name)) void loadYamlFile(file)
            else void loadFile(file)
          }
          event.target.value = ''
        }}
      />
      <header className="topbar">
        <div className={`topbar-pill ${hasDocument ? 'is-loaded' : 'is-landing'}`}>
          <button type="button" className={`brand-lockup brand-home ${hasDocument ? 'is-clickable' : ''}`} onClick={() => { if (hasDocument) returnHome() }} aria-label={hasDocument ? '返回主界面' : '缺氧存档编辑器'} title={hasDocument ? '返回主界面' : undefined}>
            <div className="brand-mark"><Archive size={16} strokeWidth={2.5} /></div>
            <div>
              <div className="brand-name">缺氧存档编辑器</div>
              <div className="brand-caption">ONI SAVE EDITOR</div>
            </div>
          </button>
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
            ) : yamlTemplate ? (
              <>
                <div className="file-chip" title={fileName}><span className="status-dot template-dot" /><span>{fileName}</span></div>
                <button className="button button-quiet" type="button" onClick={openPicker} title="打开另一个文件"><FileUp size={15} /> <span>打开</span></button>
              </>
            ) : (
              <button className="button button-primary" type="button" onClick={openPicker}>
                <Upload size={15} /> <span>打开文件</span>
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

      {!hasDocument ? (
        <EmptyState loading={loading} isDragging={isDragging} onPick={openPicker} onDrop={handleDrop} onDragChange={setIsDragging} />
      ) : yamlTemplate ? (
        <div className="workspace">
          <main className="main-content main-content-template">
            <YamlWorkspace template={yamlTemplate} fileName={fileName} documents={yamlDocuments} selectedPath={selectedYamlPath} onSelect={(path) => {
              const selected = yamlDocuments.find((document) => document.path === path)
              if (!selected) return
              setSelectedYamlPath(path)
              setYamlTemplate(selected.template)
            }} />
          </main>
        </div>
      ) : save ? (
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
            {view === 'map' && <MapView save={save} updateSave={updateSave} viewport={mapViewport} onViewportChange={setMapViewport} />}
            {view === 'dupes' && <DupesView save={save} updateSave={updateSave} onOpenObject={(index) => { setSelectedGroup('Minion'); setSelectedIndex(index); setView('objects') }} />}
            {view === 'objects' && <ObjectsView save={save} selectedGroup={selectedGroup} selectedIndex={selectedIndex} onSelect={(tag, index) => { setSelectedGroup(tag); setSelectedIndex(index) }} updateSave={updateSave} />}
          </main>
        </div>
      ) : null}
    </div>
  )
}

function EmptyState({ loading, isDragging, onPick, onDrop, onDragChange }: { loading: boolean; isDragging: boolean; onPick: () => void; onDrop: (event: React.DragEvent<HTMLDivElement>) => void; onDragChange: (value: boolean) => void }) {
  const [landingLanguage, setLandingLanguage] = useState<'zh' | 'en'>('zh')
  const english = landingLanguage === 'en'
  return (
    <div className={`empty-state ${isDragging ? 'is-dragging' : ''}`} lang={english ? 'en' : 'zh-CN'} onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); onDragChange(true) }} onDragLeave={() => onDragChange(false)}>
      <ColonyBackdrop />
      <div className="landing-frame">
        <header className="landing-header">
          <div className="landing-brand">
            <span className="landing-brand-icon"><Archive size={20} strokeWidth={2.2} /></span>
            <span><strong>{english ? 'ONI Save Editor' : '缺氧存档编辑器'}</strong><small>{english ? 'COLONY DATA WORKSPACE' : 'ONI SAVE EDITOR'}</small></span>
          </div>
          <div className="landing-header-actions">
            <div className="landing-local"><span className="status-dot" />LOCAL WORKSPACE</div>
            <button className="landing-language" type="button" onClick={() => setLandingLanguage(english ? 'zh' : 'en')} aria-label={english ? '切换到中文' : 'Switch to English'} title={english ? '切换到中文' : 'Switch to English'}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.45 3.35 5.45 3.35 9S14.2 18.55 12 21c-2.2-2.45-3.35-5.45-3.35-9S9.8 5.45 12 3Z" /></svg>
              <span>{english ? '中' : 'EN'}</span>
            </button>
            <a className="landing-github" href="https://github.com/ChiYuKe/oni-save-editor" target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库" title="GitHub 仓库">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.3 11.3 0 0 0-3.57 22.02c.57.1.78-.25.78-.55v-2.19c-3.18.69-3.85-1.35-3.85-1.35-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.33.95.1-.74.4-1.25.73-1.54-2.54-.29-5.21-1.27-5.21-5.59 0-1.24.44-2.24 1.18-3.04-.12-.29-.51-1.45.11-3 0 0 .96-.31 3.11 1.16A10.8 10.8 0 0 1 12 6c.96 0 1.93.13 2.83.38 2.16-1.47 3.11-1.16 3.11-1.16.62 1.55.23 2.71.11 3 .74.8 1.18 1.8 1.18 3.04 0 4.33-2.68 5.29-5.23 5.57.41.35.78 1.05.78 2.12v3.22c0 .3.21.66.79.55A11.3 11.3 0 0 0 12 .7Z" /></svg>
            </a>
          </div>
        </header>

        <main className="landing-main">
          <section className="landing-copy">
            <div className="landing-eyebrow">COLONY DATA, CLEARLY PRESENTED</div>
            {english ? <h1>Make complex<br /><span>colony data</span><br />clear.</h1> : <h1>把复杂的<br /><span>殖民地数据</span><br />变得清晰。</h1>}
            <p>{english ? 'Open Oxygen Not Included saves and YAML templates, inspect the world visually, and safely edit duplicants and game objects.' : '读取《缺氧》存档与 YAML 模板，用可视化地图检查世界，并安全地编辑复制人和对象数据。'}</p>
            <div className="landing-features">
              <article><span><Layers3 size={20} /></span><div><strong>{english ? 'Visual map' : '地图可视化'}</strong><small>{english ? 'Restore the world by game layer' : '按游戏层级还原世界'}</small></div></article>
              <article><span><Users size={20} /></span><div><strong>{english ? 'Duplicant data' : '复制人数据'}</strong><small>{english ? 'Review and adjust attributes' : '集中查看与调整属性'}</small></div></article>
              <article><span><Boxes size={20} /></span><div><strong>{english ? 'Object editing' : '对象编辑'}</strong><small>{english ? 'Find save objects precisely' : '精确定位存档对象'}</small></div></article>
            </div>
          </section>

          <section className="landing-upload">
            <div className="upload-decoration" aria-hidden="true"><span /><span /><span /></div>
            <div className="upload-icon"><FileUp size={30} strokeWidth={1.8} /></div>
            <div className="upload-kicker">OPEN COLONY DATA</div>
            <h2>{isDragging ? (english ? 'Drop to open' : '松开即可载入') : (english ? 'Start with a save' : '从一个存档开始')}</h2>
            <p>{isDragging ? (english ? 'Your file is ready. Release to continue.' : '文件已准备好，松开鼠标继续') : (english ? 'Drop a save or YAML file here, or choose one from your device.' : '将存档或 YAML 文件拖到此处，也可以从本地选择。')}</p>
            <button className="button button-primary button-large" type="button" onClick={onPick} disabled={loading}>
              {loading ? <><span className="spinner" />{english ? 'Parsing...' : '解析中...'}</> : <><FileUp size={17} />{english ? 'Choose file' : '选择文件'}</>}
            </button>
            <div className="upload-formats"><span>.SAV</span><span>.YAML</span></div>
            <div className="upload-privacy"><Gauge size={14} /><span>{english ? 'Processed on this device. Nothing is uploaded.' : '数据只在当前设备处理，不会上传服务器'}</span></div>
          </section>
        </main>

        <footer className="landing-footer"><span>SIMULATION TOOLS / V1</span><span>{english ? 'DESIGNED FOR LOCAL WORKFLOWS' : '为本地工作流设计'}</span></footer>
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

function MapView({ save, updateSave, viewport, onViewportChange }: { save: ParsedSave; updateSave: (update: (save: ParsedSave) => void) => void; viewport: MapViewport; onViewportChange: Dispatch<SetStateAction<MapViewport>> }) {
  const [visibleLayers, setVisibleLayers] = useState<MapLayerVisibility>(DEFAULT_MAP_LAYER_VISIBILITY)
  const [layersExpanded, setLayersExpanded] = useState(false)
  const [overlay, setOverlay] = useState<MapOverlay>('none')
  const [tool, setTool] = useState<MapTool>('inspect')
  const [brushSize, setBrushSize] = useState(1)
  const [lastCell, setLastCell] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<MapSelection | null>(null)
  const [selectedElement, setSelectedElement] = useState(0x0307)
  const undoStackRef = useRef<MapEdit[][]>([])
  const redoStackRef = useRef<MapEdit[][]>([])
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
    if (hash === 0xbf75) return { elementHash: hash, temperature: 0, mass: 0 }
    const defaults = defaultElementValues(hash)
    return {
      elementHash: hash,
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
      setSelection(null)
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
          <section className={`map-layer-settings map-layer-floating ${layersExpanded ? 'is-expanded' : 'is-collapsed'}`}>
            <button type="button" className="map-layer-toggle" aria-label={layersExpanded ? '收起图层' : '展开图层'} title={layersExpanded ? '收起图层' : '展开图层'} aria-expanded={layersExpanded} onClick={() => setLayersExpanded((expanded) => !expanded)}>
              <span className="map-layer-toggle-expanded">
                <span className="map-layer-toggle-main"><ChevronRight className="map-layer-toggle-chevron" size={15} /><span className="section-icon"><Layers3 size={16} /></span><strong>图层</strong></span>
                <span className="map-layer-toggle-meta"><span>{Object.values(visibleLayers).filter(Boolean).length}/{MAP_LAYERS.length}</span></span>
              </span>
              <Eye className="map-layer-collapsed-eye" size={16} aria-hidden="true" />
            </button>
            <div className="map-layer-stack" aria-hidden={!layersExpanded}>
              <div className="map-layer-stack-inner">
                {MAP_LAYERS.map((item) => <button key={item.id} type="button" tabIndex={layersExpanded ? 0 : -1} className={`map-layer-row ${visibleLayers[item.id] ? 'visible' : 'hidden'}`} aria-pressed={visibleLayers[item.id]} onClick={() => toggleLayer(item.id)} title={`${visibleLayers[item.id] ? '隐藏' : '显示'}${item.label}`}>
                  {visibleLayers[item.id] ? <Eye size={15} /> : <EyeOff size={15} />}
                  <span className={`layer-swatch layer-swatch-${item.id}`} />
                  <span className="map-layer-name">{item.label}</span>
                  <small>{item.detail}</small>
                </button>)}
              </div>
            </div>
          </section>
          <PixiMapCanvas save={save} visibleLayers={visibleLayers} overlay={overlay} tool={tool} brushSize={brushSize} viewport={viewport} onViewportChange={onViewportChange} selectedCell={lastCell} selection={selection} previewCells={previewCellsRef.current} previewVersion={previewVersion} onCell={handleCell} onSelectionChange={(next) => { setSelection(next); if (next) setLastCell(null) }} onShape={previewShape} onStrokeStart={beginStroke} onStrokeEnd={endStroke} />
          <div className="map-legend"><span><i className="legend-visible" />独立图层</span><span><i className="legend-entity" />{overlay === 'none' ? '无分析覆盖' : `${overlayLabel}覆盖`}</span><span><i className="legend-damage" />选中单元</span><span className="legend-help">SIM 网格含四周边界层</span></div>
        </div>
      </section>
      <aside className="map-parameter-rail map-info">
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
            {elementForHash(selectedCell.elementHash).state === 'vacuum' ? <div className="map-stat"><span>温度</span><strong>—（真空）</strong></div> : <><label className="sim-field"><span>温度 °C</span><input type="number" min="-273.15" step="0.1" value={(selectedCell.temperature - 273.15).toFixed(2)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= -273.15) patchCell(lastCell, { temperature: value + 273.15 }) }} /></label></>}
            <label className="sim-field"><span>质量 kg</span><input type="number" min="0" step="0.001" value={selectedCell.mass.toFixed(3)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0) patchCell(lastCell, { mass: value }) }} /></label>
            <div className="map-stat"><span>状态</span><strong>{elementForHash(selectedCell.elementHash).state}</strong></div>
            <div className="map-stat"><span>完整元素 ID</span><strong>{selectedCell.elementId}</strong></div>
          </> : <div className="inspector-empty map-empty"><Search size={18} /><span>选择一个单元查看数据</span></div>}
          </>}
          <div className="map-stat"><span>模拟网格</span><strong>{sim ? `${sim.width} × ${sim.height}` : '—'}</strong></div>
      </aside>
    </div>
  )
}

function YamlWorkspace({ template, fileName, documents, selectedPath, onSelect }: { template: YamlTemplate; fileName: string; documents: ImportedYamlTemplate[]; selectedPath: string; onSelect: (path: string) => void }) {
  return <div className="yaml-workspace">
    <div className="content-head content-head-template">
      <div>
        <div className="eyebrow">YAML TERRAIN</div>
        <h1>地形预览</h1>
      </div>
      {documents.length > 1 ? <label className="yaml-source-picker"><span>已导入 {documents.length} 个 YAML</span><select value={selectedPath} onChange={(event) => onSelect(event.target.value)}>{documents.map((document) => <option key={document.path} value={document.path}>{document.path}</option>)}</select></label> : <div className="head-meta"><span className="status-dot template-dot" />已载入<ChevronRight size={14} />{fileName}</div>}
    </div>
    <div className="yaml-preview-layout">
      <section className="yaml-preview-main">
        <TemplateCanvas template={template} />
        <div className="map-legend template-legend"><span><i className="legend-visible" />YAML 地形</span><span><i className="legend-entity" />建筑 / 对象位置</span><span className="legend-help">只读预览</span></div>
      </section>
      <aside className="map-parameter-rail map-info yaml-preview-info"><TemplateDetails template={template} loading={false} error="" /></aside>
    </div>
  </div>
}

function TemplateDetails({ template, loading, error }: { template: YamlTemplate | null; loading: boolean; error: string }) {
  if (!template) {
    return <div className="template-details-empty"><FileText size={21} /><strong>{loading ? '正在读取 YAML' : '尚未选择模板'}</strong><span>{error || '从上方选择一个模板文件'}</span></div>
  }
  const objectCount = template.buildings.length + template.pickupables.length + template.elementalOres.length + template.otherEntities.length
  return <>
    <section className="template-details">
      <SectionHeading icon={<FileText size={16} />} title="YAML 模板" action={template.category} />
      <h2 className="template-name">{template.name}</h2>
      <div className="template-path">{template.path}</div>
      <div className="template-stat-grid">
        <div><span>尺寸</span><strong>{template.width} × {template.height}</strong></div>
        <div><span>原点</span><strong>{template.minX}, {template.minY}</strong></div>
        <div><span>地形格</span><strong>{template.cells.length.toLocaleString()}</strong></div>
        <div><span>对象</span><strong>{objectCount.toLocaleString()}</strong></div>
      </div>
    </section>
    <div className="map-section-divider" />
    <SectionHeading icon={<Layers3 size={16} />} title="内容统计" action="CELLS" />
    <div className="template-count-list">
      <div><span className="template-count-dot solid" />固体地形<strong>{template.solidCount.toLocaleString()}</strong></div>
      <div><span className="template-count-dot fluid" />气体 / 液体<strong>{template.fluidCount.toLocaleString()}</strong></div>
      <div><span className="template-count-dot empty" />真空<strong>{template.vacuumCount.toLocaleString()}</strong></div>
      {template.unknownCount > 0 && <div><span className="template-count-dot unknown" />通用样式元素<strong>{template.unknownCount.toLocaleString()}</strong></div>}
    </div>
    <div className="map-section-divider" />
    <div className="map-info-copy">模板只读预览。地形使用 YAML 的 `location_x` / `location_y` 坐标绘制，建筑和其他对象以位置标记显示。</div>
  </>
}

function TemplateCanvas({ template }: { template: YamlTemplate }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const [textures, setTextures] = useState<Record<string, HTMLImageElement>>({})
  const [zoomPercent, setZoomPercent] = useState(50)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const fitCellSize = viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(18, viewportSize.width / template.width, viewportSize.height / template.height)
    : 12
  const zoom = .75 + 2.5 * zoomPercent / 100
  const displayCellSize = Math.max(1, fitCellSize * zoom)
  const devicePixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  const renderCellSize = Math.max(1, displayCellSize * devicePixelRatio)
  const originX = ((viewportSize.width - template.width * displayCellSize) / 2 + pan.x) * devicePixelRatio
  const originY = ((viewportSize.height - template.height * displayCellSize) / 2 + pan.y) * devicePixelRatio
  const viewportPixelWidth = Math.max(1, Math.ceil(viewportSize.width * devicePixelRatio))
  const viewportPixelHeight = Math.max(1, Math.ceil(viewportSize.height * devicePixelRatio))

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
    const paths = new Set(template.cells.map((cell) => templateVisualElementForName(cell.element).texture).filter((path): path is string => Boolean(path)))
    paths.forEach((path) => loadAssetImage(path, (image) => { if (active) setTextures((current) => ({ ...current, [path]: image })) }))
    return () => { active = false }
  }, [template])

  const setZoomAround = (requestedPercent: number, clientX?: number, clientY?: number) => {
    const nextPercent = Math.max(0, Math.min(100, Math.round(requestedPercent)))
    if (nextPercent === zoomPercent) return
    const nextZoom = .75 + 2.5 * nextPercent / 100
    const viewport = viewportRef.current
    if (!viewport || clientX === undefined || clientY === undefined) {
      setZoomPercent(nextPercent)
      return
    }
    const rect = viewport.getBoundingClientRect()
    const anchorX = clientX - rect.left
    const anchorY = clientY - rect.top
    const currentOriginX = (viewport.clientWidth - template.width * displayCellSize) / 2 + pan.x
    const currentOriginY = (viewport.clientHeight - template.height * displayCellSize) / 2 + pan.y
    const worldX = (anchorX - currentOriginX) / displayCellSize
    const worldY = (anchorY - currentOriginY) / displayCellSize
    const nextCellSize = fitCellSize * nextZoom
    const nextOriginX = (viewport.clientWidth - template.width * nextCellSize) / 2
    const nextOriginY = (viewport.clientHeight - template.height * nextCellSize) / 2
    setPan({ x: anchorX - nextOriginX - worldX * nextCellSize, y: anchorY - nextOriginY - worldY * nextCellSize })
    setZoomPercent(nextPercent)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !viewportSize.width || !viewportSize.height) return
    if (canvas.width !== viewportPixelWidth) canvas.width = viewportPixelWidth
    if (canvas.height !== viewportPixelHeight) canvas.height = viewportPixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#0b1118'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const patterns = createElementPatterns(context, textures, renderCellSize, originX, originY + template.height * renderCellSize)
    const cells = new Map(template.cells.map((cell) => [`${cell.x}:${cell.y}`, cell]))
    const minCellX = template.minX
    const maxCellY = template.minY + template.height - 1
    const minColumn = Math.max(0, Math.floor(-originX / renderCellSize) - 1)
    const maxColumn = Math.min(template.width - 1, Math.ceil((canvas.width - originX) / renderCellSize) + 1)
    const minRow = Math.max(0, Math.floor(-originY / renderCellSize) - 1)
    const maxRow = Math.min(template.height - 1, Math.ceil((canvas.height - originY) / renderCellSize) + 1)
    const cellAt = (x: number, y: number) => cells.get(`${x}:${y}`)
    const solidElementAt = (x: number, y: number) => {
      const cell = cellAt(x, y)
      const element = cell ? templateVisualElementForName(cell.element) : undefined
      return element?.state === 'solid' ? element : undefined
    }
    const materialOrder = (element: ReturnType<typeof templateVisualElementForName> | undefined) => element ? element.terrainOrder ?? element.hash : Number.NEGATIVE_INFINITY

    for (let row = minRow; row <= maxRow; row++) {
      const worldY = maxCellY - row
      for (let column = minColumn; column <= maxColumn; column++) {
        const worldX = minCellX + column
        const cell = cellAt(worldX, worldY)
        if (!cell) continue
        const element = templateVisualElementForName(cell.element)
        const px = originX + column * renderCellSize
        const py = originY + row * renderCellSize
        if (!element) {
          context.fillStyle = '#3b4146'
          context.fillRect(px, py, renderCellSize, renderCellSize)
          continue
        }
        if (element.state === 'solid') {
          const order = materialOrder(element)
          const connected = (x: number, y: number) => {
            const neighbour = solidElementAt(x, y)
            return Boolean(neighbour && materialOrder(neighbour) >= order)
          }
          const boundary = !connected(worldX - 1, worldY) || !connected(worldX + 1, worldY) || !connected(worldX, worldY - 1) || !connected(worldX, worldY + 1)
          const shape = createTerrainCellPath(connected, worldX, worldY)
          context.save()
          context.translate(px, py)
          context.scale(renderCellSize, renderCellSize)
          context.clip(shape)
          context.setTransform(1, 0, 0, 1, 0, 0)
          context.fillStyle = patterns.get(element.texture ?? '') ?? element.color
          context.fillRect(px, py, renderCellSize, renderCellSize)
          context.fillStyle = 'rgba(0, 0, 0, .16)'
          context.fillRect(px, py, renderCellSize, renderCellSize)
          context.restore()
          if (boundary) {
            const edge = createTerrainBoundaryPath(connected, worldX, worldY)
            context.save()
            context.translate(px, py)
            context.scale(renderCellSize, renderCellSize)
            context.strokeStyle = 'rgba(3, 6, 8, .9)'
            context.lineWidth = Math.max(.8, Math.min(2.4, renderCellSize * .055)) / Math.max(1, renderCellSize)
            context.lineJoin = 'round'
            context.stroke(edge)
            context.restore()
          }
        } else if (element.state === 'gas') {
          context.fillStyle = element.fluidMaterial?.gradientBottom ?? element.color
          context.globalAlpha = .26
          context.fillRect(px, py, renderCellSize, renderCellSize)
          context.globalAlpha = 1
        }
      }
    }

    const drawEntities = (entities: TemplateEntity[], color: string, shape: 'square' | 'circle') => {
      context.save()
      context.fillStyle = color
      context.strokeStyle = 'rgba(4, 8, 12, .9)'
      context.lineWidth = Math.max(1, renderCellSize * .06)
      for (const entity of entities) {
        const column = entity.x - minCellX
        const row = maxCellY - entity.y
        if (column < 0 || row < 0 || column >= template.width || row >= template.height) continue
        const centerX = originX + (column + .5) * renderCellSize
        const centerY = originY + (row + .5) * renderCellSize
        const radius = Math.max(2, renderCellSize * .18)
        context.beginPath()
        if (shape === 'circle') context.arc(centerX, centerY, radius, 0, Math.PI * 2)
        else context.rect(centerX - radius, centerY - radius, radius * 2, radius * 2)
        context.fill()
        context.stroke()
      }
      context.restore()
    }
    drawEntities(template.buildings, '#e0b86d', 'square')
    drawEntities([...template.otherEntities, ...template.elementalOres], '#79d5de', 'circle')
    drawEntities(template.pickupables, '#d891c5', 'circle')
    context.strokeStyle = 'rgba(222, 190, 124, .35)'
    context.lineWidth = Math.max(1, devicePixelRatio)
    context.strokeRect(originX, originY, template.width * renderCellSize, template.height * renderCellSize)
  }, [devicePixelRatio, originX, originY, renderCellSize, template, textures, viewportPixelHeight, viewportPixelWidth, viewportSize.height, viewportSize.width])

  return <div
    ref={viewportRef}
    className={`canvas-frame canvas-viewport template-canvas ${isPanning ? 'is-panning' : ''}`}
    onWheel={(event) => { event.preventDefault(); event.stopPropagation(); setZoomAround(zoomPercent + (event.deltaY < 0 ? 5 : -5), event.clientX, event.clientY) }}
    onPointerDown={(event) => {
      if (event.button !== 0 && event.button !== 1) return
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y }
      setIsPanning(true)
    }}
    onPointerMove={(event) => {
      const pointer = pointerRef.current
      if (!pointer) return
      setPan({ x: pointer.panX + event.clientX - pointer.startX, y: pointer.panY + event.clientY - pointer.startY })
    }}
    onPointerUp={(event) => {
      pointerRef.current = null
      setIsPanning(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }}
    onPointerCancel={() => { pointerRef.current = null; setIsPanning(false) }}
  >
    <canvas ref={canvasRef} className="template-canvas-layer" />
    <div className="canvas-controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" title="缩小模板" aria-label="缩小模板" onClick={() => setZoomAround(zoomPercent - 10)}><Minus size={15} /></button>
      <input type="range" min="0" max="100" step="1" value={zoomPercent} aria-label="模板缩放" onChange={(event) => setZoomAround(Number(event.target.value))} />
      <output>{zoomPercent}</output>
      <button type="button" title="放大模板" aria-label="放大模板" onClick={() => setZoomAround(zoomPercent + 10)}><Plus size={15} /></button>
      <button type="button" className="canvas-reset" title="重置模板视图" aria-label="重置模板视图" onClick={() => { setZoomPercent(50); setPan({ x: 0, y: 0 }) }}>50</button>
    </div>
  </div>
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






function PixiMapCanvas({ save, visibleLayers, overlay, tool, brushSize: _brushSize, viewport, onViewportChange, selectedCell, selection, onCell, onSelectionChange, onShape, onStrokeStart, onStrokeEnd }: { save: ParsedSave; visibleLayers: MapLayerVisibility; overlay: MapOverlay; tool: MapTool; brushSize: number; viewport: MapViewport; onViewportChange: Dispatch<SetStateAction<MapViewport>>; selectedCell: { x: number; y: number } | null; selection: MapSelection | null; previewCells: Map<string, MapPreviewCell>; previewVersion: number; onCell: (x: number, y: number) => void; onSelectionChange: (selection: MapSelection | null) => void; onShape: (start: { x: number; y: number }, end: { x: number; y: number }) => void; onStrokeStart: () => void; onStrokeEnd: () => void }) {
  const tooltipRef = useRef<ReturnType<typeof createOniCellTooltip> | null>(null)
  useEffect(() => {
    const tooltip = createOniCellTooltip(save)
    tooltipRef.current = tooltip
    return () => { tooltip.destroy(); if (tooltipRef.current === tooltip) tooltipRef.current = null }
  }, [save])
  const hostRef = useRef<HTMLDivElement>(null)
  const outlinesRef = useRef<ReturnType<typeof createOniCellOutline> | null>(null)
  const hoverCellRef = useRef<{ x: number; y: number } | null>(null)
  const selectedCellRef = useRef(selectedCell)
  const selectionRef = useRef(selection)
  const draftSelectionRef = useRef<MapSelection | null>(null)
  selectedCellRef.current = selectedCell
  selectionRef.current = selection
  const refreshOutlinesRef = useRef<() => void>(() => {})
  useEffect(() => {
    if (!hostRef.current) return
    const outlines = createOniCellOutline(hostRef.current)
    outlinesRef.current = outlines
    refreshOutlinesRef.current()
    return () => { outlines.destroy(); if (outlinesRef.current === outlines) outlinesRef.current = null }
  }, [])
  useEffect(() => { refreshOutlinesRef.current() }, [selectedCell, selection])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mapLoading, setMapLoading] = useState<string | null>(null)
  const sceneRef = useRef<PixiWorldScene | null>(null)
  const pointerRef = useRef<{ mode: 'pan' | 'select' | 'brush' | 'shape' | 'point'; id: number; startX: number; startY: number; panX: number; panY: number; startCell: { x: number; y: number } | null; lastCell: { x: number; y: number } | null; moved: boolean } | null>(null)
  const cameraRef = useRef(viewport)
  const wheelCommitRef = useRef<number | null>(null)
  const isInteractingRef = useRef(false)
  const buildRef = useRef(0)
  const applyCameraRef = useRef<(next: MapViewport) => void>(() => {})
  const [sceneReady, setSceneReady] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const size = worldSize(save)
  // Camera/world units stay fixed; static raster density follows the visible camera.
  const baseCellSize = 32
  const fitScale = viewportSize.width && viewportSize.height
    ? Math.min(1, viewportSize.width / (size.width * baseCellSize), viewportSize.height / (size.height * baseCellSize))
    : 1
  const mapBackgroundStyle = {
    '--map-space-background': `url("${assetPath('/assets/background/space_bg.png')}")`,
    '--map-starfield-background': `url("${assetPath('/assets/background/starfield.png')}")`,
  } as CSSProperties

  refreshOutlinesRef.current = () => {
    const current = cameraRef.current
    const scale = fitScale * (MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * current.zoomPercent / 100)
    const originX = (viewportSize.width - size.width * baseCellSize * scale) / 2 + current.pan.x
    const originY = (viewportSize.height - size.height * baseCellSize * scale) / 2 + current.pan.y
    const rect = (start: { x: number; y: number } | null, end = start) => start && end
      ? gridSelectionRect({ start, end }, size.height, baseCellSize * scale, originX, originY) : undefined
    const selected = draftSelectionRef.current ?? selectionRef.current
    outlinesRef.current?.update('hover', rect(hoverCellRef.current))
    outlinesRef.current?.update('selected', selected ? undefined : rect(selectedCellRef.current))
    outlinesRef.current?.update('range', selected ? rect(selected.start, selected.end) : undefined)
  }

  const applyCamera = useCallback((next: MapViewport) => {
    cameraRef.current = next
    const nextZoom = MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * next.zoomPercent / 100
    const nextScale = fitScale * nextZoom
    sceneRef.current?.setCamera(
      (viewportSize.width - size.width * baseCellSize * nextScale) / 2 + next.pan.x,
      (viewportSize.height - size.height * baseCellSize * nextScale) / 2 + next.pan.y,
      nextScale,
    )
    refreshOutlinesRef.current()
  }, [fitScale, size.height, size.width, viewportSize.height, viewportSize.width])
  applyCameraRef.current = applyCamera

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scene = new PixiWorldScene()
    let active = true
    void scene.init(canvas).then((initialized) => {
      if (!initialized || !active) return
      sceneRef.current = scene
      setSceneReady(true)
      const host = hostRef.current
      scene.resize(host?.clientWidth ?? 1, host?.clientHeight ?? 1)
      applyCameraRef.current(cameraRef.current)
    })
    return () => { active = false; if (wheelCommitRef.current !== null) window.clearTimeout(wheelCommitRef.current); if (sceneRef.current === scene) sceneRef.current = null; scene.destroy() }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const update = () => setViewportSize({ width: host.clientWidth, height: host.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    sceneRef.current?.resize(viewportSize.width, viewportSize.height)
    applyCamera(viewport)
  }, [applyCamera, viewport, viewportSize.height, viewportSize.width])

  useEffect(() => {
    const scene = sceneRef.current
    if (!sceneReady || !scene || !save.simData || !size.width || !size.height) return
    const generation = ++buildRef.current
    const startedAt = performance.now()
    const metrics = hostRef.current?.dataset
    if (metrics) { delete metrics.overviewMs; delete metrics.textureReadyMs; delete metrics.firstSceneMs }
    setMapLoading('地图概览已显示，正在加载纹理…')
    scene.setChunk({ key: 'loading-overview', layer: 'background', order: -1, canvas: createOniMapOverview(save),
      x: 0, y: 0, width: size.width * baseCellSize, height: size.height * baseCellSize })
    requestAnimationFrame(() => { if (metrics && generation === buildRef.current) metrics.overviewMs = (performance.now() - startedAt).toFixed(1) })
    const renderedKeysByLayer = new Map<OniChunkLayer, Set<string>>()
    let renderer: Awaited<ReturnType<typeof createOniChunkRenderer>> | null = null
    let cursor = 0
    let scheduledFrame = 0
    let sceneKey = '', pendingSceneKey = '', pendingSince = 0, sceneComplete = false
    let animationFrame = 0
    const fluidClock = new OniFluidFrameClock()
    const animateFluids = overlay === 'none' && (visibleLayers.gas || visibleLayers.liquid)
    const updateFluids = (now: number) => {
      if (generation !== buildRef.current || !renderer) return
      animationFrame = window.requestAnimationFrame(updateFluids)
      if (document.hidden || isInteractingRef.current || !fluidClock.shouldRender(now)) return
      const viewport = fluidViewportForCamera(scene.visibleWorldRect(), size.width, size.height, baseCellSize, window.devicePixelRatio || 1)
      if (!viewport) return
      const start = performance.now()
      const chunk = renderer.renderChunk(viewport.x, viewport.row, viewport.widthCells, viewport.heightCells,
        { fluidsOnly: true, cellSize: viewport.cellSize, timeSeconds: now / 1000 })
      scene.beginBatch()
      for (const layer of ['gas', 'liquid'] as const) {
        const canvas = chunk.layers[layer]
        if (canvas) scene.setChunk({ key: 'fluid-animation', layer, canvas, x: viewport.x * baseCellSize, y: viewport.row * baseCellSize,
          width: viewport.widthCells * baseCellSize, height: viewport.heightCells * baseCellSize, mipmaps: false })
        scene.removeMissing(canvas ? new Set(['fluid-animation']) : new Set(), layer)
      }
      scene.endBatch(true)
      fluidClock.recordCost(performance.now() - start)
    }
    let tasks: Array<{ distance: number; x: number; row: number; widthCells: number; heightCells: number; key: string; cellSize: number }> = []
    const scheduleNext = () => {
      scheduledFrame = window.requestAnimationFrame(buildNext)
    }
    const buildNext = (now: number) => {
      if (generation !== buildRef.current || !renderer) return
      if (document.hidden || isInteractingRef.current) { scheduleNext(); return }
      const view = sceneViewportForCamera(scene.visibleWorldRect(), size.width, size.height, baseCellSize, window.devicePixelRatio || 1)
      const viewKey = view ? `${view.key}:${renderer.revision}` : ''
      if (view && viewKey !== sceneKey) {
        if (pendingSceneKey !== viewKey) { pendingSceneKey = viewKey; pendingSince = now }
        if (!sceneKey || now - pendingSince >= 120) {
          sceneKey = viewKey; sceneComplete = false; cursor = 0; tasks = []; renderedKeysByLayer.clear()
          void renderer.prepareViewport(view.x, view.row, view.right - view.x, view.bottom - view.row, view.cellSize >= 8).catch(cause => console.error('地图细节加载失败。', cause))
          for (let row = view.row; row < view.bottom; row += view.tile) for (let x = view.x; x < view.right; x += view.tile) {
            tasks.push({ x, row, widthCells: Math.min(view.tile, size.width - x), heightCells: Math.min(view.tile, size.height - row),
              key: `${x}:${row}`, cellSize: view.cellSize, distance: Math.hypot(x - (view.x + view.right) / 2, row - (view.row + view.bottom) / 2) })
          }
          tasks.sort((a, b) => a.distance - b.distance)
        }
      }
      if (cursor < tasks.length) {
        const task = tasks[cursor++]
        const chunk = renderer.renderChunk(task.x, task.row, task.widthCells, task.heightCells, { skipFluids: animateFluids, cellSize: task.cellSize })
        scene.beginBatch()
        for (const [layer, canvas] of Object.entries(chunk.layers) as Array<[OniChunkLayer, HTMLCanvasElement | undefined]>) {
          if (!canvas || (animateFluids && (layer === 'gas' || layer === 'liquid'))) continue
          let renderedKeys = renderedKeysByLayer.get(layer)
          if (!renderedKeys) {
            renderedKeys = new Set<string>()
            renderedKeysByLayer.set(layer, renderedKeys)
          }
          renderedKeys.add(task.key)
          scene.setChunk({ key: task.key, x: task.x * baseCellSize, y: task.row * baseCellSize,
            width: task.widthCells * baseCellSize, height: task.heightCells * baseCellSize, canvas, layer })
        }
        scene.endBatch()
      }
      if (!sceneComplete && cursor === tasks.length) {
        sceneComplete = true
        setMapLoading(null)
        if (metrics && !metrics.firstSceneMs) metrics.firstSceneMs = (performance.now() - startedAt).toFixed(1)
        const allLayers: readonly OniChunkLayer[] = ONI_CHUNK_LAYERS
        for (const layer of allLayers) {
          if (animateFluids && (layer === 'gas' || layer === 'liquid')) continue
          scene.removeMissing(renderedKeysByLayer.get(layer) ?? new Set<string>(), layer)
        }
      }
      scheduleNext()
    }
    void createOniChunkRenderer(save, visibleLayers, overlay, baseCellSize, () => generation !== buildRef.current).then((prepared) => {
      if (generation !== buildRef.current) { prepared.destroy(); return }
      renderer = prepared
      if (metrics) metrics.textureReadyMs = (performance.now() - startedAt).toFixed(1)
      setMapLoading('正在补齐地图画面…')
      if (animateFluids) animationFrame = window.requestAnimationFrame(updateFluids)
      scheduleNext()
    }).catch((cause) => {
      if (generation === buildRef.current && !(cause instanceof DOMException && cause.name === 'AbortError')) { setMapLoading('地图概览已显示，纹理加载失败，请稍后重新进入地图。'); console.error('ONI 地图分块准备失败。', cause) }
    })
    return () => {
      buildRef.current += 1
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame)
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      renderer?.destroy()
    }
  }, [overlay, save, sceneReady, size.height, size.width, visibleLayers])

  const pointToCell = (clientX: number, clientY: number) => {
    const host = hostRef.current
    const liveZoom = MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * cameraRef.current.zoomPercent / 100
    const liveScale = fitScale * liveZoom
    if (!host || liveScale <= 0) return null
    const rect = host.getBoundingClientRect()
    const originX = (viewportSize.width - size.width * baseCellSize * liveScale) / 2 + cameraRef.current.pan.x
    const originY = (viewportSize.height - size.height * baseCellSize * liveScale) / 2 + cameraRef.current.pan.y
    const x = Math.floor((clientX - rect.left - originX) / (baseCellSize * liveScale))
    const row = Math.floor((clientY - rect.top - originY) / (baseCellSize * liveScale))
    if (x < 0 || row < 0 || x >= size.width || row >= size.height) return null
    return { x, y: size.height - 1 - row }
  }

  return <div ref={hostRef} style={mapBackgroundStyle} className="canvas-frame canvas-viewport pixi-map-viewport"
    onWheel={(event) => {
      event.preventDefault()
      tooltipRef.current?.hide()
      hoverCellRef.current = null
      refreshOutlinesRef.current()
      const current = cameraRef.current
      const nextPercent = Math.max(0, Math.min(100, current.zoomPercent + (event.deltaY < 0 ? 5 : -5)))
      const host = hostRef.current
      if (!host || nextPercent === current.zoomPercent) return
      const rect = host.getBoundingClientRect()
      const anchorX = event.clientX - rect.left
      const anchorY = event.clientY - rect.top
      const oldScale = fitScale * (MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * current.zoomPercent / 100)
      const nextScale = fitScale * (MAP_ZOOM_MIN + (MAP_ZOOM_MAX - MAP_ZOOM_MIN) * nextPercent / 100)
      const oldOriginX = (viewportSize.width - size.width * baseCellSize * oldScale) / 2 + current.pan.x
      const oldOriginY = (viewportSize.height - size.height * baseCellSize * oldScale) / 2 + current.pan.y
      const worldX = (anchorX - oldOriginX) / oldScale
      const worldY = (anchorY - oldOriginY) / oldScale
      const next = { zoomPercent: nextPercent, pan: {
        x: anchorX - (viewportSize.width - size.width * baseCellSize * nextScale) / 2 - worldX * nextScale,
        y: anchorY - (viewportSize.height - size.height * baseCellSize * nextScale) / 2 - worldY * nextScale,
      }}
      applyCamera(next)
      if (wheelCommitRef.current !== null) window.clearTimeout(wheelCommitRef.current)
      wheelCommitRef.current = window.setTimeout(() => {
        wheelCommitRef.current = null
        onViewportChange(cameraRef.current)
      }, 120)
    }}
    onPointerDown={(event) => {
      if (event.button !== 0 && event.button !== 1) return
      tooltipRef.current?.hide()
      hoverCellRef.current = null
      refreshOutlinesRef.current()
      event.currentTarget.setPointerCapture(event.pointerId)
      isInteractingRef.current = true
      const mode = event.button === 1 || tool === 'move' ? 'pan' : tool === 'inspect' ? 'select' : tool === 'paint' || tool === 'erase' ? 'brush' : tool === 'rectangle' || tool === 'line' ? 'shape' : 'point'
      const cell = pointToCell(event.clientX, event.clientY)
      pointerRef.current = { mode, id: event.pointerId, startX: event.clientX, startY: event.clientY, panX: viewport.pan.x, panY: viewport.pan.y, startCell: cell, lastCell: cell, moved: false }
      if (mode === 'brush') { onStrokeStart(); if (cell) onCell(cell.x, cell.y) }
      else if (mode === 'shape') { onStrokeStart(); if (cell) onShape(cell, cell) }
      else if (mode === 'point' && cell) onCell(cell.x, cell.y)
    }}
    onPointerLeave={() => { tooltipRef.current?.hide(); hoverCellRef.current = null; refreshOutlinesRef.current() }}
    onPointerMove={(event) => {
      const pointer = pointerRef.current
      const cell = pointToCell(event.clientX, event.clientY)
      if (!pointer) {
        hoverCellRef.current = event.pointerType === 'touch' ? null : cell
        refreshOutlinesRef.current()
        if (cell && event.pointerType !== 'touch') tooltipRef.current?.show(cell.x, cell.y, event.clientX, event.clientY)
        else tooltipRef.current?.hide()
        return
      }
      tooltipRef.current?.hide()
      if (pointer.mode === 'pan') {
        const dx = event.clientX - pointer.startX; const dy = event.clientY - pointer.startY
        pointer.moved ||= Math.abs(dx) > 2 || Math.abs(dy) > 2
        if (pointer.moved) applyCamera({ zoomPercent: cameraRef.current.zoomPercent, pan: { x: pointer.panX + dx, y: pointer.panY + dy } })
      } else if (pointer.mode === 'brush' && cell && (cell.x !== pointer.lastCell?.x || cell.y !== pointer.lastCell?.y)) {
        pointer.lastCell = cell; onCell(cell.x, cell.y)
      } else if (pointer.mode === 'shape' && cell && pointer.startCell) onShape(pointer.startCell, cell)
      else if (pointer.mode === 'select') {
        const dx = event.clientX - pointer.startX; const dy = event.clientY - pointer.startY
        pointer.moved ||= Math.abs(dx) > 3 || Math.abs(dy) > 3
        if (pointer.moved && pointer.startCell && cell) {
          draftSelectionRef.current = { start: pointer.startCell, end: cell }
          refreshOutlinesRef.current()
        }
      }
    }}
    onPointerUp={(event) => {
      const pointer = pointerRef.current
      if (!pointer) return
      if (pointer.mode === 'pan') {
        const next = { zoomPercent: cameraRef.current.zoomPercent, pan: { x: pointer.panX + event.clientX - pointer.startX, y: pointer.panY + event.clientY - pointer.startY } }
        applyCamera(next); onViewportChange(next)
      } else if (pointer.mode === 'select') {
        const cell = pointToCell(event.clientX, event.clientY)
        if (pointer.startCell && cell && pointer.moved) onSelectionChange({ start: pointer.startCell, end: cell })
        else if (cell) onCell(cell.x, cell.y)
      }
      if (pointer.mode === 'brush' || pointer.mode === 'shape') onStrokeEnd()
      pointerRef.current = null
      draftSelectionRef.current = null
      refreshOutlinesRef.current()
      isInteractingRef.current = false
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }}
    onPointerCancel={() => {
      tooltipRef.current?.hide()
      const pointer = pointerRef.current
      if (pointer?.mode === 'brush' || pointer?.mode === 'shape') onStrokeEnd()
      pointerRef.current = null
      draftSelectionRef.current = null
      refreshOutlinesRef.current()
      isInteractingRef.current = false
    }}
  ><canvas ref={canvasRef} className="pixi-map-canvas" />{mapLoading && <div className="map-loading-status" role="status">{mapLoading}</div>}</div>
}

function DupesView({ save, updateSave, onOpenObject }: { save: ParsedSave; updateSave: (update: (save: ParsedSave) => void) => void; onOpenObject: (index: number) => void }) {
  const group = groupByTag(save, 'Minion')
  const rows = groupRows(group)
  const [selected, setSelected] = useState(0)
  const [minionKanimAssets, setMinionKanimAssets] = useState<MinionKanimAssets | null>(null)
  const minionWearableNames = useMemo(() => saveMinionWearableAnimNames(save), [save])
  const active = rows[selected]
  useEffect(() => {
    let active = true
    void loadMinionKanimAssets(minionWearableNames).then((assets) => { if (active) setMinionKanimAssets(assets) }).catch(() => {})
    return () => { active = false }
  }, [minionWearableNames])
  return (
    <div className="view-stack">
      <div className="view-intro"><div><p>已解析的殖民者实例</p><strong>{rows.length} 名复制人</strong></div><button className="button button-quiet" type="button" onClick={() => onOpenObject(selected)}><Boxes size={15} />打开对象详情</button></div>
      <section className="surface dupes-layout">
        <div className="dupe-list">
          <div className="list-head"><span>复制人</span><span>位置</span></div>
          {rows.map((row) => <button key={row.index} className={`dupe-row ${active?.index === row.index ? 'selected' : ''}`} type="button" onClick={() => setSelected(row.index)}><MinionAvatar instance={row.instance} assets={minionKanimAssets} fallback={row.name.slice(0, 1)} /><span className="dupe-name"><strong>{row.name}</strong><small>Minion #{row.index + 1}</small></span><span className="dupe-pos">{formatNumber(row.position.x, 1)}, {formatNumber(row.position.y, 1)}</span><ChevronRight size={15} /></button>)}
        </div>
        {active && <DupeInspector instance={active.instance} updateSave={updateSave} />}
      </section>
    </div>
  )
}

function MinionAvatar({ instance, assets, fallback }: { instance: SavedObjectInstance; assets: MinionKanimAssets | null; fallback: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !assets) return
    const ratio = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.round(64 * ratio)
    canvas.height = Math.round(64 * ratio)
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    drawMinionKanim(context, assets, minionAccessoryGuids(instance), minionWearableAnimNames(instance), 28 * ratio, 32 * ratio, 53 * ratio, minionFacesLeft(instance))
  }, [assets, instance])
  return <span className="dupe-avatar" data-kanim={assets ? 'ready' : 'loading'}>
    {assets ? <canvas ref={canvasRef} aria-hidden="true" /> : fallback}
  </span>
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
