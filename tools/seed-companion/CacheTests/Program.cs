using System.Text.Json;
using OniSeedCompanion;

string fixture = Path.Combine(Path.GetTempPath(), "oni-runtime-cache-test-" + Guid.NewGuid().ToString("N"));
string root = Path.Combine(fixture, "runtimes");
Directory.CreateDirectory(root);
string Id(char value) => new(value, 64);
string Runtime(char value, bool valid = true)
{
    string path = Path.Combine(root, Id(value)); Directory.CreateDirectory(path);
    File.WriteAllText(Path.Combine(path, "companion-ready.json"), JsonSerializer.Serialize(new { EngineId = valid ? Id(value) : Id('0') }));
    File.WriteAllText(Path.Combine(path, "payload.bin"), "runtime resources");
    return path;
}
void Assert(bool value, string label) { if (!value) throw new Exception(label); Console.WriteLine("PASS " + label); }
try
{
    string current = Runtime('a'), old = Runtime('b'), active = Runtime('c'), invalid = Runtime('d', false);
    string unknown = Path.Combine(root, "user-files"), staging = Path.Combine(root, Id('e') + ".preparing-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(unknown); Directory.CreateDirectory(staging);
    string incomplete = Path.Combine(root, Id('f')); Directory.CreateDirectory(incomplete);
    using var cache = new RuntimeCache(root, Id('a'));
    using (var other = new RuntimeCache(root, Id('c')))
    {
        cache.Prune(null, default);
        Assert(!Directory.Exists(old), "obsolete completed runtime removed");
        Assert(Directory.Exists(current), "current runtime preserved");
        Assert(Directory.Exists(active), "leased runtime preserved even without a native process");
        Assert(Directory.Exists(invalid) && Directory.Exists(unknown) && Directory.Exists(staging) && Directory.Exists(incomplete), "unrecognized and incomplete directories preserved");
    }
    cache.Prune(null, default);
    Assert(!Directory.Exists(active), "released runtime removed on next prune");
    old = Runtime('b');
    using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
    try { cache.Prune(null, cancelled.Token); throw new Exception("Cancellation ignored"); } catch (OperationCanceledException) { }
    Assert(Directory.Exists(old), "cancellation prevents deletion");
    string outside = Path.Combine(fixture, "outside"); Directory.CreateDirectory(outside); File.WriteAllText(Path.Combine(outside,"keep.txt"),"keep");
    try
    {
        Directory.CreateSymbolicLink(Path.Combine(old,"linked"), outside);
        cache.Prune(null, default);
        Assert(File.Exists(Path.Combine(outside,"keep.txt")), "nested links do not delete external files");
        Directory.CreateSymbolicLink(Path.Combine(root, Id('b')), outside);
        cache.Prune(null, default);
        Assert(Directory.Exists(Path.Combine(root,Id('b'))) && File.Exists(Path.Combine(outside,"keep.txt")), "linked runtime roots skipped");
    }
    catch (UnauthorizedAccessException) { Console.WriteLine("SKIP symbolic link test: system privilege unavailable"); }
}
finally
{
    if (!Path.GetFullPath(fixture).StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase)) throw new Exception("Unsafe test cleanup path");
    RuntimeCache.DeleteTree(fixture);
}
