using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace OniSeedCompanion;
public sealed class CompanionServer(NativeEngine engine, int port = 5191) : IAsyncDisposable
{
    readonly ConcurrentDictionary<string, Job> jobs = new();
    readonly SemaphoreSlim gate = new(1, 1);
    readonly CancellationTokenSource lifetime = new();
    WebApplication? app;
    readonly string session = Guid.NewGuid().ToString("N");
    public event Action<string>? Message;
    static readonly string[] dlcs = ["EXPANSION1_ID", "DLC2_ID", "DLC3_ID", "DLC4_ID", "DLC5_ID", "COSMETIC1_ID"];
    sealed record Job(string Id, string Directory, string Key);
    public async Task Start()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:" + port);
        builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 8192);
        app = builder.Build();
        app.Use(async (context, next) =>
        {
            var request = context.Request; var response = context.Response;
            string origin = request.Headers.Origin.ToString();
            bool accepted = origin.Length == 0 || origin == "https://chiyuke.github.io" ||
                (Uri.TryCreate(origin, UriKind.Absolute, out var uri) && (uri.Scheme == "http" || uri.Scheme == "https") && (uri.Host == "localhost" || uri.Host == "127.0.0.1"));
            if (!accepted || !(request.Host.Host is "127.0.0.1" or "localhost") || request.Host.Port != port)
            { response.StatusCode = 403; return; }
            response.Headers.CacheControl = "no-store";
            response.Headers.Vary = "Origin";
            if (origin.Length > 0) response.Headers.AccessControlAllowOrigin = origin;
            response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";
            response.Headers.AccessControlAllowHeaders = "Content-Type";
            if (request.Headers["Access-Control-Request-Private-Network"] == "true") response.Headers["Access-Control-Allow-Private-Network"] = "true";
            if (request.Method == "OPTIONS") { response.StatusCode = 204; return; }
            await next(context);
        });
        app.MapGet("/health", () => Results.Json(new { engine = "ONI installed game runtime", engineId = engine.EngineId, nativeRuntime = true, requiresUnityEditor = false, protocol = 1, supportsWarmup = true, supportsSettings = true, supportsVerification = true, session, busy = gate.CurrentCount == 0 }));
        app.MapGet("/settings", async (string? dlcs) =>
        {
            var selection = (dlcs ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Distinct().Order(StringComparer.Ordinal).ToArray();
            if (selection.Any(x => !CompanionServer.dlcs.Contains(x))) return Results.BadRequest();
            var catalog = await engine.ReadSettings(selection);
            return catalog.HasValue ? Results.Json(catalog.Value) : Results.Json(new { ready = false });
        });
        app.MapGet("/jobs/{id}/verification", async (string id) =>
        {
            if (!jobs.TryGetValue(id, out var job)) return Results.NotFound();
            if ((await Progress(job)).GetValueOrDefault("status")?.ToString() != "complete") return Results.Conflict();
            string path = Path.Combine(job.Directory, "native-geysers.json");
            return File.Exists(path) ? Results.File(path, "application/json") : Results.NotFound();
        });
        app.MapPost("/warmup", async (HttpRequest http) =>
        {
            if (!http.ContentType?.StartsWith("application/json", StringComparison.OrdinalIgnoreCase) ?? true) return Results.StatusCode(415);
            string[]? selection;
            try { selection = await http.ReadFromJsonAsync<string[]>(); }
            catch (JsonException) { return Results.BadRequest(); }
            if (selection == null || selection.Any(x => !dlcs.Contains(x))) return Results.BadRequest();
            if (gate.CurrentCount == 0) return Results.Conflict();
            _ = Task.Run(async () => { try { await engine.Warmup(selection.Distinct().Order(StringComparer.Ordinal).ToArray(), lifetime.Token); } catch (Exception e) { Message?.Invoke(e.Message); } });
            return Results.Accepted();
        });
        app.MapPost("/jobs", Submit);
        app.MapGet("/jobs/{id}", async (string id) => jobs.TryGetValue(id, out var job) ? Results.Json(await Progress(job)) : Results.NotFound(new { message = "任务不存在或工具已重新启动。" }));
        app.MapGet("/jobs/{id}/save", async (string id) =>
        {
            if (!jobs.TryGetValue(id, out var job)) return Results.NotFound();
            var progress = await Progress(job);
            if (progress.GetValueOrDefault("status")?.ToString() != "complete") return Results.Conflict(new { message = "原生演算尚未完成。" });
            return Results.File(Path.Combine(job.Directory, "generated.sav"), "application/octet-stream");
        });
        await app.StartAsync(lifetime.Token);
        Message?.Invoke("服务已启动：http://127.0.0.1:" + port + "。现在可以在网页提交种子。");
    }
    async Task<IResult> Submit(HttpRequest http)
    {
        if (!http.ContentType?.StartsWith("application/json", StringComparison.OrdinalIgnoreCase) ?? true) return Results.StatusCode(415);
        SeedRequest? request;
        try
        {
            request = await http.ReadFromJsonAsync<SeedRequest>();
            if (request == null || request.dlcIds == null || request.dlcIds.Any(x => !dlcs.Contains(x))) throw new ArgumentException("DLC 组合无效。");
            if (!string.IsNullOrWhiteSpace(request.coordinate))
            {
                if (request.coordinate.Length > 200 || !System.Text.RegularExpressions.Regex.IsMatch(request.coordinate, "^[-A-Za-z0-9]+$")) throw new ArgumentException("坐标码格式无效。");
                request = request with { seed = 0, cluster = "", coordinate = request.coordinate.Trim().ToUpperInvariant() };
            }
            else if (request.seed <= 0 || string.IsNullOrEmpty(request.cluster) || !System.Text.RegularExpressions.Regex.IsMatch(request.cluster, "^[-A-Za-z0-9_/:]+$")) throw new ArgumentException("需要有效种子和星群类型。");
            if (!string.IsNullOrWhiteSpace(request.coordinate) && request.options != null) throw new ArgumentException("完整坐标码不能同时附加开局设置。");
            if (request.options != null)
            {
                if (request.options.mode is not ("survival" or "nosweat")) throw new ArgumentException("开局模式无效。");
                SettingChoice[] Normalize(SettingChoice[]? choices)
                {
                    choices ??= [];
                    if (choices.Length > 100 || choices.Any(x => x == null || string.IsNullOrEmpty(x.id) || x.id.Length > 120 || string.IsNullOrEmpty(x.value) || x.value.Length > 120) || choices.Select(x => x.id).Distinct().Count() != choices.Length)
                        throw new ArgumentException("开局设置无效或重复。");
                    return choices.OrderBy(x => x.id, StringComparer.Ordinal).ToArray();
                }
                request = request with { options = request.options with { quality = Normalize(request.options.quality), stories = Normalize(request.options.stories), mixing = Normalize(request.options.mixing) } };
            }
            request = request with { coordinate = request.coordinate ?? "", dlcIds = request.dlcIds.Distinct().Order(StringComparer.Ordinal).ToArray() };
        }
        catch (Exception error) { return Results.BadRequest(new { message = error.Message }); }
        string key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(engine.EngineId + JsonSerializer.Serialize(request)))).ToLowerInvariant();
        string index = Path.Combine(engine.DataDirectory, "cache", key + ".json");
        try
        {
            string id = JsonSerializer.Deserialize<string>(await File.ReadAllTextAsync(index))!;
            if (id.Length == 32 && id.All(Uri.IsHexDigit))
            {
                var cached = new Job(id, Path.Combine(engine.DataDirectory, "jobs", id), key);
                if ((await Progress(cached)).GetValueOrDefault("status")?.ToString() == "complete" && new FileInfo(Path.Combine(cached.Directory, "generated.sav")).Length > 1024)
                { jobs.TryAdd(id, cached); return Results.Json(await Progress(cached, true)); }
            }
        }
        catch (Exception error) when (error is IOException or JsonException or UnauthorizedAccessException) { }
        if (!gate.Wait(0)) return Results.Conflict(new { message = "演算器正在处理另一个种子，请等待当前任务完成。" });
        var job = new Job(Guid.NewGuid().ToString("N"), "", key);
        job = job with { Directory = Path.Combine(engine.DataDirectory, "jobs", job.Id) };
        jobs.TryAdd(job.Id, job);
        _ = Task.Run(() => RunJob(job, request, index));
        return Results.Json(new { id = job.Id, status = "starting", engineId = engine.EngineId }, statusCode: 202);
    }
    async Task RunJob(Job job, SeedRequest request, string index)
    {
        Message?.Invoke("开始演算：" + (request.coordinate.Length > 0 ? request.coordinate : request.seed.ToString()));
        try
        {
            var result = await engine.Generate(request, job.Directory, cancellation: lifetime.Token);
            var progress = await Progress(job);
            if (progress.GetValueOrDefault("status")?.ToString() == "complete" && File.Exists(Path.Combine(job.Directory, "generated.sav")))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(index)!);
                await File.WriteAllTextAsync(index + ".tmp", JsonSerializer.Serialize(job.Id));
                File.Move(index + ".tmp", index, true);
                Message?.Invoke("演算完成，网页可以读取地图与间歇泉统计。");
            }
            else
            {
                string message = "游戏运行时退出（" + result.exitCode + "）。请检查任务日志；若使用 Steam 版，请确认 Steam 已登录。";
                if (progress.GetValueOrDefault("status")?.ToString() != "failed") await Fail(job, message);
                Message?.Invoke("演算失败。日志：" + Path.Combine(job.Directory, "engine.log"));
            }
        }
        catch (Exception error) { await Fail(job, error is OperationCanceledException ? "演算已停止或超时。" : error.Message); Message?.Invoke(error.Message); }
        finally
        {
            gate.Release();
            // Each seed has a fresh native world. Preload the next isolated process
            // while the player inspects this result, instead of retaining Sim state.
            if (!lifetime.IsCancellationRequested)
                _ = Task.Run(async () => { try { await engine.Warmup(request.dlcIds, lifetime.Token); } catch (Exception e) { Message?.Invoke(e.Message); } });
        }
    }
    static async Task Fail(Job job, string message)
    {
        Directory.CreateDirectory(job.Directory);
        await File.WriteAllTextAsync(Path.Combine(job.Directory, "progress.json"), JsonSerializer.Serialize(new { status = "failed", message }));
    }
    async Task<Dictionary<string, object?>> Progress(Job job, bool cached = false)
    {
        Dictionary<string, object?> result;
        try { result = JsonSerializer.Deserialize<Dictionary<string, object?>>(await File.ReadAllTextAsync(Path.Combine(job.Directory, "progress.json")))!; }
        catch (Exception error) when (error is IOException or JsonException) { result = new() { ["status"] = "starting", ["message"] = "正在启动安装版游戏运行时…" }; }
        result["id"] = job.Id; result["engineId"] = engine.EngineId; result["nativeRuntime"] = true;
        if (cached) result["cached"] = true;
        return result;
    }
    public async ValueTask DisposeAsync()
    {
        lifetime.Cancel();
        engine.Dispose();
        if (app != null) await app.DisposeAsync();
        lifetime.Dispose();
    }
}
