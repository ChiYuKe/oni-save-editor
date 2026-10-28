using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

namespace OniSeedCompanion;

internal static class DesktopTheme
{
    public static readonly Color Page = Color.FromArgb(16, 16, 18);
    public static readonly Color Surface = Color.FromArgb(25, 25, 28);
    public static readonly Color Input = Color.FromArgb(18, 18, 20);
    public static readonly Color Text = Color.FromArgb(239, 239, 241);
    public static readonly Color Muted = Color.FromArgb(143, 143, 151);
    public static readonly Color Green = Color.FromArgb(140, 193, 159);
    public static readonly Color Amber = Color.FromArgb(217, 180, 120);
    public static GraphicsPath Rounded(Rectangle bounds, int radius)
    {
        var path = new GraphicsPath(); int d = radius * 2;
        path.AddArc(bounds.Left, bounds.Top, d, d, 180, 90);
        path.AddArc(bounds.Right - d, bounds.Top, d, d, 270, 90);
        path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
        path.AddArc(bounds.Left, bounds.Bottom - d, d, d, 90, 90);
        path.CloseFigure(); return path;
    }
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);
    public static void DarkTitleBar(IntPtr window)
    {
        int enabled = 1;
        _ = DwmSetWindowAttribute(window, 20, ref enabled, sizeof(int));
    }
}

internal sealed class DesktopCard : Panel
{
    public DesktopCard()
    {
        DoubleBuffered = true; BackColor = DesktopTheme.Page;
        Padding = new Padding(22, 18, 22, 20);
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        if (Width < 32 || Height < 32) return;
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var shadow = new SolidBrush(Color.FromArgb(9, 9, 11));
        using var shape = DesktopTheme.Rounded(new Rectangle(1, 4, Width - 3, Height - 5), 14);
        e.Graphics.FillPath(shadow, shape);
        using var fill = new SolidBrush(DesktopTheme.Surface);
        using var face = DesktopTheme.Rounded(new Rectangle(1, 0, Width - 3, Height - 5), 14);
        e.Graphics.FillPath(fill, face);
    }
}

internal sealed class DesktopButton : Button
{
    [System.ComponentModel.DefaultValue(false)] public bool Primary { get; set; }
    bool hovered;
    public DesktopButton()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        FlatStyle = FlatStyle.Flat; FlatAppearance.BorderSize = 0;
        Cursor = Cursors.Hand; Height = 40; BackColor = DesktopTheme.Surface;
        Margin = new Padding(0); Font = new Font("Microsoft YaHei UI", 9F);
    }
    protected override void OnMouseEnter(EventArgs e) { hovered = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hovered = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }
    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.Clear(BackColor); e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        Color fill = !Enabled ? Color.FromArgb(34, 34, 38) : Primary ? (hovered ? Color.White : Color.FromArgb(230, 230, 233)) : (hovered ? Color.FromArgb(51, 51, 56) : Color.FromArgb(39, 39, 44));
        using var brush = new SolidBrush(fill);
        using var shape = DesktopTheme.Rounded(new Rectangle(0, 0, Width - 1, Height - 1), 8);
        e.Graphics.FillPath(brush, shape);
        Color text = !Enabled ? Color.FromArgb(143, 143, 151) : Primary ? DesktopTheme.Page : DesktopTheme.Text;
        TextRenderer.DrawText(e.Graphics, Text, Font, ClientRectangle, text, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        if (Focused && ShowFocusCues)
        {
            using var pen = new Pen(DesktopTheme.Muted);
            using var focus = DesktopTheme.Rounded(new Rectangle(3, 3, Width - 7, Height - 7), 6);
            e.Graphics.DrawPath(pen, focus);
        }
    }
}

internal sealed class DesktopInput : Panel
{
    public DesktopInput() { DoubleBuffered = true; BackColor = DesktopTheme.Surface; Padding = new Padding(12, 10, 12, 8); }
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e); e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var brush = new SolidBrush(DesktopTheme.Input);
        using var shape = DesktopTheme.Rounded(new Rectangle(0, 0, Width - 1, Height - 1), 8);
        e.Graphics.FillPath(brush, shape);
    }
}
