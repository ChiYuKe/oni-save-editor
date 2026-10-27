# 本机种子演算

网页新增「从种子演算世界」入口。数字种子需搭配星群类型；完整游戏坐标码包含星群、设置、故事与混入编码。目标 DLC 是一组已拥有且可加载的内容包。

## 原生生成流程

`SeedEngineBatch.Run` 启动 Unity 工程的 launchscene，等游戏完成初始化后调用与 `OfflineWorldGen.DoWorldGenInitialize` 相同的 `ProcGenGame.Cluster.Generate`，保留默认的模板放置、世界特质与 `SimDLL` 500 步稳定计算。生成后进入 backend，通过游戏的 WorldGenSpawner 生成所有星球对象，间歇泉配置由游戏自己的 `GeyserConfigurator` 和 `KRandom` 产生。最后由 `SaveLoader.Save` 输出原生 `.sav`，浏览器复用现有读取、地图、资源统计和定位功能。

没有用前端随机数或预置地图替代真实生成。也没有跳过非初始星球。为生成未发现星球的对象，工作进程内会将星球标为已发现；该预览文件不是玩家原有进度。

## 启动

需要本机安装 Node.js、Unity 6000.3.5f2，以及已能运行的游戏导出工程、原生 SimDLL 和世界生成资源。服务不附带游戏程序集或内容包。先关闭该 Unity 工程的其他编辑器实例。

在编辑器仓库目录运行：

```powershell
node tools/seed-engine/setup.mjs --project E:/Unity/NOI1018/ExportedProject
node tools/seed-engine/server.mjs --project E:/Unity/NOI1018/ExportedProject --unity "E:/Unity/Unity 6000.3.5f2/Editor/Unity.exe"
```

打开网页首页 → 从种子演算世界。服务只监听 `127.0.0.1:5191`；默认允许本机网页和本项目 GitHub Pages 域。若浏览器询问是否允许访问本地网络，需要用户允许后才能连接。

每次生成会启动独立 Unity 进程，首次需要等真实引擎完成，不能保证秒出图。同一服务运行期间，相同引擎内容、相同输入可复用已完成结果。修改源代码、程序集或生成数据后重新计算指纹；服务重启清空缓存，避免跨版本误用。

安装器只复制适配器并加入两个由专用进程环境变量启用的入口：`Util.RootFolder` 重定向到任务目录，`DlcManager.IsContentSubscribed` 限制本次加载的 DLC（仍尊重原有可用性检查）。不会改变世界生成、随机数或间歇泉算法，也不改玩家 DLC 偏好。首次修改的源文件会保留 `.seed-engine-backup`。普通游戏运行不设置这些环境变量，沿用原有行为。

输出默认在 Unity 工程旁的 `PreviewDiagnostics/seed-engine-jobs/<任务 ID>/`：

- `request.json`：完整输入与 DLC 组合。
- `progress.json`：真实阶段、规范坐标码、结果路径与 Unity 版本。
- `engine-info.json`：本次引擎代码、程序集和数据指纹。
- `engine.log`：原生运行日志；生成失败可在这里定位。
- `native-geysers.json`：直接从游戏 API 导出的坐标、产量、喷发和活跃/休眠时长、温度，用于独立核对统计读取。
- `generated.sav`：原生生成结果。玩家已有存档不会发给该服务。

服务支持 `--data PATH` 指定输出目录、`--port PORT` 指定监听端口、`--origin URL` 增加一个开发站来源；当前网页固定连接默认端口。本机引擎串行处理，忙时会明确提示。计算超时或失败不会返回模拟结果。

## 核对

```powershell
node node_modules/tsx/dist/cli.mjs scripts/check-seed-engine.ts "任务目录"
# 可传第二个任务目录，比较同一配置重复生成的泉位置与参数。
```

结果绑定本机工程的游戏代码和生成资源版本。不要把某一版本的输出当作其他版本、不同模组或不同混入设置的保证。星球随机显示名、泉的随机后缀可能随初始化不同；校验以类型、位置和原生配置为准。当前是本机引擎版；远程引擎托管尚未接入，GitHub Pages 本身不执行 Unity。


已在本机工程用种子 `1234567` 完成以下真实运行和 API 对照（数字为测试输出，不是预置结果）：

| 配置 | 星球数 | 产出型间歇泉 | 液体循环泉 |
| --- | ---: | ---: | ---: |
| 本体、SandstoneDefault | 1 | 17 | 0 |
| 眼冒金星、SandstoneStartCluster | 9 | 39 | 0 |
| 眼冒金星 + 海洋、AquaticSpacedOutCluster | 9 | 34 | 13 |

三组的类型、坐标、喷发产量、温度和活跃/休眠时长均通过原生 API 快照核对；眼冒金星组重复生成的泉位置和参数一致。网页提交 → 原生生成 → 资源统计 → 地图预览已实际验证。其余组合仍需逐组扩充回归样本；没有宣称所有版本和模组均已验证。
