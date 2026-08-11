const MINION_KANIM_MANIFEST = '/assets/kanim/minion/idle_default.json'
const MINION_WEARABLE_CATALOG = '/assets/kanim/minion/wearables/catalog.json'

type KAnimBuildFrame = {
  source: number
  image: number
  pivotX: number
  pivotY: number
  pivotWidth: number
  pivotHeight: number
  uv: [number, number, number, number]
}

type KAnimFrameElement = {
  symbol: number
  sourceFrame: number
  multAlpha: number
  colour: [number, number, number]
  matrix: [number, number, number, number, number, number]
  order: number
}

type KAnimPackage = {
  atlas: string
  symbols: Record<string, KAnimBuildFrame[]>
  symbolNames?: Record<string, string>
}

type WearableCatalog = {
  packages: Record<string, { atlas: string; metadata: string }>
}

type MinionKanimManifest = {
  source: string
  cellUnits: number
  frame: KAnimFrameElement[]
  packages: Record<string, KAnimPackage>
}

export type MinionKanimAssets = {
  manifest: MinionKanimManifest
  atlases: Record<string, HTMLImageElement>
  wearables: Record<string, KAnimPackage>
}

type SymbolSource = {
  packageName: string
  symbolHash: number
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load KAnim atlas ${path}`))
    image.src = assetUrl(path)
  })
}

let baseAssetsPromise: Promise<MinionKanimAssets> | undefined
let wearableCatalogPromise: Promise<WearableCatalog> | undefined
const wearablePackagePromises = new Map<string, Promise<{ definition: KAnimPackage; atlas: HTMLImageElement }>>()

async function loadBaseMinionKanimAssets(): Promise<MinionKanimAssets> {
  const response = await fetch(assetUrl(MINION_KANIM_MANIFEST))
  if (!response.ok) throw new Error(`Unable to load duplicant KAnim metadata (${response.status})`)
  const manifest = await response.json() as MinionKanimManifest
  const atlases = Object.fromEntries(await Promise.all(Object.entries(manifest.packages).map(async ([name, definition]) => [
    name,
    await loadImage(definition.atlas),
  ])))
  return { manifest, atlases, wearables: {} }
}

async function wearableCatalog(): Promise<WearableCatalog> {
  const response = await fetch(assetUrl(MINION_WEARABLE_CATALOG))
  if (!response.ok) throw new Error(`Unable to load duplicant wearable catalog (${response.status})`)
  return response.json() as Promise<WearableCatalog>
}

async function loadWearablePackage(name: string, catalog: WearableCatalog): Promise<{ definition: KAnimPackage; atlas: HTMLImageElement }> {
  const cached = wearablePackagePromises.get(name)
  if (cached) return cached
  const entry = catalog.packages[name]
  if (!entry) throw new Error(`Unknown duplicant wearable KAnim ${name}`)
  const promise = Promise.all([
    fetch(assetUrl(entry.metadata)).then((response) => {
      if (!response.ok) throw new Error(`Unable to load ${name} KAnim metadata (${response.status})`)
      return response.json() as Promise<Pick<KAnimPackage, 'symbols' | 'symbolNames'>>
    }),
    loadImage(entry.atlas),
  ]).then(([metadata, atlas]) => ({ definition: { atlas: entry.atlas, ...metadata }, atlas }))
  wearablePackagePromises.set(name, promise)
  return promise
}

export async function loadMinionKanimAssets(wearableNames: readonly string[] = []): Promise<MinionKanimAssets> {
  baseAssetsPromise ??= loadBaseMinionKanimAssets()
  const base = await baseAssetsPromise
  const names = [...new Set(wearableNames)].filter(Boolean)
  if (!names.length) return { ...base, atlases: { ...base.atlases }, wearables: {} }
  wearableCatalogPromise ??= wearableCatalog()
  const catalog = await wearableCatalogPromise
  const loaded = await Promise.all(names.filter((name) => catalog.packages[name]).map(async (name) => [name, await loadWearablePackage(name, catalog)] as const))
  return {
    ...base,
    atlases: { ...base.atlases, ...Object.fromEntries(loaded.map(([name, value]) => [name, value.atlas])) },
    wearables: Object.fromEntries(loaded.map(([name, value]) => [name, value.definition])),
  }
}

/** Exact Hash.SDBMLower implementation used by KAnimHashedString. */
export function oniSdbmLower(value: string): number {
  let hash = 0 >>> 0
  for (const character of value.toLowerCase()) {
    const code = character.charCodeAt(0)
    hash = (code + (hash << 6) + (hash << 16) - hash) >>> 0
  }
  return hash | 0
}

function accessoryPackage(symbol: string): string {
  if (/^(?:eyes|headshape|mouth|headfx)_/i.test(symbol)) return 'head_swap'
  if (/^(?:hair|hat_hair)_/i.test(symbol)) return 'hair_swap'
  if (/^hat_/i.test(symbol)) return 'hat_swap'
  if (/^(?:torso|arm_sleeve|arm_lower_sleeve|arm_lower|arm_upper|leg_skin)_/i.test(symbol)) return 'body_swap'
  return 'body_comp_default'
}

function accessoryTarget(symbol: string): string | undefined {
  if (/^hat_hair_/i.test(symbol)) return 'snapTo_hat_hair'
  if (/^hat_/i.test(symbol)) return 'snapTo_hat'
  if (/^eyes_/i.test(symbol)) return 'snapTo_eyes'
  if (/^hair_/i.test(symbol)) return 'snapTo_hair'
  if (/^headshape_/i.test(symbol)) return 'snapTo_headshape'
  if (/^mouth_/i.test(symbol)) return 'snapTo_mouth'
  if (/^headfx_/i.test(symbol)) return 'snapTo_headfx'
  return symbol.replace(/_\d+$/i, '')
}

function accessoryComposition(accessories: readonly string[]) {
  const overrides = new Map<number, SymbolSource>()
  const symbols = accessories.map((guid) => guid.split('.').at(-1)?.trim()).filter((symbol): symbol is string => Boolean(symbol))
  const hasHat = symbols.some((symbol) => /^hat_(?!hair_)/i.test(symbol))
  for (const symbol of symbols) {
    if (/^hat_hair_/i.test(symbol) && !hasHat) continue
    if (!symbol) continue
    const target = accessoryTarget(symbol)
    if (!target) continue
    overrides.set(oniSdbmLower(target), {
      packageName: accessoryPackage(symbol),
      symbolHash: oniSdbmLower(symbol),
    })
  }
  // BaseMinionConfig.ConfigureSymbols hides these attachment locators. They
  // are geometry in the atlas, but are only used as runtime snap points.
  const hidden = new Set([
    'snapTo_hat',
    'snapTo_hat_hair',
    'snapTo_headfx',
    'snapTo_chest',
    'snapTo_neck',
    'snapTo_goggles',
    'snapTo_pivot',
    'snapTo_rgtHand',
    'necklace',
    'skirt',
  ].map(oniSdbmLower))
  if (hasHat) hidden.add(oniSdbmLower('snapTo_hair'))
  return { overrides, hidden, hasHat }
}

function wearableComposition(assets: MinionKanimAssets, wearableNames: readonly string[]) {
  const overrides = new Map<number, SymbolSource>()
  const symbolNames = new Set<string>()
  let loadedAny = false
  for (const packageName of wearableNames) {
    const definition = assets.wearables[packageName]
    if (!definition) continue
    loadedAny = true
    for (const symbolHash of Object.keys(definition.symbols)) {
      overrides.set(Number(symbolHash), { packageName, symbolHash: Number(symbolHash) })
      const name = definition.symbolNames?.[symbolHash]
      if (name) symbolNames.add(name.toLowerCase())
    }
    // Skirts include a specially cropped torso symbol which Klei redirects to
    // the regular torso target in WearableAccessorizer.SkirtHACK.
    const cropped = Object.entries(definition.symbolNames ?? {}).find(([, name]) => name.toLowerCase().endsWith('_cropped'))
    if (cropped) overrides.set(oniSdbmLower('torso'), { packageName, symbolHash: Number(cropped[0]) })
  }
  if (!loadedAny) return { overrides, hidden: new Set<number>() }
  const hasTop = [...symbolNames].some((name) => name === 'torso' || name === 'arm_sleeve' || name === 'arm_lower_sleeve')
  const hasBottom = [...symbolNames].some((name) => name === 'leg' || name === 'pelvis' || name === 'skirt')
  const hidden = new Set<number>()
  if (!symbolNames.has('belt')) hidden.add(oniSdbmLower('belt'))
  if (!symbolNames.has('necklace')) hidden.add(oniSdbmLower('necklace'))
  if (hasTop && !symbolNames.has('arm_lower')) hidden.add(oniSdbmLower('arm_lower'))
  if (hasTop && !symbolNames.has('arm_upper')) hidden.add(oniSdbmLower('arm_upper'))
  if (hasBottom && !symbolNames.has('leg')) hidden.add(oniSdbmLower('leg'))
  if (symbolNames.has('skirt')) hidden.add(oniSdbmLower('leg'))
  return { overrides, hidden }
}

function buildFrameFor(frames: readonly KAnimBuildFrame[] | undefined, sourceFrame: number): KAnimBuildFrame | undefined {
  return frames?.find((frame) => frame.source === sourceFrame) ?? frames?.[sourceFrame]
}

export function drawMinionKanim(
  context: CanvasRenderingContext2D,
  assets: MinionKanimAssets,
  accessories: readonly string[],
  wearableNames: readonly string[],
  cellSize: number,
  anchorX: number,
  anchorY: number,
  facingLeft: boolean,
): void {
  const { manifest, atlases } = assets
  const base = manifest.packages.body_comp_default
  const accessory = accessoryComposition(accessories)
  const overrides = accessory.overrides
  const wearable = wearableComposition(assets, wearableNames)
  for (const [target, source] of wearable.overrides) overrides.set(target, source)
  const worldScale = cellSize / manifest.cellUnits
  const facingScale = facingLeft ? -1 : 1
  context.save()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  // KAnim's draw list is front-to-back. Canvas composites back-to-front.
  for (const element of [...manifest.frame].reverse()) {
    const override = overrides.get(element.symbol)
    // Accessorizer.UpdateHairBasedOnHat hides the regular hair target while
    // a hat is equipped, even though the accessory override still exists.
    const hiddenByHat = accessory.hasHat && element.symbol === oniSdbmLower('snapTo_hair')
    // A symbol override replaces the hidden base locator in KAnim. Keep the
    // replacement visible while suppressing the locator itself.
    if (hiddenByHat || (accessory.hidden.has(element.symbol) && !override) || wearable.hidden.has(element.symbol)) continue
    const packageName = override?.packageName ?? 'body_comp_default'
    const definition = assets.wearables[packageName] ?? manifest.packages[packageName] ?? base
    const atlas = atlases[packageName] ?? atlases.body_comp_default
    const symbolHash = override?.symbolHash ?? element.symbol
    const build = buildFrameFor(definition?.symbols[String(symbolHash)], element.sourceFrame)
      ?? buildFrameFor(base?.symbols[String(element.symbol)], element.sourceFrame)
    if (!atlas?.naturalWidth || !build || element.multAlpha <= 0) continue
    const [ux1, uy1, ux2, uy2] = build.uv
    const sourceX = Math.max(0, Math.floor(ux1 * atlas.naturalWidth))
    const sourceY = Math.max(0, Math.floor(uy1 * atlas.naturalHeight))
    const sourceRight = Math.min(atlas.naturalWidth, Math.max(sourceX + 1, Math.floor(ux2 * atlas.naturalWidth)))
    const sourceBottom = Math.min(atlas.naturalHeight, Math.max(sourceY + 1, Math.floor(uy2 * atlas.naturalHeight)))
    const sourceWidth = sourceRight - sourceX
    const sourceHeight = sourceBottom - sourceY
    const [m00, m10, m01, m11, m02, m12] = element.matrix
    const a = m00 * .5
    const b = m10 * .5
    const c = m01 * .5
    const d = m11 * .5
    const e = build.pivotX * m00 + build.pivotY * m01 + m02
    const f = build.pivotX * m10 + build.pivotY * m11 + m12
    const localScaleX = build.pivotWidth * 2 / sourceWidth
    const localScaleY = build.pivotHeight * 2 / sourceHeight
    context.setTransform(
      facingScale * a * localScaleX * worldScale,
      b * localScaleX * worldScale,
      facingScale * c * localScaleY * worldScale,
      d * localScaleY * worldScale,
      anchorX + facingScale * (e - a * build.pivotWidth - c * build.pivotHeight) * worldScale,
      anchorY + (f - b * build.pivotWidth - d * build.pivotHeight) * worldScale,
    )
    context.globalAlpha = Math.max(0, Math.min(1, element.multAlpha))
    context.drawImage(atlas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight)
  }
  context.restore()
}
