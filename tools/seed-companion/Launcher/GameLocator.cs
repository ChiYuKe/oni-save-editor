using Microsoft.Win32;
using System.Text.RegularExpressions;
namespace OniSeedCompanion;
public static class GameLocator
{
    public static string? Find()
    {
        var roots = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
        if (key?.GetValue("SteamPath") is string value) roots.Add(value);
        foreach (var drive in DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType == DriveType.Fixed))
            foreach (var folder in new[] { "Steam", "SteamLibrary", @"Program Files (x86)\Steam", @"Program Files\Steam" }) roots.Add(Path.Combine(drive.RootDirectory.FullName, folder));
        foreach (var root in roots.ToArray())
        {
            var library = Path.Combine(root, "steamapps/libraryfolders.vdf");
            if (!File.Exists(library)) continue;
            foreach (Match match in Regex.Matches(File.ReadAllText(library), "\"path\"\\s+\"([^\"]+)\"")) roots.Add(match.Groups[1].Value.Replace(@"\\", @"\"));
        }
        foreach (var root in roots)
        {
            string game = Path.Combine(root, "steamapps/common/OxygenNotIncluded");
            if (File.Exists(Path.Combine(game, "OxygenNotIncluded.exe"))) return game;
        }
        return null;
    }
}
