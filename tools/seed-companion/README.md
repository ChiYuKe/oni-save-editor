# 独立种子演算器（Windows 预览版）

这是现有网页的可下载本机配套工具。玩家无需 Unity 编辑器、Node.js 或手动安装模组；运行工具后，网页仍使用相同的 `/health`、`/jobs`、`/jobs/<id>` 和 `/jobs/<id>/save` 协议。

## 玩家使用

见 [使用说明](PLAYER-README.md)。网页种子入口仍保持默认隐藏，通过现有 `oni.seedCalculator` 调试开关显示。此原型没有增加远程演算服务。

## 实现边界

- `Launcher` 是 .NET Windows 窗口、安装目录探测、本机 HTTP 接口、串行队列和磁盘缓存。
- `Worker` 是针对安装版游戏 API 编译的自有组件，不引用 UnityEditor。它调用原生 `Cluster.Generate`、SimDLL、WorldGenSpawner、GeyserConfigurator 和 SaveLoader。
- 选择游戏目录后，在工具自己的缓存中复制一份必要运行文件；仅对该副本加入任务入口、输出隔离和本次 DLC 选择。不会修改安装目录和游戏模组目录。
- 工作进程使用用户游戏自带的 UnityPlayer、Mono、序列化资源、生成模板和原生插件。没有把世界生成移植为近似算法，也没有替换原生的内容可用性或账号验证。
- 原生进程使用 `-batchmode -nographics -nosound`，无需打开游戏窗口。结果仍由原生游戏生成和保存，再交给网页已有渲染器。
- 启动前核对调用接口是否存在；引擎代码、SimDLL、生成配置、资源文件元数据和 Worker 参与版本指纹。游戏更新后重启工具重新准备运行副本。
- 同一引擎和输入的完成结果可在重启后复用。未完成、失败或取消的任务不进结果缓存。
- HTTP 仅监听 `127.0.0.1`，验证 Host 和 Origin，任务参数有长度及类型限制，网页不能指定任意输出路径或执行任意命令。
- 发布包只含自有组件、Mono.Cecil 和自包含 .NET 启动器；不分发游戏的 UnityPlayer、Assembly-CSharp、SimDLL、资源或 DLC。

## 构建

开发机需要 Windows、.NET SDK，以及完整的《缺氧》安装目录；玩家不需要 SDK。

```powershell
./build.ps1 -GameDirectory 'D:/Steam/steamapps/common/OxygenNotIncluded' -OutputDirectory 'E:/build/OniSeedCompanion'
```

构建会针对指定安装版的接口编译 Worker，再发布自包含 Windows x64 单文件启动器。将输出目录中的 `OniSeedCompanion.exe`、`OniSeedWorker.dll`、使用说明、依赖许可和校验文件一起打包；不要将工具生成的运行副本或任务结果放入发行包。

## 命令行诊断

```powershell
OniSeedCompanion.exe --game 'D:/Steam/steamapps/common/OxygenNotIncluded' --data 'E:/seed-test' --prepare-only
OniSeedCompanion.exe --game 'D:/Steam/steamapps/common/OxygenNotIncluded' --data 'E:/seed-test' --serve --port 5191
OniSeedCompanion.exe --game 'D:/Steam/steamapps/common/OxygenNotIncluded' --data 'E:/seed-test' --request request.json --output 'E:/seed-test/new-job'
```

`request.json` 示例：

```json
{"seed":1234567,"cluster":"clusters/SandstoneDefault","coordinate":"","dlcIds":[]}
```

输出目录必须是新任务目录，不能指向游戏安装目录，也不会覆盖已有 `generated.sav`。每次任务保留 `request.json`、`engine-info.json`、`progress.json`、`native-geysers.json`、`engine.log` 和 `generated.sav`。可沿用仓库的 `scripts/check-seed-engine.ts` 与原生 API 快照逐项比较。

## 已验证

安装版 Unity 6000.3.5f2，种子 `1234567`：

| 配置 | 星球 | 原生产出泉 | 循环泉 |
| --- | ---: | ---: | ---: |
| 本体 SandstoneDefault | 1 | 17 | 0 |
| 眼冒金星 SandstoneStartCluster | 9 | 39 | 0 |
| 眼冒金星 + 海洋 AquaticSpacedOutCluster | 9 | 34 | 13 |

三组均已在安装版运行时中生成，并通过类型、位置、喷发产量、温度、活跃和休眠时长的原生 API 对照；位置和参数与之前编辑器原生流程的结果一致。海洋组经过独立 HTTP 接口提交，重复请求命中缓存。没有把这些测试数字作为生成结果硬编码。

预览版仍需扩充其他游戏版本、干净电脑和不同安装渠道的测试。当前不宣称支持所有旧版本、模组改写或 Linux/macOS。
