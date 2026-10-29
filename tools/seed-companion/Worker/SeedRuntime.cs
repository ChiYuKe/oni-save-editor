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
        public GenerationOptions options;
    }
    [Serializable] public class Choice { public string id, value; }
    [Serializable] public class GenerationOptions
    {
        public string mode;
        public Choice[] quality, stories, mixing;
    }
    [Serializable] public class Level { public string id, label; }
    [Serializable] public class Setting
    {
        public string id, label, tooltip, survivalDefault, nosweatDefault;
        public Level[] levels;
    }
    [Serializable] public class Catalog
    {
        public bool ready = true;
        public string[] dlcIds;
        public Setting[] quality, stories, mixing;
    }
    [Serializable] public class NativeWorld { public int id, x, y, width, height; public string source; }
    static bool Editable(SettingConfig config) => config.id != "WorldgenSeed" && config.id != "ClusterLayout" && config.id != "SaveToCloud" && !config.debug_only && config.ShowInUI();
    static Setting Describe(SettingConfig config) => new Setting {
        id = config.id, label = config.label, tooltip = config.tooltip,
        survivalDefault = config.GetDefaultLevelId(), nosweatDefault = config.GetNoSweatDefaultLevelId(),
        levels = config.GetLevels().Select(level => new Level { id = level.id, label = level.label }).ToArray()
    };
    static Setting DescribeStory(SettingConfig config)
    {
        var result = Describe(config);
        var story = Db.Get().Stories.Get(config.id);
        result.label = Strings.Get(story.StoryTrait.name);
        result.tooltip = Strings.Get(story.StoryTrait.description);
        return result;
    }
    static void LocalizeCatalog(Catalog catalog)
    {
        string path = Localization.GetPreinstalledLocalizationFilePath("zh_klei");
        if (!File.Exists(path)) return;
        var english = Localization.LoadStringsFile(path, true);
        var chinese = Localization.LoadStringsFile(path, false);
        var translations = new System.Collections.Generic.Dictionary<string, string>();
        foreach (var pair in english)
        {
            string translated;
            if (!string.IsNullOrEmpty(pair.Value) && chinese.TryGetValue(pair.Key, out translated) && !string.IsNullOrEmpty(translated)) translations[pair.Value] = translated;
        }
        Func<string, string> translate = text => text != null && translations.ContainsKey(text) ? translations[text] : text;
        foreach (var setting in catalog.quality.Concat(catalog.stories).Concat(catalog.mixing))
        {
            setting.label = translate(setting.label); setting.tooltip = translate(setting.tooltip);
            foreach (var level in setting.levels) level.label = translate(level.label);
        }
    }
    static void ExportCatalog()
    {
        string path = Path.Combine(sessionDirectory, "settings.json");
        if (File.Exists(path)) return;
        var settings = CustomGameSettings.Instance;
        var catalog = new Catalog {
            dlcIds = DlcManager.GetActiveDLCIds().Where(x => !string.IsNullOrEmpty(x)).OrderBy(x => x).ToArray(),
            quality = settings.QualitySettings.Values.Where(Editable).Select(Describe).ToArray(),
            stories = settings.StorySettings.Values.Where(Editable).Select(DescribeStory).ToArray(),
            mixing = settings.MixingSettings.Values.Where(Editable).Select(Describe).ToArray()
        };
        LocalizeCatalog(catalog);
        File.WriteAllText(path + ".tmp", JsonUtility.ToJson(catalog, true));
        File.Move(path + ".tmp", path);
    }
    static void ApplyChoices(Choice[] choices, System.Collections.Generic.Dictionary<string, SettingConfig> configs, Action<SettingConfig, string> apply)
    {
        if (choices == null) return;
        foreach (var choice in choices)
        {
            SettingConfig config;
            if (choice == null || !configs.TryGetValue(choice.id, out config) || !Editable(config) || !config.GetLevels().Any(x => x.id == choice.value))
                throw new ArgumentException("Invalid or unavailable game setting: " + (choice == null ? "null" : choice.id + "=" + choice.value));
            apply(config, choice.value);
        }
    }
    static Choice[] Capture(System.Collections.Generic.Dictionary<string, SettingConfig> configs, Func<SettingConfig, SettingLevel> read) =>
        configs.Values.Where(Editable).Select(config => new Choice { id = config.id, value = read(config).id }).ToArray();
    static GenerationOptions CaptureOptions(CustomGameSettings settings) => new GenerationOptions {
        mode = settings.customGameMode.ToString(),
        quality = Capture(settings.QualitySettings, settings.GetCurrentQualitySetting),
        stories = Capture(settings.StorySettings, settings.GetCurrentStoryTraitSetting),
        mixing = Capture(settings.MixingSettings, settings.GetCurrentMixingSettingLevel)
    };
    static void CheckApplied(Choice[] expected, Choice[] actual)
    {
        if (expected == null) return;
        foreach (var choice in expected)
            if (!actual.Any(x => x.id == choice.id && x.value == choice.value))
                throw new ArgumentException("Game rejected setting for this cluster/DLC combination: " + choice.id + "=" + choice.value);
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
        public float generationSeconds, exportSeconds;
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
        public NativeWorld[] worlds;
        public GenerationOptions appliedOptions;
        public string unityVersion;
    }
    static Request request;
    static Cluster cluster;
    static int step, readyFrames;
    static double started;
    static string error;
    static bool spawned;
    static string resolvedCoordinate;
    static bool booted;
    static string sessionDirectory;
    static double phaseStarted;
    static float generationSeconds;
    static string sessionStatus;
    [Serializable] public class WorkerStatus { public string status; public string message; }
    static void SessionStatus(string status, string message)
    {
        if (sessionDirectory == null || sessionStatus == status) return;
        sessionStatus = status;
        string path = Path.Combine(sessionDirectory, "worker-status.json");
        File.WriteAllText(path + ".tmp", JsonUtility.ToJson(new WorkerStatus { status = status, message = message }));
        File.Copy(path + ".tmp", path, true);
    }
    static bool MenuReady() => MainMenu.Instance != null && CustomGameSettings.Instance != null && Game.Instance == null && !App.isLoading;
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
            sessionDirectory = Environment.GetEnvironmentVariable("ONI_SEED_ENGINE_SESSION");
            if (!string.IsNullOrEmpty(sessionDirectory))
            {
                sessionDirectory = Path.GetFullPath(sessionDirectory);
                if (Path.GetFullPath(IsolatedRoot()) != Path.Combine(sessionDirectory, "engine-data")) throw new ArgumentException("Session isolation is missing");
                step = -1;
                SessionStatus("starting", "Loading native game resources");
            }
            else request = JsonUtility.FromJson<Request>(File.ReadAllText(requestPath));
            if (sessionDirectory == null && (request.dlcIds == null || string.IsNullOrEmpty(request.outputDirectory))) throw new ArgumentException("Invalid seed request");
            if (sessionDirectory == null)
            {
                request.outputDirectory = Path.GetFullPath(request.outputDirectory);
                Directory.CreateDirectory(request.outputDirectory);
                if (Path.GetFullPath(IsolatedRoot()) != Path.Combine(request.outputDirectory, "engine-data"))
                    throw new ArgumentException("Worker output isolation is missing");
            }
            Directory.CreateDirectory(IsolatedRoot());
            Application.runInBackground = true;
            Application.targetFrameRate = sessionDirectory == null ? 60 : 15;
            var host = new GameObject("ONI Seed Companion Worker");
            UnityEngine.Object.DontDestroyOnLoad(host);
            host.AddComponent<SeedRuntime>();
            started = Time.realtimeSinceStartup;
            if (request != null) Write("starting", "Starting installed game's native runtime");
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
            savePath = savePath, unityVersion = Application.unityVersion, generationSeconds = generationSeconds,
            exportSeconds = step == 2 ? (float)(Time.realtimeSinceStartup - phaseStarted) : 0};
        string path = Path.Combine(request.outputDirectory, "progress.json");
        File.WriteAllText(path + ".tmp", JsonUtility.ToJson(progress, true));
        File.Copy(path + ".tmp", path, true);
    }
    static void Tick()
    {
        if (step == 99) return;
        try
        {
            if (step < 0)
            {
                if (!MenuReady()) return;
                ExportCatalog();
                SessionStatus("ready", "Native resources are loaded");
                string mailbox = Path.Combine(sessionDirectory, "next-request.json");
                if (!File.Exists(mailbox)) return;
                var next = JsonUtility.FromJson<Request>(File.ReadAllText(mailbox));
                string output = Path.GetFullPath(next.outputDirectory);
                string jobsRoot = Path.GetFullPath(Environment.GetEnvironmentVariable("ONI_SEED_ENGINE_JOBS")) + Path.DirectorySeparatorChar;
                if (!output.StartsWith(jobsRoot, StringComparison.OrdinalIgnoreCase) || File.Exists(Path.Combine(output, "generated.sav"))) throw new ArgumentException("Invalid job output");
                request = next; request.outputDirectory = output;
                File.Delete(mailbox);
                cluster = null; error = null; spawned = false; readyFrames = 0; resolvedCoordinate = null;
                generationSeconds = 0; started = Time.realtimeSinceStartup;
                step = 0; Application.targetFrameRate = 60; SessionStatus("busy", "Generating native seed");
            }
            if (Time.realtimeSinceStartup - started > 1200) throw new TimeoutException("Native engine timed out after 20 minutes");
            if (error != null) throw new InvalidOperationException(error);
            if (step == 0)
            {
                if (!MenuReady()) return;
                WorldGen.WaitForPendingLoadSettings();
                var actual = DlcManager.GetActiveDLCIds().Where(x => !string.IsNullOrEmpty(x)).OrderBy(x => x).ToArray();
                var expected = request.dlcIds.Where(x => !string.IsNullOrEmpty(x)).OrderBy(x => x).ToArray();
                if (!actual.SequenceEqual(expected)) throw new InvalidOperationException("DLC mismatch. Engine: " + string.Join(",", actual) + "; requested: " + string.Join(",", expected));
                var settings = CustomGameSettings.Instance;
                settings.LoadClusters(); settings.SetSurvivalDefaults(); settings.DisableAllStories(); settings.DisableAllMixing();
                if (request.options != null && string.IsNullOrWhiteSpace(request.coordinate))
                {
                    if (request.options.mode == "nosweat") settings.SetNosweatDefaults();
                    else if (request.options.mode != null && request.options.mode != "survival") throw new ArgumentException("Unknown game mode");
                }
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
                else if (request.options != null)
                {
                    ApplyChoices(request.options.quality, settings.QualitySettings, settings.SetQualitySetting);
                    ApplyChoices(request.options.stories, settings.StorySettings, settings.SetStorySetting);
                    ApplyChoices(request.options.mixing, settings.MixingSettings, settings.SetMixingSetting);
                    settings.RemoveInvalidMixingSettings();
                    var applied = CaptureOptions(settings);
                    CheckApplied(request.options.quality, applied.quality);
                    CheckApplied(request.options.stories, applied.stories);
                    CheckApplied(request.options.mixing, applied.mixing);
                }
                resolvedCoordinate = settings.GetSettingsCoordinate();
                var stories = settings.GetCurrentStories().Select(x => Db.Get().Stories.Get(x).worldgenStoryTraitKey).ToList();
                cluster = new Cluster(clusterId, seed, stories, true, false);
                SaveLoader.SetActiveSaveFilePath(null);
                Write("generating", "Native cluster generation, templates and SimDLL settling");
                phaseStarted = Time.realtimeSinceStartup;
                cluster.Generate((key, fraction, stage) => error == null,
                    info => error = info.errorDesc + " " + info.exception, seed, seed, seed, seed);
                step = 1;
            }
            else if (step == 1 && cluster.HasGenerationStopped)
            {
                cluster.Join();
                if (cluster.Status != Cluster.WorldGenStatus.Complete) throw new InvalidOperationException("Native world generation failed");
                generationSeconds = (float)(Time.realtimeSinceStartup - phaseStarted);
                phaseStarted = Time.realtimeSinceStartup;
                Write("spawning", "Loading generated worlds and native geyser configurations");
                App.LoadScene("backend"); step = 2;
            }
            else if (step == 2)
            {
                if (Game.Instance == null || SaveGame.Instance == null || ClusterManager.Instance == null || SaveGame.Instance.worldGenSpawner == null) return;
                // Wait for native scene/component readiness, not two fixed two-second sleeps.
                if (App.isLoading || !Game.Instance.isSpawned || !SaveGame.Instance.worldGenSpawner.isSpawned) return;
                if (!spawned)
                {
                    foreach (WorldContainer world in ClusterManager.Instance.WorldContainers)
                        world.SetDiscovered(reveal_surface: true);
                    SaveGame.Instance.worldGenSpawner.SpawnEverything();
                    spawned = true; readyFrames = 0; return;
                }
                if (++readyFrames < 3) return;
                var nativeGeysers = UnityEngine.Object.FindObjectsByType<Geyser>(FindObjectsSortMode.None);
                if (nativeGeysers.Any(g => !g.isSpawned || g.configuration == null)) return;
                string path = Path.Combine(request.outputDirectory, "generated.sav");
                var worlds = ClusterManager.Instance.WorldContainers.Where(w => !w.IsModuleInterior).ToArray();
                if (worlds.Length != cluster.worlds.Count || worlds.Any(w => w.Width <= 0 || w.Height <= 0)) throw new InvalidOperationException("Generated world count or dimensions are incomplete");
                var snapshot = new NativeSnapshot { coordinate = resolvedCoordinate,
                    unityVersion = Application.unityVersion, appliedOptions = CaptureOptions(CustomGameSettings.Instance),
                    worlds = worlds.Select(w => new NativeWorld { id = w.id, x = w.WorldOffset.x, y = w.WorldOffset.y, width = w.Width, height = w.Height, source = w.worldName }).ToArray(),
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
        SessionStatus(code == 0 ? "complete" : "failed", error ?? "Worker stopped");
        Application.Quit(code);
    }
}
