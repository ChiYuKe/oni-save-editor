using System.Diagnostics;
using System.Text.Json;
namespace OniSeedCompanion;
public sealed class MainForm : Form
{
    readonly TextBox game = new() { Dock = DockStyle.Fill };
    readonly RichTextBox log = new() { Dock = DockStyle.Fill, ReadOnly = true, BorderStyle = BorderStyle.None };
    readonly Button start = new() { Text = "启动演算器", AutoSize = true };
    readonly Button browse = new() { Text = "选择目录", AutoSize = true };
    readonly string data;
    readonly int port;
    CompanionServer? server;
    readonly CancellationTokenSource lifetime = new();
    public MainForm(string? initialGame = null, string? dataDirectory = null, int listenPort = 5191)
    {
        data = Path.GetFullPath(dataDirectory ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OniSeedCompanion"));
        port = listenPort;
        Text = "缺氧 · 种子演算器（预览版）"; Width = 760; Height = 490; MinimumSize = new Size(600, 380);
        BackColor = Color.FromArgb(18, 18, 18); ForeColor = Color.FromArgb(232, 232, 232); Font = new Font("Microsoft YaHei UI", 10);
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24), ColumnCount = 1, RowCount = 6 };
        foreach (int height in new[] { 42, 52, 45, 50, 42 }) layout.RowStyles.Add(new RowStyle(SizeType.Absolute, height));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); Controls.Add(layout);
        layout.Controls.Add(new Label { Text = "缺氧种子演算器", Font = new Font(Font.FontFamily, 20, FontStyle.Bold), AutoSize = true });
        layout.Controls.Add(new Label { Text = "读取已安装游戏的原生生成逻辑，无需 Unity 编辑器或手动安装模组。\n首次需要准备独立运行副本；游戏原目录和已有存档不作修改。", AutoSize = true });
        var picker = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 }; picker.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); picker.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        picker.Controls.Add(game); picker.Controls.Add(browse); layout.Controls.Add(picker);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill };
        var website = new Button { Text = "打开网页", AutoSize = true }; var cache = new Button { Text = "打开任务目录", AutoSize = true };
        actions.Controls.AddRange([start, website, cache]); layout.Controls.Add(actions);
        layout.Controls.Add(new Label { Text = "仅监听本机 127.0.0.1:" + port + "。保持此窗口打开，网页即可提交种子。", AutoSize = true });
        layout.Controls.Add(log); log.BackColor = Color.FromArgb(26, 26, 26); log.ForeColor = ForeColor;
        game.BackColor = Color.FromArgb(32, 32, 32); game.ForeColor = ForeColor; game.BorderStyle = BorderStyle.FixedSingle;
        foreach (var button in new[] { start, browse, website, cache }) { button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderColor = Color.FromArgb(55, 55, 55); button.BackColor = Color.FromArgb(34, 34, 34); button.ForeColor = ForeColor; button.Padding = new Padding(6); }
        start.BackColor = Color.FromArgb(202, 55, 65);
        game.Text = initialGame ?? GameLocator.Find() ?? "";
        string settings = Path.Combine(data, "settings.json");
        try { if (File.Exists(settings)) game.Text = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(settings))?.GetValueOrDefault("gameDirectory") ?? game.Text; } catch (Exception error) when (error is IOException or JsonException) { }
        browse.Click += (_, _) => { using var dialog = new FolderBrowserDialog { Description = "选择包含 OxygenNotIncluded.exe 的游戏目录", InitialDirectory = game.Text }; if (dialog.ShowDialog(this) == DialogResult.OK) game.Text = dialog.SelectedPath; };
        start.Click += async (_, _) => await StartEngine();
        website.Click += (_, _) => Open("https://chiyuke.github.io/oni-save-editor/?seedCompanion=1");
        cache.Click += (_, _) => { Directory.CreateDirectory(data); Open(data); };
        FormClosing += async (_, e) =>
        {
            lifetime.Cancel();
            if (server == null) return;
            e.Cancel = true; Enabled = false;
            var closing = server; server = null;
            await closing.DisposeAsync(); Close();
        };
        Shown += async (_, _) => { if (Directory.Exists(game.Text)) await StartEngine(); else Append("请选择《缺氧》安装目录，然后启动演算器。"); };
    }
    static void Open(string path) => Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
    void Append(string text)
    {
        if (IsDisposed || Disposing) return;
        if (InvokeRequired) { BeginInvoke(() => Append(text)); return; }
        log.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  " + text + Environment.NewLine); log.ScrollToCaret();
    }
    async Task StartEngine()
    {
        start.Enabled = browse.Enabled = game.Enabled = false;
        try
        {
            var engine = new NativeEngine(game.Text, data, Path.Combine(AppContext.BaseDirectory, "OniSeedWorker.dll")); engine.Message += Append;
            await Task.Run(() => engine.Prepare(lifetime.Token));
            server = new CompanionServer(engine, port); server.Message += Append; await server.Start();
            Directory.CreateDirectory(data); File.WriteAllText(Path.Combine(data, "settings.json"), JsonSerializer.Serialize(new { gameDirectory = game.Text }));
            start.Text = "演算器运行中";
        }
        catch (Exception error)
        {
            if (server != null) { await server.DisposeAsync(); server = null; }
            Append("启动失败：" + error.Message); start.Enabled = browse.Enabled = game.Enabled = true;
        }
    }
}
