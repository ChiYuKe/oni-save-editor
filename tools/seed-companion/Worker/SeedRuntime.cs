using System;
using System.IO;
using System.Linq;
using ProcGen;
using ProcGenGame;
using Klei.CustomSettings;
using Path = System.IO.Path;
using UnityEngine;

// Runs the game's own generator. No terrain, template or geyser algorithms are reimplemented.
public sealed class SeedRuntime : MonoBehaviour
{
    [Serializable] public class Request
    {
        public int seed;
        public string coordinate;
        public string cluster;
        public string[] dlcIds;
        public string outputDirectory;
    }
    [Serializable] public class Progress
    {
        public string status;
        public string message;
        public string coordinate;
        public string[] dlcIds;
        public int worldCount;
        public string savePath;
        public string unityVersion;
    }
    [Serializable] public class NativeGeyser
    {
        public string typeId;
        public float x, y, emitRate, eruptDuration, idleDuration, activeDuration, dormantDuration, temperature;
    }
    [Serializable] public class NativeSnapshot
    {
        public string coordinate;
        public NativeGeyser[] geysers;
    }
    static Request request;
    static Cluster cluster;
    static int step, readyFrames;
    static double started;
    static string error;
    static bool spawned;
    static string resolvedCoordinate;
    static bool booted;
    public static string IsolatedRoot() => Environment.GetEnvironmentVariable("ONI_SEED_ENGINE_ROOT");
    public static bool ExcludedDlc(string id)
    {
        string selection = Environment.GetEnvironmentVariable("ONI_SEED_ENGINE_DLCS");
        return selection != null && !string.IsNullOrEmpty(id) && !selection.Split(',').Contains(id);
    }
    // Invoked before the native LaunchInitializer starts. Only our own runtime copy is patched.
    public static void Bootstrap()
    {
        if (booted) return;
        booted = true;
        string requestPath = Environment.GetEnvironmentVariable("ONI_SEED_ENGINE_REQUEST");
        if (string.IsNullOrEmpty(requestPath)) { Application.Quit(64); return; }
        try
        {
            request = JsonUtility.FromJson<Request>(File.ReadAllText(requestPath));
            if (request.dlcIds == null || string.IsNullOrEmpty(request.outputDirectory)) throw new ArgumentException("Invalid seed request");
            request.outputDirectory = Path.GetFullPath(request.outputDirectory);
            Directory.CreateDirectory(request.outputDirectory);
            if (Path.GetFullPath(IsolatedRoot()) != Path.Combine(request.outputDirectory, "engine-data"))
                throw new ArgumentException("Worker output isolation is missing");
            Directory.CreateDirectory(IsolatedRoot());
            Application.runInBackground = true;
            Application.targetFrameRate = 60;
            var host = new GameObject("ONI Seed Companion Worker");
            UnityEngine.Object.DontDestroyOnLoad(host);
            host.AddComponent<SeedRuntime>();
            started = Time.realtimeSinceStartup;
            Write("starting", "Starting installed game's native runtime");
        }
        catch (Exception exception)
        {
            Debug.LogException(exception);
            if (request != null && !string.IsNullOrEmpty(request.outputDirectory)) Write("failed", exception.ToString());
            Application.Quit(1);
        }
    }
    void Update() { Tick(); }
    static void Write(string status, string message, string savePath = null)
    {
        var progress = new Progress {status = status, message = message,
            coordinate = resolvedCoordinate ?? request.coordinate,
            dlcIds = request.dlcIds, worldCount = cluster == null ? 0 : cluster.worlds.Count,
            savePath = savePath, unityVersion = Application.unityVersion};
        string path = Path.Combine(request.outputDirectory, "progress.json");
        File.WriteAllText(path + ".tmp", JsonUtility.ToJson(progress, true));
        File.Copy(path + ".tmp", path, true);
    }
    static void Tick()
    {
        if (step == 99) return;
        try
        {
            if (Time.realtimeSinceStartup - started > 1200) throw new TimeoutException("Native engine timed out after 20 minutes");
            if (error != null) throw new InvalidOperationException(error);
            if (step == 0)
            {
                if (MainMenu.Instance == null || CustomGameSettings.Instance == null) return;
                WorldGen.WaitForPendingLoadSettings();
                var actual = DlcManager.GetActiveDLCIds().Where(x => !string.IsNullOrEmpty(x)).OrderBy(x => x).ToArray();
                var expected = request.dlcIds.Where(x => !string.IsNullOrEmpty(x)).OrderBy(x => x).ToArray();
                if (!actual.SequenceEqual(expected)) throw new InvalidOperationException("DLC mismatch. Engine: " + string.Join(",", actual) + "; requested: " + string.Join(",", expected));
                var settings = CustomGameSettings.Instance;
                settings.LoadClusters(); settings.SetSurvivalDefaults(); settings.DisableAllStories(); settings.DisableAllMixing();
                string clusterId = request.cluster;
                int seed = request.seed;
                string[] parts = null;
                if (!string.IsNullOrWhiteSpace(request.coordinate))
                {
                    parts = CustomGameSettings.ParseSettingCoordinate(request.coordinate);
                    if (parts.Length < 4 || parts.Length > 6 || !int.TryParse(parts[2], out seed)) throw new ArgumentException("Invalid game coordinate");
                    var matches = SettingsCache.clusterLayouts.clusterCache.Where(x => x.Value.coordinatePrefix == parts[1]).ToArray();
                    if (matches.Length != 1) throw new ArgumentException("Coordinate prefix is unavailable or ambiguous for this DLC configuration");
                    clusterId = matches[0].Key;
                }
                if (seed <= 0 || !SettingsCache.clusterLayouts.clusterCache.ContainsKey(clusterId ?? "")) throw new ArgumentException("A positive seed and an available cluster are required");
                if (!DlcManager.IsCorrectDlcSubscribed(SettingsCache.clusterLayouts.clusterCache[clusterId]))
                    throw new ArgumentException("The selected cluster requires a different DLC configuration");
                settings.SetQualitySetting(CustomGameSettingConfigs.ClusterLayout, clusterId);
                settings.SetQualitySetting(CustomGameSettingConfigs.WorldgenSeed, seed.ToString(System.Globalization.CultureInfo.InvariantCulture));
                if (parts != null)
                {
                    settings.ParseAndApplySettingsCode(parts[3]);
                    settings.ParseAndApplyStoryTraitSettingsCode(parts.Length >= 5 ? parts[4] : "0");
                    settings.ParseAndApplyMixingSettingsCode(parts.Length >= 6 ? parts[5] : "0");
                }
                resolvedCoordinate = settings.GetSettingsCoordinate();
                var stories = settings.GetCurrentStories().Select(x => Db.Get().Stories.Get(x).worldgenStoryTraitKey).ToList();
                cluster = new Cluster(clusterId, seed, stories, true, false);
                SaveLoader.SetActiveSaveFilePath(null);
                Write("generating", "Native cluster generation, templates and SimDLL settling");
                cluster.Generate((key, fraction, stage) => error == null,
                    info => error = info.errorDesc + " " + info.exception, seed, seed, seed, seed);
                step = 1;
            }
            else if (step == 1 && cluster.HasGenerationStopped)
            {
                cluster.Join();
                if (cluster.Status != Cluster.WorldGenStatus.Complete) throw new InvalidOperationException("Native world generation failed");
                Write("spawning", "Loading generated worlds and native geyser configurations");
                App.LoadScene("backend"); step = 2;
            }
            else if (step == 2)
            {
                if (Game.Instance == null || SaveGame.Instance == null || ClusterManager.Instance == null || SaveGame.Instance.worldGenSpawner == null) return;
                if (++readyFrames < 120) return;
                if (!spawned)
                {
                    foreach (WorldContainer world in ClusterManager.Instance.WorldContainers)
                        world.SetDiscovered(reveal_surface: true);
                    SaveGame.Instance.worldGenSpawner.SpawnEverything();
                    spawned = true; readyFrames = 0; return;
                }
                string path = Path.Combine(request.outputDirectory, "generated.sav");
                var snapshot = new NativeSnapshot { coordinate = resolvedCoordinate,
                    geysers = UnityEngine.Object.FindObjectsByType<Geyser>(FindObjectsSortMode.None)
                    .Where(g => g.configuration != null).Select(g => new NativeGeyser {
                        typeId = g.configuration.geyserType.id,
                        x = g.transform.position.x, y = g.transform.position.y,
                        emitRate = g.configuration.GetEmitRate(),
                        eruptDuration = g.configuration.GetOnDuration(), idleDuration = g.configuration.GetOffDuration(),
                        activeDuration = g.configuration.GetYearOnDuration(), dormantDuration = g.configuration.GetYearOffDuration(),
                        temperature = g.configuration.GetTemperature()
                    }).ToArray() };
                File.WriteAllText(Path.Combine(request.outputDirectory, "native-geysers.json"), JsonUtility.ToJson(snapshot, true));
                SaveLoader.Instance.Save(path, false, false);
                if (!File.Exists(path) || new FileInfo(path).Length < 1024) throw new IOException("Native save export failed");
                Write("complete", "Generated by the native game engine", path);
                Finish(0);
            }
        }
        catch (Exception exception) { Debug.LogException(exception); try { Write("failed", exception.ToString()); } finally { Finish(1); } }
    }
    static void Finish(int code)
    {
        step = 99;
        Application.Quit(code);
    }
}
