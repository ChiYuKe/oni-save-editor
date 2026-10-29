using System.Diagnostics;
using System.Text.Json;

namespace OniSeedCompanion;

// A shared lease protects a runtime even while its owner is idle or preloading.
internal sealed class RuntimeCache : IDisposable
{
    readonly string root, current;
    readonly FileStream lease;
    public RuntimeCache(string root, string engineId)
    {
        if (!IsId(engineId)) throw new ArgumentException("Invalid engine ID");
        this.root = Path.GetFullPath(root);
        current = engineId;
        Directory.CreateDirectory(this.root);
        lease = new FileStream(Path.Combine(this.root, engineId + ".in-use"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.ReadWrite);
    }
    static bool IsId(string name) => name.Length == 64 && name.All(Uri.IsHexDigit);
    public void Prune(Action<string>? message, CancellationToken cancellation)
    {
        if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) return;
        foreach (string directory in Directory.EnumerateDirectories(root))
        {
            cancellation.ThrowIfCancellationRequested();
            string name = Path.GetFileName(directory);
            if (name.Equals(current, StringComparison.OrdinalIgnoreCase) || !IsId(name)) continue;
            try
            {
                // The exclusive lease also prevents a new owner from opening this runtime.
                using var unused = new FileStream(Path.Combine(root, name + ".in-use"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
                if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) continue;
                using var marker = JsonDocument.Parse(File.ReadAllText(Path.Combine(directory, "companion-ready.json")));
                if (!marker.RootElement.TryGetProperty("EngineId", out var id) || id.GetString() != name) continue;
                // Older launchers have no lease: also check their native game process.
                if (HasRunningEngine(directory)) continue;
                DeleteTree(directory);
                message?.Invoke("已清理过期运行副本：" + name[..12]);
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException) { }
        }
    }
    static bool HasRunningEngine(string directory)
    {
        foreach (var process in Process.GetProcessesByName("OxygenNotIncluded"))
        {
            using (process)
            {
                try
                {
                    string? executable = process.MainModule?.FileName;
                    if (executable == null || executable.StartsWith(directory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return true;
                }
                catch (InvalidOperationException) { }
                catch (System.ComponentModel.Win32Exception) { return true; }
            }
        }
        return false;
    }
    internal static void DeleteTree(string directory)
    {
        if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) { Directory.Delete(directory); return; }
        foreach (string file in Directory.EnumerateFiles(directory)) File.Delete(file);
        foreach (string child in Directory.EnumerateDirectories(directory)) DeleteTree(child);
        Directory.Delete(directory);
    }
    public void Dispose() => lease.Dispose();
}
