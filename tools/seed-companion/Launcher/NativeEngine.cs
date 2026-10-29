using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Mono.Cecil;
using Mono.Cecil.Cil;

namespace OniSeedCompanion;
public sealed record SeedRequest(int seed, string cluster, string coordinate, string[] dlcIds);
public sealed class NativeEngine(string gameDirectory, string dataDirectory, string workerAssembly) : IDisposable
{
    public string GameDirectory { get; } = Path.GetFullPath(gameDirectory);
    public string DataDirectory { get; } = Path.GetFullPath(dataDirectory);
    public string WorkerAssembly { get; } = Path.GetFullPath(workerAssembly);
    public string EngineId { get; private set; } = "";
    public string RuntimeDirectory { get; private set; } = "";
    RuntimeCache? runtimeCache;
    public event Action<string>? Message;
    static readonly string[] required = ["OxygenNotIncluded.exe", "UnityPlayer.dll", "OxygenNotIncluded_Data/Managed/Assembly-CSharp.dll", "OxygenNotIncluded_Data/Managed/Assembly-CSharp-firstpass.dll", "OxygenNotIncluded_Data/Plugins/x86_64/SimDLL.dll"];
    public static void ValidateGame(string root)
    {
        foreach (string file in required)
            if (!File.Exists(Path.Combine(root, file))) throw new IOException("请选择包含 OxygenNotIncluded.exe 的完整游戏目录。缺少：" + file);
    }
    public async Task Prepare(CancellationToken cancellation = default)
    {
        ValidateGame(GameDirectory);
        ValidateBindings(Path.Combine(GameDirectory, "OxygenNotIncluded_Data/Managed"), WorkerAssembly);
        if (DataDirectory.StartsWith(GameDirectory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || DataDirectory.Equals(GameDirectory, StringComparison.OrdinalIgnoreCase))
            throw new IOException("演算缓存不能放在游戏安装目录里。");
        Message?.Invoke("正在检测游戏版本与生成资源…");
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (string relative in required.Append("OxygenNotIncluded_Data/globalgamemanagers"))
        {
            hash.AppendData(Encoding.UTF8.GetBytes(relative));
            hash.AppendData(await File.ReadAllBytesAsync(Path.Combine(GameDirectory, relative), cancellation));
        }
        hash.AppendData(await File.ReadAllBytesAsync(WorkerAssembly, cancellation));
        var streamRoot = Path.Combine(GameDirectory, "OxygenNotIncluded_Data/StreamingAssets");
        foreach (var file in Directory.EnumerateFiles(streamRoot, "*", SearchOption.AllDirectories).Order(StringComparer.Ordinal))
        {
            cancellation.ThrowIfCancellationRequested();
            if (!new[] { ".yaml", ".yml", ".json", ".txt", ".bytes" }.Contains(Path.GetExtension(file))) continue;
            hash.AppendData(Encoding.UTF8.GetBytes(Path.GetRelativePath(streamRoot, file)));
            hash.AppendData(await File.ReadAllBytesAsync(file, cancellation));
        }
        foreach (var file in Directory.EnumerateFiles(Path.Combine(GameDirectory, "OxygenNotIncluded_Data"), "*", SearchOption.TopDirectoryOnly).Order(StringComparer.Ordinal))
        {
            var info = new FileInfo(file);
            hash.AppendData(Encoding.UTF8.GetBytes(info.Name + ":" + info.Length + ":" + info.LastWriteTimeUtc.Ticks));
        }
        EngineId = Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
        RuntimeDirectory = Path.Combine(DataDirectory, "runtimes", EngineId);
        runtimeCache ??= new RuntimeCache(Path.Combine(DataDirectory, "runtimes"), EngineId);
        if (File.Exists(Path.Combine(RuntimeDirectory, "companion-ready.json")))
        {
            runtimeCache.Prune(Message, cancellation);
            Message?.Invoke("独立运行副本已就绪。游戏原目录未修改。"); return;
        }
        Directory.CreateDirectory(Path.GetDirectoryName(RuntimeDirectory)!);
        string staging = RuntimeDirectory + ".preparing-" + Guid.NewGuid().ToString("N");
        Directory.CreateDirectory(staging);
        try
        {
            Message?.Invoke("首次准备独立运行副本，需要复制游戏运行资源…");
            foreach (var name in new[] { "OxygenNotIncluded.exe", "UnityPlayer.dll" }) File.Copy(Path.Combine(GameDirectory, name), Path.Combine(staging, name));
            foreach (var dir in new[] { "MonoBleedingEdge", "OxygenNotIncluded_Data" })
                foreach (var file in Directory.EnumerateFiles(Path.Combine(GameDirectory, dir), "*", SearchOption.AllDirectories))
                {
                    cancellation.ThrowIfCancellationRequested();
                    if (new[] { ".pdb", ".log" }.Contains(Path.GetExtension(file).ToLowerInvariant())) continue;
                    string target = Path.Combine(staging, Path.GetRelativePath(GameDirectory, file));
                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    File.Copy(file, target);
                }
            string managed = Path.Combine(staging, "OxygenNotIncluded_Data/Managed");
            File.Copy(WorkerAssembly, Path.Combine(managed, "OniSeedWorker.dll"));
            Patch(managed, WorkerAssembly);
            string assemblies = Path.Combine(staging, "OxygenNotIncluded_Data/ScriptingAssemblies.json");
            var registered = JsonNode.Parse(await File.ReadAllTextAsync(assemblies, cancellation))!;
            registered["names"]!.AsArray().Add("OniSeedWorker.dll");
            registered["types"]!.AsArray().Add(16);
            await File.WriteAllTextAsync(assemblies, registered.ToJsonString(), cancellation);
            // Steam application identity only. Native ownership and DLC checks are preserved.
            await File.WriteAllTextAsync(Path.Combine(staging, "steam_appid.txt"), "457140", cancellation);
            await File.WriteAllTextAsync(Path.Combine(staging, "companion-ready.json"), JsonSerializer.Serialize(new { EngineId, source = GameDirectory }), cancellation);
            Directory.Move(staging, RuntimeDirectory);
        }
        finally
        {
            // Remove only this preparation attempt, including cancellation/failed copies.
            try { if (Directory.Exists(staging)) RuntimeCache.DeleteTree(staging); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException) { }
        }
        runtimeCache.Prune(Message, cancellation);
        Message?.Invoke("独立运行副本准备完成。无需 Unity 编辑器。");
    }
    static void ValidateBindings(string managed, string helper)
    {
        using var resolver = new DefaultAssemblyResolver();
        resolver.AddSearchDirectory(managed);
        resolver.AddSearchDirectory(Path.GetDirectoryName(helper)!);
        using var worker = ModuleDefinition.ReadModule(helper, new ReaderParameters { AssemblyResolver = resolver, InMemory = true });
        foreach (var member in worker.GetMemberReferences().OfType<MethodReference>())
        {
            if (member.DeclaringType.Scope is not AssemblyNameReference scope || (!(scope.Name is "Assembly-CSharp" or "Assembly-CSharp-firstpass") && !scope.Name.StartsWith("UnityEngine", StringComparison.Ordinal))) continue;
            try { if (member.Resolve() == null) throw new MissingMethodException(member.FullName); }
            catch (Exception error) { throw new InvalidOperationException("当前游戏版本的接口不兼容，请更新演算器。接口：" + member.FullName, error); }
        }
    }
    static void Patch(string managed, string helper)
    {
        using var resolver = new DefaultAssemblyResolver();
        resolver.AddSearchDirectory(managed);
        resolver.AddSearchDirectory(Path.GetDirectoryName(helper)!);
        using var worker = ModuleDefinition.ReadModule(helper, new ReaderParameters { AssemblyResolver = resolver, InMemory = true });
        var type = worker.Types.Single(t => t.Name == "SeedRuntime");
        ModuleDefinition Read(string name) => ModuleDefinition.ReadModule(Path.Combine(managed, name), new ReaderParameters { InMemory = true, AssemblyResolver = resolver });
        using (var main = Read("Assembly-CSharp.dll"))
        {
            var update = main.Types.Single(t => t.FullName == "LaunchInitializer").Methods.Single(m => m.Name == "Update" && m.Parameters.Count == 0);
            update.Body.GetILProcessor().InsertBefore(update.Body.Instructions[0], Instruction.Create(OpCodes.Call, main.ImportReference(type.Methods.Single(m => m.Name == "Bootstrap"))));
            main.Write(Path.Combine(managed, "Assembly-CSharp.dll.patched"));
        }
        using (var first = Read("Assembly-CSharp-firstpass.dll"))
        {
            var root = first.Types.Single(t => t.FullName == "Util").Methods.Single(m => m.Name == "RootFolder" && m.Parameters.Count == 0);
            var il = root.Body.GetILProcessor(); var original = root.Body.Instructions[0]; var pop = Instruction.Create(OpCodes.Pop);
            foreach (var instruction in new[] {
                Instruction.Create(OpCodes.Call, first.ImportReference(type.Methods.Single(m => m.Name == "IsolatedRoot"))),
                Instruction.Create(OpCodes.Dup), Instruction.Create(OpCodes.Brfalse, pop), Instruction.Create(OpCodes.Ret), pop }) il.InsertBefore(original, instruction);
            var subscribed = first.Types.Single(t => t.FullName == "DlcManager").Methods.Single(m => m.Name == "IsContentSubscribed" && m.Parameters.Count == 1);
            il = subscribed.Body.GetILProcessor(); original = subscribed.Body.Instructions[0];
            foreach (var instruction in new[] { Instruction.Create(OpCodes.Ldarg_0),
                Instruction.Create(OpCodes.Call, first.ImportReference(type.Methods.Single(m => m.Name == "ExcludedDlc"))),
                Instruction.Create(OpCodes.Brfalse, original), Instruction.Create(OpCodes.Ldc_I4_0), Instruction.Create(OpCodes.Ret) }) il.InsertBefore(original, instruction);
            first.Write(Path.Combine(managed, "Assembly-CSharp-firstpass.dll.patched"));
        }
        resolver.Dispose();
        foreach (string name in new[] { "Assembly-CSharp.dll", "Assembly-CSharp-firstpass.dll" })
            File.Move(Path.Combine(managed, name + ".patched"), Path.Combine(managed, name), true);
    }
    readonly SemaphoreSlim workerGate = new(1, 1);
    Process? worker;
    string workerDlcs = "", workerDirectory = "";
    bool disposed;
    public void Dispose()
    {
        disposed = true;
        try { StopWorker(); }
        finally { runtimeCache?.Dispose(); runtimeCache = null; }
    }
    void StopWorker(bool cleanDirectory = true)
    {
        var process = worker; worker = null;
        string directory = workerDirectory; workerDirectory = "";
        bool exited = process == null;
        if (process != null)
        {
            try
            {
                if (!process.HasExited) process.Kill(entireProcessTree: true);
                exited = process.WaitForExit(5000);
            }
            catch (InvalidOperationException) { exited = true; }
            finally { process.Dispose(); }
        }
        // Never remove a running session, task results, or a caller-supplied directory.
        if (!cleanDirectory || !exited || string.IsNullOrEmpty(directory)) return;
        string root = Path.GetFullPath(Path.Combine(DataDirectory, "workers"));
        string target = Path.GetFullPath(directory);
        if (!string.Equals(Path.GetDirectoryName(target), root, StringComparison.OrdinalIgnoreCase)
            || !Guid.TryParseExact(Path.GetFileName(target), "N", out _)) return;
        try
        {
            if (!Directory.Exists(target)) return;
            DeleteSessionDirectory(target);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            Message?.Invoke("临时目录暂时无法清理，退出演算器后可手动删除：" + target);
        }
    }
    static void DeleteSessionDirectory(string directory)
    {
        // Do not follow junctions or symbolic links, including nested ones.
        if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
        {
            Directory.Delete(directory);
            return;
        }
        foreach (string file in Directory.EnumerateFiles(directory)) File.Delete(file);
        foreach (string child in Directory.EnumerateDirectories(directory)) DeleteSessionDirectory(child);
        Directory.Delete(directory);
    }
    static async Task<Dictionary<string, JsonElement>?> ReadStatus(string path, CancellationToken cancellation)
    {
        try { return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(await File.ReadAllTextAsync(path, cancellation)); }
        catch (Exception error) when (error is IOException or JsonException) { return null; }
    }
    async Task<bool> Ready(string[] dlcs, bool graphics, CancellationToken cancellation)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        string key = string.Join(",", dlcs.Order(StringComparer.Ordinal)) + (graphics ? ":graphics" : "");
        bool preloaded = worker != null && !worker.HasExited && workerDlcs == key;
        if (!preloaded)
        {
            StopWorker();
            workerDirectory = Path.Combine(DataDirectory, "workers", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Path.Combine(workerDirectory, "engine-data"));
            var start = new ProcessStartInfo(Path.Combine(RuntimeDirectory, "OxygenNotIncluded.exe")) { WorkingDirectory = RuntimeDirectory, UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden };
            foreach (var arg in new[] { "-batchmode", "-nosound", "-screen-width", "128", "-screen-height", "128", "-logFile", Path.Combine(workerDirectory, "engine.log") }) start.ArgumentList.Add(arg);
            start.ArgumentList.Add(graphics ? "-force-d3d11" : "-nographics");
            start.Environment["ONI_SEED_ENGINE_REQUEST"] = "session";
            start.Environment["ONI_SEED_ENGINE_SESSION"] = workerDirectory;
            start.Environment["ONI_SEED_ENGINE_JOBS"] = Path.Combine(DataDirectory, "jobs");
            start.Environment["ONI_SEED_ENGINE_ROOT"] = Path.Combine(workerDirectory, "engine-data");
            start.Environment["ONI_SEED_ENGINE_DLCS"] = "," + string.Join(",", dlcs);
            start.Environment["SteamAppId"] = "457140";
            worker = Process.Start(start) ?? throw new IOException("无法启动游戏运行时。");
            workerDlcs = key;
            Message?.Invoke("正在预载原生游戏资源…填写种子时会提前准备，减少提交后的等待。");
        }
        while (true)
        {
            cancellation.ThrowIfCancellationRequested();
            if (worker == null || worker.HasExited) throw new IOException("原生引擎未能就绪，请检查日志：" + Path.Combine(workerDirectory, "engine.log"));
            var state = await ReadStatus(Path.Combine(workerDirectory, "worker-status.json"), cancellation);
            if (state?.GetValueOrDefault("status").GetString() == "ready") return preloaded;
            await Task.Delay(100, cancellation);
        }
    }
    public async Task Warmup(string[] dlcs, CancellationToken cancellation = default)
    {
        if (!await workerGate.WaitAsync(0, cancellation)) return;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation); timeout.CancelAfter(TimeSpan.FromMinutes(3));
        try { if (RuntimeDirectory.Length == 0) await Prepare(timeout.Token); await Ready(dlcs, false, timeout.Token); }
        catch { StopWorker(cleanDirectory: false); throw; }
        finally { workerGate.Release(); }
    }
    public async Task<(string directory, int exitCode)> Generate(SeedRequest request, string? directory = null, bool graphics = false, CancellationToken cancellation = default)
    {
        if (RuntimeDirectory.Length == 0) await Prepare(cancellation);
        directory = Path.GetFullPath(string.IsNullOrEmpty(directory) ? Path.Combine(DataDirectory, "jobs", Guid.NewGuid().ToString("N")) : directory);
        if (directory.Equals(GameDirectory, StringComparison.OrdinalIgnoreCase) || directory.StartsWith(GameDirectory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("任务输出不能写入游戏安装目录。");
        if (File.Exists(Path.Combine(directory, "generated.sav"))) throw new IOException("此任务目录已有生成结果，请使用新的任务目录。");
        Directory.CreateDirectory(directory);
        // The session mailbox only accepts outputs beneath this tool's jobs directory.
        if (!directory.StartsWith(Path.Combine(DataDirectory, "jobs") + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            return await GenerateOnce(request, directory, graphics, cancellation);
        string json = JsonSerializer.Serialize(new { request.seed, request.cluster, request.coordinate, request.dlcIds, outputDirectory = directory });
        await File.WriteAllTextAsync(Path.Combine(directory, "request.json"), json, cancellation);
        await workerGate.WaitAsync(cancellation);
        var watch = Stopwatch.StartNew();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation); timeout.CancelAfter(TimeSpan.FromMinutes(20));
        try
        {
            bool preloaded = await Ready(request.dlcIds, graphics, timeout.Token);
            double startupSeconds = watch.Elapsed.TotalSeconds;
            string mailbox = Path.Combine(workerDirectory, "next-request.json");
            await File.WriteAllTextAsync(mailbox + ".tmp", json, timeout.Token);
            File.Move(mailbox + ".tmp", mailbox, true);
            while (true)
            {
                timeout.Token.ThrowIfCancellationRequested();
                var state = await ReadStatus(Path.Combine(directory, "progress.json"), timeout.Token);
                string? status = state?.GetValueOrDefault("status").GetString();
                if (status is "complete" or "failed")
                {
                    await File.WriteAllTextAsync(Path.Combine(directory, "engine-info.json"), JsonSerializer.Serialize(new { engineId = EngineId, nativeRuntime = true, preloaded, startupSeconds, totalSeconds = watch.Elapsed.TotalSeconds, workerDirectory }), cancellation);
                    try { File.Copy(Path.Combine(workerDirectory, "engine.log"), Path.Combine(directory, "engine.log"), true); } catch (IOException) { }
                    StopWorker(cleanDirectory: status == "complete");
                    return (directory, status == "complete" ? 0 : 1);
                }
                if (worker == null || worker.HasExited) throw new IOException("原生引擎意外退出。日志：" + Path.Combine(workerDirectory, "engine.log"));
                await Task.Delay(100, timeout.Token);
            }
        }
        catch { StopWorker(cleanDirectory: false); throw; }
        finally { workerGate.Release(); }
    }
    async Task<(string directory, int exitCode)> GenerateOnce(SeedRequest request, string? directory = null, bool graphics = false, CancellationToken cancellation = default)
    {
        if (RuntimeDirectory.Length == 0) await Prepare(cancellation);
        directory = Path.GetFullPath(string.IsNullOrEmpty(directory) ? Path.Combine(DataDirectory, "jobs", Guid.NewGuid().ToString("N")) : directory);
        if (directory.Equals(GameDirectory, StringComparison.OrdinalIgnoreCase) || directory.StartsWith(GameDirectory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new IOException("任务输出不能写入游戏安装目录。");
        if (File.Exists(Path.Combine(directory, "generated.sav"))) throw new IOException("此任务目录已有生成结果，请使用新的任务目录。");
        Directory.CreateDirectory(directory);
        string isolated = Path.Combine(directory, "engine-data"); Directory.CreateDirectory(isolated);
        await File.WriteAllTextAsync(Path.Combine(directory, "request.json"), JsonSerializer.Serialize(new { request.seed, request.cluster, request.coordinate, request.dlcIds, outputDirectory = directory }), cancellation);
        await File.WriteAllTextAsync(Path.Combine(directory, "engine-info.json"), JsonSerializer.Serialize(new { engineId = EngineId, nativeRuntime = true, createdAt = DateTime.UtcNow }), cancellation);
        var start = new ProcessStartInfo(Path.Combine(RuntimeDirectory, "OxygenNotIncluded.exe")) { WorkingDirectory = RuntimeDirectory, UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden };
        foreach (var arg in new[] { "-batchmode", "-nosound", "-screen-width", "128", "-screen-height", "128", "-logFile", Path.Combine(directory, "engine.log") }) start.ArgumentList.Add(arg);
        start.ArgumentList.Add(graphics ? "-force-d3d11" : "-nographics");
        start.Environment["ONI_SEED_ENGINE_REQUEST"] = Path.Combine(directory, "request.json");
        start.Environment["ONI_SEED_ENGINE_ROOT"] = isolated;
        start.Environment["ONI_SEED_ENGINE_DLCS"] = "," + string.Join(",", request.dlcIds);
        start.Environment["SteamAppId"] = "457140";
        using var process = Process.Start(start) ?? throw new IOException("无法启动游戏运行时。");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation); timeout.CancelAfter(TimeSpan.FromMinutes(20));
        using var terminate = timeout.Token.Register(() =>
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { }
        });
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) { if (!process.HasExited) process.Kill(entireProcessTree: true); throw; }
        return (directory, process.ExitCode);
    }
}
