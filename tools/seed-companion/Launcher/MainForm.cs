using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;

namespace OniSeedCompanion;

public sealed class MainForm : Form
{
    readonly TextBox game = new() { Dock = DockStyle.Fill, BorderStyle = BorderStyle.None, BackColor = DesktopTheme.Input, ForeColor = DesktopTheme.Text };
    readonly RichTextBox log = new() { Dock = DockStyle.Fill, ReadOnly = true, BorderStyle = BorderStyle.None, BackColor = DesktopTheme.Surface, ForeColor = DesktopTheme.Text, DetectUrls = false, ScrollBars = RichTextBoxScrollBars.None };
    readonly DesktopButton start = new() { Text = "启动演算器", Width = 116 };
    readonly DesktopButton browse = new() { Text = "选择目录", Width = 96 };
    readonly DesktopButton website = new() { Text = "打开种子演算  →", Width = 170, Height = 42, Primary = true, Enabled = false };
    readonly DesktopButton cache = new() { Text = "任务文件夹  ↗", Dock = DockStyle.Fill, Margin = new Padding(0, 0, 0, 4) };
    readonly Label statusTitle = Label("等待连接", 17, bold: true);
    readonly Label statusDetail = Label("选择游戏目录，准备好后即可在网页中演算种子。", 9, muted: true);
    readonly Label statusBadge = Label("●  未启动", 9, muted: true);
    readonly Label footer = Label("", 8, muted: true);
    readonly string data;
    readonly int port;
    CompanionServer? server;
    NativeEngine? engine;
    bool starting, closing, connected;
    readonly CancellationTokenSource lifetime = new();
    static Label Label(string text, float size, bool bold = false, bool muted = false) => new()
    {
        Text = text, Dock = DockStyle.Fill, AutoEllipsis = true, TextAlign = ContentAlignment.MiddleLeft,
        ForeColor = muted ? DesktopTheme.Muted : DesktopTheme.Text, BackColor = Color.Transparent,
        Font = new Font("Microsoft YaHei UI", size, bold ? FontStyle.Bold : FontStyle.Regular), Margin = Padding.Empty
    };
    static TableLayoutPanel Rows(params float[] heights)
    {
        var panel = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = heights.Length, BackColor = Color.Transparent, Margin = Padding.Empty, Padding = Padding.Empty };
        foreach (float height in heights) panel.RowStyles.Add(height == 0 ? new RowStyle(SizeType.Percent, 100) : new RowStyle(SizeType.Absolute, height));
        return panel;
    }
    public MainForm(string? initialGame = null, string? dataDirectory = null, int listenPort = 5191)
    {
        data = Path.GetFullPath(dataDirectory ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OniSeedCompanion"));
        port = listenPort;
        Text = "缺氧 · 种子演算器"; ClientSize = new Size(860, 690); MinimumSize = new Size(780, 640);
        StartPosition = FormStartPosition.CenterScreen; AutoScaleDimensions = new SizeF(96, 96); AutoScaleMode = AutoScaleMode.Dpi;
        BackColor = DesktopTheme.Page; ForeColor = DesktopTheme.Text; Font = new Font("Microsoft YaHei UI", 9F);
        var layout = Rows(86, 144, 190, 0, 32); layout.Padding = new Padding(28, 18, 28, 10); Controls.Add(layout);

        var heading = Rows(22, 36, 24);
        var eyebrow = Label("ONI  /  NATIVE WORLD GENERATION", 8, muted: true);
        heading.Controls.Add(eyebrow); heading.Controls.Add(Label("缺氧种子演算器", 22, bold: true));
        heading.Controls.Add(Label("让游戏引擎生成世界，在网页中探索地图与资源。", 9, muted: true));
        layout.Controls.Add(heading);

        var statusCard = new DesktopCard { Dock = DockStyle.Fill, Margin = new Padding(0, 10, 0, 0) };
        var statusLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, BackColor = Color.Transparent, Margin = Padding.Empty };
        statusLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); statusLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 184));
        var state = Rows(22, 32, 38); state.Controls.Add(statusBadge); state.Controls.Add(statusTitle); state.Controls.Add(statusDetail);
        statusLayout.Controls.Add(state); website.Anchor = AnchorStyles.Right; statusLayout.Controls.Add(website); statusCard.Controls.Add(statusLayout); layout.Controls.Add(statusCard);

        var folderCard = new DesktopCard { Dock = DockStyle.Fill, Margin = new Padding(0, 10, 0, 0) };
        var folder = Rows(24, 22, 44, 0); folder.Controls.Add(Label("游戏安装目录", 10, bold: true));
        folder.Controls.Add(Label("选择包含 OxygenNotIncluded.exe 的文件夹", 8, muted: true));
        var picker = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Margin = Padding.Empty, BackColor = Color.Transparent };
        picker.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); picker.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 108));
        var input = new DesktopInput { Dock = DockStyle.Fill, Margin = new Padding(0, 0, 12, 0) }; input.Controls.Add(game);
        game.AccessibleName = "游戏安装目录"; picker.Controls.Add(input); browse.Dock = DockStyle.Fill; picker.Controls.Add(browse); folder.Controls.Add(picker);
        var folderBottom = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Margin = new Padding(0, 10, 0, 0), BackColor = Color.Transparent };
        folderBottom.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); folderBottom.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 116));
        folderBottom.Controls.Add(Label("独立运行副本 · 无需手动安装模组", 8, muted: true)); start.Dock = DockStyle.Fill; folderBottom.Controls.Add(start); folder.Controls.Add(folderBottom);
        folderCard.Controls.Add(folder); layout.Controls.Add(folderCard);

        var logCard = new DesktopCard { Dock = DockStyle.Fill, Margin = new Padding(0, 10, 0, 0) };
        var logs = Rows(34, 0);
        var logHeader = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Margin = Padding.Empty, BackColor = Color.Transparent };
        logHeader.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); logHeader.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 116));
        logHeader.Controls.Add(Label("运行记录", 10, bold: true));
        logHeader.Controls.Add(cache); logs.Controls.Add(logHeader); log.Margin = new Padding(0, 12, 0, 0); log.Font = new Font("Microsoft YaHei UI", 9F); log.TabStop = false;
        logs.Controls.Add(log); logCard.Controls.Add(logs); layout.Controls.Add(logCard);

        var bottom = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Margin = Padding.Empty, BackColor = Color.Transparent };
        bottom.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); bottom.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110));
        footer.Text = "仅本机连接  ·  127.0.0.1:" + port; bottom.Controls.Add(footer);
        var version = Label("PREVIEW  /  0.2.1", 8, muted: true); version.TextAlign = ContentAlignment.MiddleRight; bottom.Controls.Add(version); layout.Controls.Add(bottom);

        foreach (var strip in new[] { statusLayout, picker, folderBottom, logHeader, bottom })
        { strip.RowCount = 1; strip.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); }

        game.Text = initialGame ?? GameLocator.Find() ?? "";
        string settings = Path.Combine(data, "settings.json");
        try { if (initialGame == null && File.Exists(settings)) game.Text = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(settings))?.GetValueOrDefault("gameDirectory") ?? game.Text; }
        catch (Exception error) when (error is IOException or JsonException) { }
        browse.Click += (_, _) => { using var dialog = new FolderBrowserDialog { Description = "选择《缺氧》游戏安装目录", InitialDirectory = game.Text }; if (dialog.ShowDialog(this) == DialogResult.OK) game.Text = dialog.SelectedPath; };
        start.Click += async (_, _) => await StartEngine();
        website.Click += (_, _) => TryOpen("https://chiyuke.github.io/oni-save-editor/?seedCompanion=1");
        cache.Click += (_, _) => { try { Directory.CreateDirectory(data); TryOpen(data); } catch (Exception error) { Append("无法打开任务目录：" + error.Message, warning: true); } };
        FormClosing += async (_, e) =>
        {
            if (closing) return;
            closing = true; lifetime.Cancel();
            if (server == null) { engine?.Dispose(); return; }
            e.Cancel = true; Enabled = false;
            var owned = server; server = null;
            await owned.DisposeAsync(); Close();
        };
        Shown += async (_, _) => { if (Directory.Exists(game.Text)) await StartEngine(); else Append("选择游戏目录后，点击“启动演算器”。"); };
    }
    protected override void OnHandleCreated(EventArgs e) { base.OnHandleCreated(e); DesktopTheme.DarkTitleBar(Handle); }
    void TryOpen(string target)
    {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
        catch (Exception error) { Append("未能打开：" + error.Message, warning: true); }
    }
    void OnUi(Action action)
    {
        if (IsDisposed || Disposing || closing) return;
        if (InvokeRequired) { try { BeginInvoke(action); } catch (InvalidOperationException) { } return; }
        action();
    }
    void SetStatus(string title, string detail, string badge, Color color)
    {
        statusTitle.Text = title; statusDetail.Text = detail; statusBadge.Text = "●  " + badge; statusBadge.ForeColor = color;
    }
    void Append(string text, bool warning = false) => OnUi(() =>
    {
        if (log.TextLength > 60000) log.Clear();
        log.SelectionStart = log.TextLength; log.SelectionColor = DesktopTheme.Muted;
        log.AppendText(DateTime.Now.ToString("HH:mm:ss") + "    ");
        log.SelectionColor = warning ? DesktopTheme.Amber : DesktopTheme.Text;
        log.AppendText(text + Environment.NewLine + Environment.NewLine); log.ScrollToCaret();
    });
    void EngineMessage(string text)
    {
        Append(text);
        OnUi(() =>
        {
            if (starting) statusDetail.Text = text;
            else if (connected && text.Contains("预载")) SetStatus("正在提前准备引擎", "可以打开网页填写种子，资源正在后台加载。", "预载中", DesktopTheme.Amber);
        });
    }
    void ServerMessage(string text)
    {
        Append(text, text.Contains("失败"));
        OnUi(() =>
        {
            if (text.StartsWith("开始演算")) SetStatus("正在生成世界", "请在网页查看生成进度，完成后即可探索地图。", "演算中", DesktopTheme.Amber);
            else if (text.StartsWith("演算完成")) SetStatus("世界已生成", "地图与资源统计已准备好，返回网页继续查看。", "已就绪", DesktopTheme.Green);
            else if (text.Contains("演算失败")) SetStatus("本次演算未完成", "请在网页查看原因，或打开任务文件夹检查日志。", "需处理", DesktopTheme.Amber);
        });
    }
    async Task<bool> ExistingCompanion()
    {
        try
        {
            using var http = new HttpClient(new HttpClientHandler { UseProxy = false }) { Timeout = TimeSpan.FromSeconds(2) };
            using var response = await http.GetAsync("http://127.0.0.1:" + port + "/health", lifetime.Token);
            if (!response.IsSuccessStatusCode) return false;
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(lifetime.Token));
            return body.RootElement.TryGetProperty("nativeRuntime", out var native) && native.ValueKind == JsonValueKind.True &&
                body.RootElement.TryGetProperty("protocol", out var protocol) && protocol.TryGetInt32(out int number) && number == 1 &&
                body.RootElement.TryGetProperty("requiresUnityEditor", out var editor) && editor.ValueKind == JsonValueKind.False;
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException) { return false; }
    }
    static bool PortBusy(Exception error)
    {
        for (Exception? current = error; current != null; current = current.InnerException)
            if (current is SocketException socket && socket.SocketErrorCode == SocketError.AddressAlreadyInUse) return true;
        return false;
    }
    async Task StartEngine()
    {
        if (starting || connected) return;
        starting = true; start.Enabled = browse.Enabled = false; game.ReadOnly = true; start.Text = "正在准备…";
        SetStatus("正在连接演算服务", "检测游戏与本机连接，请稍候。", "准备中", DesktopTheme.Amber);
        try
        {
            if (await ExistingCompanion())
            {
                if (closing) return;
                connected = true; website.Enabled = true; start.Text = "服务已连接"; cache.Text = "任务在原窗口"; cache.Enabled = false;
                SetStatus("已连接现有演算器", "服务由另一个窗口提供，游戏目录以原窗口为准。", "已连接", DesktopTheme.Green);
                Append("检测到已运行的原生演算服务，已直接连接。"); return;
            }
            var probe = new TcpListener(IPAddress.Loopback, port);
            try { probe.Start(); } finally { probe.Stop(); }
            engine = new NativeEngine(game.Text, data, Path.Combine(AppContext.BaseDirectory, "OniSeedWorker.dll")); engine.Message += EngineMessage;
            SetStatus("正在准备游戏资源", "首次需要创建独立运行副本，准备完成后会自动连接。", "准备中", DesktopTheme.Amber);
            await Task.Run(() => engine.Prepare(lifetime.Token));
            if (closing) return;
            server = new CompanionServer(engine, port); server.Message += ServerMessage; await server.Start();
            Directory.CreateDirectory(data); File.WriteAllText(Path.Combine(data, "settings.json"), JsonSerializer.Serialize(new { gameDirectory = game.Text }));
            connected = true; website.Enabled = true; start.Text = "服务运行中";
            SetStatus("演算器已就绪", "打开网页，输入种子和 DLC 组合即可开始演算。", "已就绪", DesktopTheme.Green);
        }
        catch (Exception error)
        {
            if (server != null) { await server.DisposeAsync(); server = null; } else engine?.Dispose();
            engine = null;
            if (closing) return;
            bool occupied = PortBusy(error);
            string message = occupied ? "本机端口 " + port + " 已被其他程序占用。请关闭旧服务后重试。" : error is OperationCanceledException ? "准备已取消，可以重新启动演算器。" : error.Message;
            SetStatus(occupied ? "连接端口正在使用" : "暂时无法启动", message, "需处理", DesktopTheme.Amber);
            Append(message, warning: true); start.Text = "重新尝试"; start.Enabled = browse.Enabled = true; game.ReadOnly = false;
            try { Directory.CreateDirectory(data); await File.AppendAllTextAsync(Path.Combine(data, "launcher.log"), DateTime.Now.ToString("s") + " " + error + Environment.NewLine); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
        finally { starting = false; }
    }
}
