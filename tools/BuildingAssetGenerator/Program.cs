using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.Text;
using System.Text.Json;

const string DefaultSource = @"C:\Users\Administrator\Documents\KSE_Output\ONI_Bridge";
const string DefaultOutput = @"public\assets\buildings\on";
const int MaxOutputDimension = 2048;

var sourceRoot = GetOption(args, "--source") ?? DefaultSource;
var outputRoot = GetOption(args, "--output") ?? DefaultOutput;
var dryRun = args.Any(argument => argument.Equals("--dry-run", StringComparison.OrdinalIgnoreCase));

if (!Directory.Exists(sourceRoot))
{
    Console.Error.WriteLine($"Source directory does not exist: {sourceRoot}");
    return 1;
}

var packages = Directory.EnumerateDirectories(sourceRoot, "*_kanim", SearchOption.TopDirectoryOnly)
    .Select(path => new PackageFiles(path))
    .Where(package => package.IsComplete && IsBuildingAsset(package.Name))
    .OrderBy(package => package.Name, StringComparer.OrdinalIgnoreCase)
    .ToList();

Console.WriteLine($"Selected {packages.Count} building KAnim packages.");
if (dryRun)
{
    foreach (var package in packages) Console.WriteLine(package.Name);
    return 0;
}

Directory.CreateDirectory(outputRoot);
var manifest = new SortedDictionary<string, ManifestEntry>(StringComparer.OrdinalIgnoreCase);
var errors = new List<string>();
var generated = 0;

foreach (var package in packages)
{
    try
    {
        var rendered = RenderOnFrame(package);
        if (rendered is null)
        {
            errors.Add($"{package.Name}: no usable on frame");
            continue;
        }

        var fileName = ToAssetName(package.Name);
        var outputPath = Path.Combine(outputRoot, fileName + ".png");
        rendered.Bitmap.Save(outputPath, ImageFormat.Png);
        rendered.Bitmap.Dispose();
        manifest[ToTagName(package.Name)] = new ManifestEntry(
            "/assets/buildings/on/" + fileName + ".png",
            rendered.WidthCells,
            rendered.HeightCells,
            rendered.Width,
            rendered.Height,
            rendered.AnchorOffsetXCells,
            rendered.AnchorOffsetYCells,
            package.Name);
        generated++;
        if (generated % 25 == 0) Console.WriteLine($"Generated {generated}/{packages.Count}...");
    }
    catch (Exception exception)
    {
        errors.Add($"{package.Name}: {exception.Message}");
    }
}

var manifestPath = Path.Combine(outputRoot, "manifest.json");
var json = JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true });
File.WriteAllText(manifestPath, json + Environment.NewLine, new UTF8Encoding(false));
Console.WriteLine($"Generated {generated} PNG files.");
Console.WriteLine($"Manifest: {manifestPath}");
if (errors.Count > 0)
{
    Console.Error.WriteLine($"Skipped {errors.Count} packages:");
    foreach (var error in errors) Console.Error.WriteLine("  " + error);
}

return errors.Count == 0 ? 0 : 2;

static string? GetOption(string[] args, string name)
{
    for (var index = 0; index < args.Length - 1; index++)
    {
        if (args[index].Equals(name, StringComparison.OrdinalIgnoreCase)) return args[index + 1];
    }
    return null;
}

static bool IsBuildingAsset(string name)
{
    var value = name[..^"_kanim".Length].ToLowerInvariant();
    // Door packages are real world objects, including variants whose names
    // contain generic suffixes such as _b or _poi used by the filters below.
    if (value.StartsWith("door_", StringComparison.Ordinal)
        || value.Equals("door", StringComparison.Ordinal)
        || value.StartsWith("gravitas_door_", StringComparison.Ordinal)
        || value.Equals("conveyer_dropper", StringComparison.Ordinal)
        || value.Equals("logic_and", StringComparison.Ordinal)
        // These are placed buildings at the ends of transport networks. The
        // network cells themselves are rendered by the utility tile renderer.
        || value.Equals("conveyorin", StringComparison.Ordinal)
        || value.Equals("conveyorout", StringComparison.Ordinal)
        || value.Equals("warp_conduit_sender", StringComparison.Ordinal)
        || value.Equals("warp_conduit_receiver", StringComparison.Ordinal)) return true;

    var buildingTokens = new[]
    {
        "airconditioner", "alarm_sensor", "algaefarm", "algae_distillery", "apothecary", "arcade_cabinet",
        "armoury_locker", "artifact_analysis", "artifact_databank", "auto_miner", "battery", "beach_chair",
        "bedlg", "beehive", "boiler", "campfire", "ceilinglight", "centrifuge", "chemistry_lab", "chlorinator",
        "clothingfactory", "co2filter", "co2scrubber", "compost", "condenser", "cookstation", "craftingstation",
        "cratebox", "decontamination_shower", "door", "electrolyzer", "eggincubator", "enrichmentcentrifuge",
        "espresso_machine", "farmtile", "filter", "floorlamp", "gas_element_sensor", "gas_germs_sensor",
        "gas_temperature_sensor", "gasstorage", "generator", "glassrefinery", "grill", "gunkdump_station",
        "hydroponic", "incubator", "job_station", "ladder", "lamp", "lava_lamp", "liquid_element_sensor",
        "liquid_germs_sensor", "liquid_temperature_sensor", "liquidreservoir", "liquidwallpump", "machineshop",
        "manual_radbolt_generator", "massiveheatsink", "material_research", "metalrefinery", "minigaspump",
        "miniwaterpump", "orbital_research", "outhouse", "pedestal_battery", "planter", "presence_sensor",
        "pressure", "pumpgas", "pumpliquid", "radbolt", "radiation", "research", "rockrefinery", "saltlamp",
        "savingmachine", "sensor", "shower", "sink", "smartbattery", "smartstorage", "solar", "spaceheater",
        "spice_grinder", "storage", "switch", "telephone", "teleporter", "telescope", "thermalblock", "toilet",
        "transformer", "vendingmachine", "ventgas", "ventliquid", "walllamp", "wash", "watercooler", "waterpump",
        "waterpurifier", "wattage_sensor", "wind_tunnel", "vulcanizer",
    };
    if (!buildingTokens.Any(value.StartsWith)) return false;

    var excludedTokens = new[]
    {
        "anim_", "achievement", "atmo_", "asteroid", "attack_", "baby_", "balloon_", "body_", "bottom_", "bonus",
        "bottle_", "brackorb", "brackwood", "build_status", "cannon", "caterpillar", "chameleo",
        "cleaner_", "critter", "creature", "dupe", "egg", "emote", "event_", "fx", "geyser", "fountain",
        "glove", "head_", "jumpsuit", "liquid_carton", "meteor", "minion", "morb", "oniload", "particle",
        "plant_", "projectile", "rocket_", "splash", "sticker", "suit_", "tree_", "turtle_",
        "waterfall", "world_", "worm_", "zombie", "walls_", "wallposter", "facade", "building_",
        "research_unlock", "shower_regolith",
        "conduit", "pipe", "wire", "utility", "utilities", "conveyor", "heavywatt", "logic_", "logicwire",
        "tube_", "tubeworm", "valvegas", "valveliquid", "valvesolid", "gas_ball", "liquid_ball",
        "_build", "_bg", "_fg", "_mg", "_fx", "_arrow", "_target", "_question", "_poi", "_cluster",
        "_identify", "_mooteor", "_rotating", "_gourmet", "_chomp", "_gears", "_hands", "_roundstamp",
        "_spikebeds", "_teeth", "_balloon", "_a", "_b",
    };
    if (excludedTokens.Any(value.Contains)) return false;

    if (value.StartsWith("bed_") || value.StartsWith("floorlamp_") || value.StartsWith("ceilinglight_")
        || value.StartsWith("watercooler_") || value.StartsWith("wash_sink_") || value.StartsWith("toiletflush_")
        || value.StartsWith("beach_chair_") || value.StartsWith("gasstorage_") || value.StartsWith("generatormanual_")
        || value.StartsWith("rockrefinery_") || value.StartsWith("research_unlock_") || value.StartsWith("switch_")) return false;
    if (value.StartsWith("grilled_") || value.StartsWith("shower_cluster") || value.StartsWith("farmtilehydro")
        || value.StartsWith("farmtilerotating")) return false;

    var cosmeticTokens = new[]
    {
        "_blue_", "_green_", "_purple_", "_red_", "_yellow_", "_pink_", "_orange_", "_black_", "_white_",
        "_brown_", "_grey_", "_neutronium", "_cyberpunk", "_nautical", "_cottage", "_rocket", "_skin_",
        "_waterbubbles", "_stripes", "_polka", "_tartan", "_basic_", "_cantaloupe", "_chameleo",
        "_paculacanth", "_raptor", "_stego", "_turtle", "_80s", "_biocircuit", "_diving_", "_sparkle_",
        "_gonch", "_gotch", "_ginch", "_flamingo", "_cobalt", "_nautical", "_charcoal", "_lemon",
    };
    if (cosmeticTokens.Any(value.Contains)) return false;

    return true;
}

static string ToAssetName(string packageName)
    => packageName[..^"_kanim".Length].ToLowerInvariant().Replace(' ', '_');

static string ToTagName(string packageName)
    => packageName[..^"_kanim".Length].ToLowerInvariant();

static bool UsesOffState(string packageName)
    => packageName.Equals("toiletflush_kanim", StringComparison.OrdinalIgnoreCase)
        || packageName.Equals("toilet_wall_kanim", StringComparison.OrdinalIgnoreCase)
        || packageName.Equals("outhouse_kanim", StringComparison.OrdinalIgnoreCase)
        || packageName.Equals("warp_conduit_receiver_kanim", StringComparison.OrdinalIgnoreCase);

static bool UsesClosedState(string packageName)
    => packageName.StartsWith("door_", StringComparison.OrdinalIgnoreCase)
        || packageName.Equals("door_kanim", StringComparison.OrdinalIgnoreCase)
        || packageName.StartsWith("gravitas_door_", StringComparison.OrdinalIgnoreCase);

static RenderedFrame? RenderOnFrame(PackageFiles package)
{
    var texture = new Bitmap(package.TexturePath);
    using var buildStream = File.OpenRead(package.BuildPath);
    using var animStream = File.OpenRead(package.AnimPath);
    var build = BuildFile.Read(buildStream);
    var anim = AnimFile.Read(animStream);
    var bank = PreferredBuildingBank(anim, package.Name);
    if (bank is null || bank.Frames.Count == 0) return null;
    var frame = bank.Frames[0];

    var drawItems = new List<DrawItem>();
    Bounds? bounds = null;
    foreach (var element in frame.Elements)
    {
        if (element.Alpha <= 0) continue;
        var symbol = build.Symbols.FirstOrDefault(candidate => candidate.Hash == element.SymbolHash);
        if (symbol is null) continue;
        var sprite = symbol.Frames.FirstOrDefault(candidate => candidate.Index == element.FrameNumber)
            ?? (element.FrameNumber >= 0 && element.FrameNumber < symbol.Frames.Count ? symbol.Frames[element.FrameNumber] : null);
        if (sprite is null) continue;
        var transform = new Transform(
            element.M00 * .5f,
            element.M10 * .5f,
            element.M01 * .5f,
            element.M11 * .5f,
            sprite.PivotX * element.M00 + sprite.PivotY * element.M01 + element.M02,
            sprite.PivotX * element.M10 + sprite.PivotY * element.M11 + element.M12);
        var itemBounds = TransformBounds(sprite, transform);
        bounds = bounds is null ? itemBounds : bounds.Value.Union(itemBounds);
        drawItems.Add(new DrawItem(element, sprite, transform));
    }

    texture.SetResolution(96, 96);
    if (bounds is null)
    {
        texture.Dispose();
        return null;
    }

    var scale = Math.Min(1f, MaxOutputDimension / Math.Max(bounds.Value.Width, bounds.Value.Height));
    var padding = 2f;
    var width = Math.Max(1, (int)Math.Ceiling(bounds.Value.Width * scale + padding * 2));
    var height = Math.Max(1, (int)Math.Ceiling(bounds.Value.Height * scale + padding * 2));
    var output = new Bitmap(width, height, PixelFormat.Format32bppArgb);
    using (var graphics = Graphics.FromImage(output))
    {
        graphics.Clear(Color.Transparent);
        graphics.CompositingMode = CompositingMode.SourceOver;
        graphics.CompositingQuality = CompositingQuality.HighQuality;
        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;

        for (var index = drawItems.Count - 1; index >= 0; index--)
        {
            var item = drawItems[index];
            var source = TextureRectangle(item.Sprite, texture.Width, texture.Height);
            if (source.Width <= 0 || source.Height <= 0) continue;
            using var attributes = new ImageAttributes();
            var red = Clamp(item.Element.Red);
            var green = Clamp(item.Element.Green);
            var blue = Clamp(item.Element.Blue);
            var alpha = Clamp(item.Element.Alpha);
            attributes.SetColorMatrix(new ColorMatrix(new[]
            {
                new[] { red, 0f, 0f, 0f, 0f },
                new[] { 0f, green, 0f, 0f, 0f },
                new[] { 0f, 0f, blue, 0f, 0f },
                new[] { 0f, 0f, 0f, alpha, 0f },
                new[] { 0f, 0f, 0f, 0f, 1f },
            }));
            var matrix = new Matrix(
                item.Transform.A * scale,
                item.Transform.B * scale,
                item.Transform.C * scale,
                item.Transform.D * scale,
                (item.Transform.E - bounds.Value.Left) * scale + padding,
                (item.Transform.F - bounds.Value.Top) * scale + padding);
            graphics.Transform = matrix;
            var destination = Rectangle.Round(new RectangleF(-item.Sprite.PivotWidth, -item.Sprite.PivotHeight, item.Sprite.PivotWidth * 2, item.Sprite.PivotHeight * 2));
            graphics.DrawImage(texture, destination, source.X, source.Y, source.Width, source.Height, GraphicsUnit.Pixel, attributes);
            matrix.Dispose();
            graphics.ResetTransform();
        }
    }
    texture.Dispose();

    // KAnim build coordinates use 200 units per world cell at runtime.
    // Keep the cropped image's root offset so the sprite remains aligned with
    // the building's CellToPosCBC anchor after it is drawn from the manifest.
    return new RenderedFrame(
        output,
        width,
        height,
        Math.Max(1, bounds.Value.Width / 200f),
        Math.Max(1, bounds.Value.Height / 200f),
        (bounds.Value.Left + bounds.Value.Right) / 400f,
        (bounds.Value.Top + bounds.Value.Bottom) / 400f);
}

static AnimBank? PreferredBuildingBank(AnimFile anim, string packageName)
{
    var preferred = UsesOffState(packageName)
        ? new[] { "off", "idle", "on", "place" }
        : UsesClosedState(packageName)
            ? new[] { "closed", "on", "idle", "place" }
            : new[] { "on", "idle", "working_loop", "working_pre", "off", "place" };
    return preferred
        .Select(state => anim.Banks.FirstOrDefault(candidate => candidate.Name.Equals(state, StringComparison.OrdinalIgnoreCase)))
        .FirstOrDefault(candidate => candidate is not null && candidate.Frames.Count > 0);
}

static float Clamp(float value) => Math.Clamp(value, 0, 1);

static Rectangle TextureRectangle(SpriteFrame frame, int width, int height)
{
    var x1 = Math.Clamp((int)Math.Floor(frame.UvX1 * width), 0, width);
    var y1 = Math.Clamp((int)Math.Floor(frame.UvY1 * height), 0, height);
    var x2 = frame.UvX2 == frame.UvX1 ? x1 + 1 : (int)Math.Floor(frame.UvX2 * width);
    var y2 = frame.UvY2 == frame.UvY1 ? y1 + 1 : (int)Math.Floor(frame.UvY2 * height);
    x2 = Math.Clamp(x2, x1 + 1, width);
    y2 = Math.Clamp(y2, y1 + 1, height);
    return Rectangle.FromLTRB(x1, y1, x2, y2);
}

static Bounds TransformBounds(SpriteFrame sprite, Transform transform)
{
    var points = new[]
    {
        TransformPoint(-sprite.PivotWidth, -sprite.PivotHeight, transform),
        TransformPoint(sprite.PivotWidth, -sprite.PivotHeight, transform),
        TransformPoint(-sprite.PivotWidth, sprite.PivotHeight, transform),
        TransformPoint(sprite.PivotWidth, sprite.PivotHeight, transform),
    };
    return new Bounds(
        points.Min(point => point.X),
        points.Min(point => point.Y),
        points.Max(point => point.X),
        points.Max(point => point.Y));
}

static PointF TransformPoint(float x, float y, Transform transform)
    => new(transform.A * x + transform.C * y + transform.E, transform.B * x + transform.D * y + transform.F);

record PackageFiles(string DirectoryPath)
{
    public string Name => Path.GetFileName(DirectoryPath);
    public string TexturePath => Path.Combine(DirectoryPath, Name + "_0.png");
    public string BuildPath => Path.Combine(DirectoryPath, Name + "_build.bytes");
    public string AnimPath => Path.Combine(DirectoryPath, Name + "_anim.bytes");
    public bool IsComplete => File.Exists(TexturePath) && File.Exists(BuildPath) && File.Exists(AnimPath);
}

record ManifestEntry(
    string path,
    float widthCells,
    float heightCells,
    int pixelWidth,
    int pixelHeight,
    float anchorOffsetXCells,
    float anchorOffsetYCells,
    string source);
record RenderedFrame(
    Bitmap Bitmap,
    int Width,
    int Height,
    float WidthCells,
    float HeightCells,
    float AnchorOffsetXCells,
    float AnchorOffsetYCells);
record DrawItem(AnimElement Element, SpriteFrame Sprite, Transform Transform);
record Transform(float A, float B, float C, float D, float E, float F);
record struct Bounds(float Left, float Top, float Right, float Bottom)
{
    public float Width => Right - Left;
    public float Height => Bottom - Top;
    public Bounds Union(Bounds other) => new(Math.Min(Left, other.Left), Math.Min(Top, other.Top), Math.Max(Right, other.Right), Math.Max(Bottom, other.Bottom));
}

static class KanimBinary
{
    public static string ReadString(BinaryReader reader)
    {
        var length = reader.ReadInt32();
        if (length <= 0) return string.Empty;
        return Encoding.ASCII.GetString(reader.ReadBytes(length));
    }
}

sealed class BuildFile
{
    public List<BuildSymbol> Symbols { get; } = [];
    public static BuildFile Read(Stream stream)
    {
        using var reader = new BinaryReader(stream, Encoding.ASCII, leaveOpen: true);
        if (Encoding.ASCII.GetString(reader.ReadBytes(4)) != "BILD") throw new InvalidDataException("Invalid BILD header");
        var version = reader.ReadInt32();
        var symbolCount = reader.ReadInt32();
        _ = reader.ReadInt32();
        _ = KanimBinary.ReadString(reader);
        var result = new BuildFile();
        for (var symbolIndex = 0; symbolIndex < symbolCount; symbolIndex++)
        {
            var symbol = new BuildSymbol { Hash = reader.ReadInt32() };
            if (version > 9) _ = reader.ReadInt32();
            _ = reader.ReadInt32();
            _ = reader.ReadInt32();
            var frameCount = reader.ReadInt32();
            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++)
            {
                symbol.Frames.Add(new SpriteFrame(
                    reader.ReadInt32(), reader.ReadInt32(), reader.ReadInt32(), reader.ReadSingle(), reader.ReadSingle(),
                    reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle()));
            }
            result.Symbols.Add(symbol);
        }
        return result;
    }
}

sealed class AnimFile
{
    public List<AnimBank> Banks { get; } = [];
    public static AnimFile Read(Stream stream)
    {
        using var reader = new BinaryReader(stream, Encoding.ASCII, leaveOpen: true);
        if (Encoding.ASCII.GetString(reader.ReadBytes(4)) != "ANIM") throw new InvalidDataException("Invalid ANIM header");
        _ = reader.ReadInt32();
        _ = reader.ReadInt32();
        _ = reader.ReadInt32();
        var bankCount = reader.ReadInt32();
        var result = new AnimFile();
        for (var bankIndex = 0; bankIndex < bankCount; bankIndex++)
        {
            var bank = new AnimBank(KanimBinary.ReadString(reader));
            _ = reader.ReadInt32();
            _ = reader.ReadSingle();
            var frameCount = reader.ReadInt32();
            for (var frameIndex = 0; frameIndex < frameCount; frameIndex++)
            {
                var frame = new AnimFrame(reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle());
                var elementCount = reader.ReadInt32();
                for (var elementIndex = 0; elementIndex < elementCount; elementIndex++)
                {
                    frame.Elements.Add(new AnimElement(
                        reader.ReadInt32(), reader.ReadInt32(), reader.ReadInt32(), reader.ReadInt32(), reader.ReadSingle(),
                        reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(),
                        reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle(), reader.ReadSingle()));
                }
                bank.Frames.Add(frame);
            }
            result.Banks.Add(bank);
        }
        return result;
    }
}

sealed class BuildSymbol
{
    public int Hash { get; init; }
    public List<SpriteFrame> Frames { get; } = [];
}

record SpriteFrame(int Index, int Duration, int ImageIndex, float PivotX, float PivotY, float PivotWidth, float PivotHeight, float UvX1, float UvY1, float UvX2, float UvY2);
record AnimBank(string Name)
{
    public List<AnimFrame> Frames { get; } = [];
}
record AnimFrame(float X, float Y, float Width, float Height)
{
    public List<AnimElement> Elements { get; } = [];
}
record AnimElement(int SymbolHash, int FrameNumber, int FolderHash, int Flags, float Alpha, float Blue, float Green, float Red, float M00, float M10, float M01, float M11, float M02, float M12, float Unused);
