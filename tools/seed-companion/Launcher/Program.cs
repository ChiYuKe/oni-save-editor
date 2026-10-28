using System.Text.Json;
namespace OniSeedCompanion;
public static class Program
{
    [STAThread]
    public static int Main(string[] args)
    {
        if (args.Length > 0 && !args.Contains("--gui")) return Command(args).GetAwaiter().GetResult();
        using var single = new Mutex(true, "Local\\OniSeedCompanion", out bool first);
        if (!first) { MessageBox.Show("种子演算器已经在运行。", "缺氧种子演算器"); return 0; }
        string? Value(string key) => args.SkipWhile(x => x != key).Skip(1).FirstOrDefault();
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm(Value("--game"), Value("--data"), int.TryParse(Value("--port"), out int port) ? port : 5191));
        return 0;
    }
    static async Task<int> Command(string[] args)
    {
        string Arg(string key, string fallback = "") => args.SkipWhile(x => x != key).Skip(1).FirstOrDefault() ?? fallback;
        try
        {
            using var engine = new NativeEngine(Arg("--game", GameLocator.Find() ?? ""), Arg("--data", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OniSeedCompanion")), Arg("--worker", Path.Combine(AppContext.BaseDirectory, "OniSeedWorker.dll")));
            engine.Message += Console.WriteLine; await engine.Prepare();
            if (args.Contains("--prepare-only")) return 0;
            if (args.Contains("--serve"))
            {
                await using var server = new CompanionServer(engine, int.Parse(Arg("--port", "5191"))); server.Message += Console.WriteLine; await server.Start();
                using var stop = new CancellationTokenSource();
                Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };
                try { await Task.Delay(Timeout.Infinite, stop.Token); } catch (OperationCanceledException) { }
                return 0;
            }
            var request = JsonSerializer.Deserialize<SeedRequest>(File.ReadAllText(Arg("--request")))!;
            var result = await engine.Generate(request, Arg("--output"), args.Contains("--graphics"));
            Console.WriteLine(JsonSerializer.Serialize(new { result.directory, result.exitCode })); return result.exitCode;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
