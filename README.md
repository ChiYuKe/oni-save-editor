# ONI Save Lab

一个在浏览器本地运行的《缺氧》存档编辑器。存档不会上传服务器，解析和导出都在当前浏览器完成。

在线地址：https://chiyuke.github.io/oni-save-editor/

## 当前功能

- 读取和导出 ONI `.sav` 文件，保留 KSerialization 模板目录与未知组件的原始字节。
- 总览：周期、复制人、世界尺寸、对象分组和基础 `SaveGame` 设置。
- 地图：按游戏的 `SceneLayer` 顺序渲染群落背景、自然地形、气体/液体、砖块、管线、建筑、喷泉和复制人，并支持图层开关。
- 地形渲染：复现 `GroundRenderer` 的四角采样、`Substance.idx` 材质叠放、群落蒙版变体和 `Substance` 色相混合；支持 WebGL2 加速与 Canvas2D 回退。
- 地图编辑：查看温度、质量、病菌、可见性、可生成性和伤害覆盖层，可使用画笔、橡皮、吸管、填充、矩形和直线修改模拟格。
- 复制人：查看名称、坐标、体温和组件数量，支持修改名称与世界坐标。
- 对象：按 SaveManager 分组检索实例，查看组件并编辑已解析的标量字段。

## 开发

快速启动（Windows）：双击根目录的 `start.bat`。脚本会自动检查 Node.js、在首次运行时安装依赖、启动 Vite 开发服务器并在服务就绪后打开浏览器。

```bat
start.bat          :: 默认端口 5173
start.bat 5174     :: 端口被占用时换一个
set NO_BROWSER=1   :: 不自动打开浏览器
```

手动启动：

```bash
npm install
npm run dev
```

生产构建和检查：

```bash
npm run build
npm run lint
```

推送到 `main` 分支后，GitHub Actions 会自动构建并发布到 GitHub Pages。

## 着色器

WebGL2 渲染的着色器移植自 Unity 工程 `E:\Unity\NOI1018\ExportedProject` 的 Klei 着色器：

| 着色器 | 来源文件 | 移植实现 |
| --- | --- | --- |
| `Klei/Substance` | `Assets/Shaders/World/Resources/substance.shader` | `src/lib/oniSubstanceWebgl.ts` |
| `Klei/GasTest` | `Assets/Shaders/World/Resources/gastest.shader` | `src/lib/oniGasWebgl.ts` |
| `Klei/Liquid` | `Assets/Shaders/World/Resources/liquid.shader` | `src/lib/oniLiquidWebgl.ts` |

着色器用到的所有常数（`_SubstanceParameters`、`_DigMapMapParameters`、`GasTest.mat` 的材质参数、`liquid.shader` 的属性默认值等）集中在 `src/lib/oniShaders.ts`，每一项都标注了它在 Unity 工程中的出处；共享的 GLSL 工具函数在 `src/lib/oniShaderCommon.ts`。Unity 工程改动后只需更新这两个文件，渲染器里不要再直接写裸数字。

已知的移植限制：`_ExposedToSunlightTex`、`_LightBufferTex` 是游戏运行时的临时渲染纹理，存档无法还原，因此光照按「未受光」处理；`GasTest` 的流动相位同样来自运行时 RT，固定为决定性初值。

## 存档兼容性

解析器使用存档自身携带的模板目录驱动，不依赖固定的游戏程序集类型列表。未知组件和模拟区会原样保留；导出前建议先备份原存档，并在游戏中确认修改后的文件。

地图会读取 SIMSAVE 网格和 SaveManager 对象进行渲染；地形格可直接编辑，建筑与管线目前以只读方式显示。WebGL2 不可用或游戏材质缺失时会自动切换到 Canvas2D 渲染。

## Unity 渲染一致性检查

当前地图预览统一使用 `src/lib/oniRenderLayers.ts` 的顺序：群落背景 → 气体 → 地形后方对象（建筑、管线、复制人等）→ 液体 → 自然地形 → 地形前方对象。世界画面缩放使用线性采样，编辑器覆盖层仍可单独选择最近邻采样。

已按本地 Unity 工程核对并修正以下移植差异：

- `GasTest` 未受光颜色使用 `sqrt(gas² * DarkenTintBackground)`，透明度交由 Canvas2D 合成一次。
- 自然地形 `GroundRenderer.InitAlphaMaterial` 设置 `_IsBackwallEdge = 0`；边缘亮度使用 `intensity + pow((1 - solidCoverage) * edgeIntensity, power)`。太阳光通过独立运行时输入参与，不能直接额外加上 `directSunlightScale`。
- 地形在 WebGL 中累积预乘颜色与正确的覆盖率后交给 Canvas2D，保留半透明蒙版边缘。
- HSL 转换对 RGB 各通道的色相偏移分别进行环绕，避免红色、蓝色及邻近色相失真。
- `WorldZoneTex` 保留 Unity 的 RGB24 格式和隐式 alpha=1，未添加不存在的太空 alpha 数据。

运行 `npm run dev` 后打开 [渲染回归检查](http://localhost:5173/tools/render-parity-fixture.html)。该页面直接编译项目中的 WebGL2 着色器，检查 23 项 GPU 像素及排序结果；正常结果为 `PASS 23/23`。液体另可使用 [液体检查页](http://localhost:5173/tools/liquid-webgl-fixture.html)。

这些检查验证已移植的计算和图层合成，不代表完整游戏画面已达到逐像素一致。太阳光、动态灯光缓冲、气体流动相位，以及液体折射依赖的独立 MRT 场景输入仍存在运行时数据差异。若要验收完整 1:1 画面，应使用同一存档、同一视角、同一时间的 Unity/游戏截图和编辑器相同视口截图，通过 `npm run compare:oni-render -- reference.png actual.png --diff diff.png` 比较。

### 群落背景与天然背墙

- `src/lib/oniBiomeWebgl.ts` 移植 `Klei/BackWallArray` 的四角群落索引采样：分别采样纹理并预乘 alpha 后混合，保持太空边缘裁剪和 `BackgroundUVScale=1.1`，移除旧的固定 0.84 透明度。
- 天然背墙读取 SIMSAVE 背墙元素并使用真实材质与地形蒙版；`_IsBackwallEdge=1` 分支读取前景格遮挡和背墙覆盖率，不再统一填充棕色矩形。背墙材质缺失时仍可使用 Canvas 回退。
- 地形重复贴图使用多级缩小采样与三线性过滤；连续 UV 避免重复边界处出现错误采样级别。地图分块在缩放时也生成相应缩小级别；编辑器覆盖层保留独立采样选项。
- `tools/world-render-fixture.html` 固定在测试存档打印舱附近 40×30 格，可分别查看完整场景、自然地形及群落背景与天然背墙，也可保存 PNG。该页需使用设置了 `ONI_VISUAL_FIXTURE` 的本地开发服务器。

23 项检查验证计算与数据通路；完整视觉验收仍需同一存档、同一视角的 Unity/游戏参考图。金属材质的 SHINY 高光、运行时阳光与完整后处理尚未覆盖，不能将这些检查结果视为游戏画面一致性验收。

元素表现以本地化元素表为基础，并从 SubstanceHookup 清单补全新元素的状态、材质和流体属性，避免 Mucin 等 DLC 元素误入未知元素色块回退。

## SIMSAVE 格子字段与流体修复

SIMSAVE v14/v15 的磁盘格子记录共 16 字节，与 Unity 进程里的 `Sim.Cell` 内存布局不同：

| 偏移 | 字段 | 处理 |
| --- | --- | --- |
| 0–3 | 完整有符号 SimHash | 读取与替换均使用完整 32 位 ID；低 16 位只用于现有界面索引 |
| 4–7 | 温度，K | 界面显示时减去 273.15；写回对应 4 字节 |
| 8–11 | 质量，kg | 写回对应 4 字节 |
| 12–15 | 尚未解释的附加数据 | 原始字节保留，包括非标准 NaN 位模式 |

旧代码误用了运行时内存布局，把质量读成温度、附加数据读成质量，并将元素 ID 的高字节误认为属性/绝缘。这同时影响温度显示、气体浓度、液位和沸腾/凝固表现。现在移除了这些伪属性展示与画笔写入；真空不显示无物理意义的 -273.15°C。

液体纹理恢复 `LightingSettings.LiquidMaxMass=1000kg` 和 Substance 原始颜色；不同分块共用同一采样时间，Unity `_Time` 按 `(t/20,t,2t,3t)` 传入。液体折射读取背景、气体和后方对象组成的场景颜色，液体按预乘 alpha 独立合成，不再用气体透明度擦除液体。

运行 `npm run check:sim` 验证 v14/v15 字段、字节写入隔离、未知字段保留及流体纹理输入。传入存档文件或目录可在内存中逐个检查读取、修改、导出和重读：`npm run check:sim -- "存档目录"`，不会覆盖原文件。

本轮本机验证：15 项独立格式检查，以及 38 个 v14/v15 存档、合计 8,647,864 个格子的检查与修改后导出重读均通过。该结果验证数据通路，不等于完整游戏画面的视觉验收。

使用修复版时应重新载入原始存档。旧版已经编辑并导出的格子可能写错字段，修复版不会按猜测自动改写这些历史数据。

液体进一步使用 `oniLiquidOriginal.glsl` 中的原始片元计算，只适配 WebGL 语法、属性纹理的纵向坐标及 Canvas 预乘 alpha。`MRT0_Copy` 与 `MRT1_Copy` 不再绑定同一张颜色图：前者为场景颜色，后者为中性 RGB 的覆盖蒙版。完整游戏的材质专用法线/高光蒙版仍未复现。

`Substance.SubstanceTexture.None=0` 在材质属性纹理中保持 0，普通水不再被错误映射到第 13 类纹理。`tools/liquid-data-fixture.html` 的 5 项实际 GPU 检查覆盖常温满格水、非液体区透明、独立场景颜色及覆盖率不受场景颜色影响。


## 静态站点地图加载

地图先加载地形、背景与流体所需资源，再异步补齐建筑贴图；细节到达后会重绘当前视口和液体折射场景。贴图对象、地形蒙版和建筑清单在同页内复用，解码图像缓存设有容量上限，加载失败可重试。

`python scripts/generate-oni-web-assets.py` 使用 Pillow 生成无损 WebP 版本，并逐像素校验；原始 PNG 保留，WebP 加载失败时回退。16 层液体数组重排为 4×4 图集以满足 WebP 尺寸限制，上传 GPU 时恢复原始分层，未降低分辨率。无需在 GitHub Actions 上安装 Pillow，部署直接使用提交的生成资源。

`tools/map-load-fixture.html` 检查同页重复加载与重新解析存档时的准备时间、画面一致性、缓存复用和细节完成后的刷新；该本地检查页需要 `ONI_VISUAL_FIXTURE`。


### 慢网络首屏

地图打开时先从存档内存绘制可交互概览，不等待网络请求。首屏纹理只使用 `assets/preview/world.webp`（约 695 KiB）和原分辨率的地形蒙版，建筑索引随程序打包。概览图集包含缩小的预览贴图，未替换原始高清资源；放大时按当前视口补齐原始材质和对象贴图，总览不下载高清液体数组，也不预载复制人服装库。

资源变动后运行 `python scripts/generate-oni-preview-atlas.py` 更新预览图集及随程序打包的建筑索引。`scripts/check-map-overview.ts` 检查首屏包大小、索引同步、数组布局和本地概览数据；`ONI_FIXTURE_ASSET_DELAY_MS=12000` 仅在本地开发服务中延迟贴图响应，用 `tools/map-startup-fixture.html` 验证纹理等待期间地图和悬浮信息已可用。


### 打印舱视口与高清更新

新载入存档首次进入地图时，以主打印舱为中心显示基地附近；没有主打印舱时尝试副打印舱，两者都不存在则显示全图。调整窗口尺寸会保留地图中心，切换视图不会重置用户的平移和缩放。

高清下载以打印舱和附近建筑优先，最多并发四个请求；每张资源完成后合并刷新，不等待全部贴图下载。地形与对象分块从打印舱所在块向周围更新，复制人服装资源在主要地图材质之后加载。`scripts/check-map-focus.ts` 验证定位、窗口缩放和请求优先级；本地设置 `ONI_FIXTURE_SLOW_ASSET=bgarray_liquids.webp`、`ONI_FIXTURE_ASSET_DELAY_MS=8000` 后打开 `tools/map-detail-progress-fixture.html`，可验证某张液体贴图缓慢时其他高清资源仍及时刷新。
