# ONI Save Lab

一个在浏览器本地运行的《缺氧》存档编辑器。存档不会上传服务器，解析和导出都在当前浏览器完成。

在线地址：https://chiyuke.github.io/oni-save-editor/

## 当前功能

- 读取和导出 ONI `.sav` 文件，保留 KSerialization 模板目录与未知组件的原始字节。
- 总览：周期、复制人、世界尺寸、对象分组和基础 `SaveGame` 设置。
- 地图：按游戏的 `SceneLayer` 顺序渲染群落背景、自然地形、气体/液体、砖块、管线、建筑、喷泉和复制人，并支持图层开关与全景 PNG 导出。
- 地形渲染：复现 `GroundRenderer` 的四角采样、`Substance.idx` 材质叠放、群落蒙版变体和 `Substance` 色相混合；支持 WebGL2 加速与 Canvas2D 回退。
- 地图编辑：查看温度、质量、病菌、可见性、可生成性和伤害覆盖层，可使用画笔、橡皮、吸管、填充、矩形和直线修改模拟格。
- 复制人：查看名称、坐标、体温和组件数量，支持修改名称与世界坐标。
- 对象：按 SaveManager 分组检索实例，查看组件并编辑已解析的标量字段。

## 开发

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

## 存档兼容性

解析器使用存档自身携带的模板目录驱动，不依赖固定的游戏程序集类型列表。未知组件和模拟区会原样保留；导出前建议先备份原存档，并在游戏中确认修改后的文件。

地图会读取 SIMSAVE 网格和 SaveManager 对象进行渲染；地形格可直接编辑，建筑与管线目前以只读方式显示。WebGL2 不可用或游戏材质缺失时会自动切换到 Canvas2D 渲染。
