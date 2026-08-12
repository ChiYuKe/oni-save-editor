using OniSave.Core;

namespace OniSave.Renderer;

/// <summary>
/// One source-aligned GroundRenderer quad. The four-corner mask and material
/// order are kept as data so the Direct3D backend can upload matching UVs.
/// </summary>
public readonly record struct OniGroundQuad(
    int X,
    int Y,
    ushort ElementHash,
    int SubstanceIndex,
    byte CornerMask,
    byte Zone,
    float Variation,
    bool Opaque,
    bool Backwall = false);

public sealed class OniWorldChunk
{
    public OniWorldChunk(int chunkX, int chunkY, int width, int height)
    {
        ChunkX = chunkX;
        ChunkY = chunkY;
        Width = width;
        Height = height;
    }

    public int ChunkX { get; }
    public int ChunkY { get; }
    public int Width { get; }
    public int Height { get; }
    public List<OniGroundQuad> Opaque { get; } = [];
    public List<OniGroundQuad> Alpha { get; } = [];
    public List<OniGroundQuad> Backwall { get; } = [];
    public List<OniGroundQuad> BackwallAlpha { get; } = [];
    public int QuadCount => Opaque.Count + Alpha.Count + Backwall.Count + BackwallAlpha.Count;
}

/// <summary>
/// CPU-side port of GroundRenderer.WorldChunk.Rebuild. It emits renderer-neutral
/// quads; the native D3D11 backend owns buffers and materials.
/// </summary>
public sealed class OniGroundChunkBuilder
{
    public const int ChunkSize = 16;

    public OniWorldChunk Build(OniSimData sim, byte[]? worldZones, int chunkX, int chunkY)
    {
        var worldWidth = Math.Max(0, sim.Width - 2);
        var worldHeight = Math.Max(0, sim.Height - 2);
        var startX = chunkX * ChunkSize;
        var startY = chunkY * ChunkSize;
        var endX = Math.Min(worldWidth, startX + ChunkSize);
        var endY = Math.Min(worldHeight, startY + ChunkSize);
        var chunk = new OniWorldChunk(chunkX, chunkY, Math.Max(0, endX - startX), Math.Max(0, endY - startY));
        if (startX >= endX || startY >= endY) return chunk;

        for (var y = startY; y < endY; y++)
        {
            for (var x = startX; x < endX; x++)
            {
                // GroundRenderer samples (x-1,y-1), (x,y-1), (x-1,y), (x,y).
                var corners = new[]
                {
                    Sample(sim, x - 1, y - 1),
                    Sample(sim, x, y - 1),
                    Sample(sim, x - 1, y),
                    Sample(sim, x, y),
                };

                var materials = corners
                    .Where(static corner => corner.IsSolid)
                    .GroupBy(static corner => corner.Cell.ElementHash)
                    .Select(static group => group.First())
                    .OrderBy(static corner => corner.SubstanceIndex)
                    .ToArray();

                var zone = ZoneAt(worldZones, worldWidth, x, y);
                foreach (var material in materials)
                {
                    var substance = material.SubstanceIndex;
                    var mask = (byte)
                    (
                        (AtOrAbove(corners[2], substance) ? 8 : 0)
                        | (AtOrAbove(corners[3], substance) ? 4 : 0)
                        | (AtOrAbove(corners[0], substance) ? 2 : 0)
                        | (AtOrAbove(corners[1], substance) ? 1 : 0)
                    );
                    if (mask == 0) continue;

                    var quad = new OniGroundQuad(
                        x,
                        y,
                        material.Cell.ElementHash,
                        substance,
                        mask,
                        zone,
                        StaticVariation(x, y),
                        mask == 15);
                    if (quad.Opaque) chunk.Opaque.Add(quad);
                    else chunk.Alpha.Add(quad);
                }
            }
        }

        return chunk;
    }

    public IReadOnlyList<OniWorldChunk> BuildAll(OniSimData sim, byte[]? worldZones)
    {
        var width = Math.Max(0, sim.Width - 2);
        var height = Math.Max(0, sim.Height - 2);
        var chunks = new List<OniWorldChunk>(
            ((width + ChunkSize - 1) / ChunkSize) * ((height + ChunkSize - 1) / ChunkSize));
        for (var chunkY = 0; chunkY * ChunkSize < height; chunkY++)
        {
            for (var chunkX = 0; chunkX * ChunkSize < width; chunkX++)
            {
                chunks.Add(Build(sim, worldZones, chunkX, chunkY));
            }
        }
        return chunks;
    }

    private static GroundCorner Sample(OniSimData sim, int x, int y)
    {
        var width = Math.Max(0, sim.Width - 2);
        var height = Math.Max(0, sim.Height - 2);
        if ((uint)x >= (uint)width || (uint)y >= (uint)height) return default;
        var cell = OniSimCells.Read(sim, x, y);
        var visual = OniElementPalette.Get(cell.ElementHash, cell.Properties);
        return new GroundCorner(cell, visual.State == OniElementState.Solid, SubstanceIndex(cell.ElementHash));
    }

    private static bool AtOrAbove(GroundCorner corner, int substance)
        => corner.IsSolid && corner.SubstanceIndex >= substance;

    private static byte ZoneAt(byte[]? zones, int width, int x, int y)
    {
        var index = y * width + x;
        return zones is not null && (uint)index < (uint)zones.Length ? zones[index] : (byte)3;
    }

    private static int SubstanceIndex(ushort hash)
        => OniSubstanceMaterials.TryGet(hash, out var material)
            ? material.SubstanceIndex
            : OniElementTextures.Get(hash).Hash;

    // Isolated here so the exact PerlinSimplexNoise table can replace this
    // deterministic fallback without changing the chunk or GPU contracts.
    private static float StaticVariation(int x, int y)
    {
        var value = Math.Sin((x * 92821L + y * 68917L) * 0.0001) * 43758.5453;
        return (float)(value - Math.Floor(value));
    }

    private readonly record struct GroundCorner(OniSimCell Cell, bool IsSolid, int SubstanceIndex);
}

/// <summary>Mirrors GroundRenderer.MarkDirty, including neighboring chunks.</summary>
public sealed class OniChunkDirtySet
{
    private readonly HashSet<(int X, int Y)> _dirty = [];

    public void MarkCell(int x, int y, int worldWidth, int worldHeight)
    {
        var chunkX = x / OniGroundChunkBuilder.ChunkSize;
        var chunkY = y / OniGroundChunkBuilder.ChunkSize;
        for (var dy = -1; dy <= 1; dy++)
        {
            for (var dx = -1; dx <= 1; dx++)
            {
                var candidateX = chunkX + dx;
                var candidateY = chunkY + dy;
                if (candidateX < 0 || candidateY < 0) continue;
                if (candidateX * OniGroundChunkBuilder.ChunkSize >= worldWidth) continue;
                if (candidateY * OniGroundChunkBuilder.ChunkSize >= worldHeight) continue;
                var horizontalEdge = dx == 0 || x % OniGroundChunkBuilder.ChunkSize == 0 || x % OniGroundChunkBuilder.ChunkSize == OniGroundChunkBuilder.ChunkSize - 1;
                var verticalEdge = dy == 0 || y % OniGroundChunkBuilder.ChunkSize == 0 || y % OniGroundChunkBuilder.ChunkSize == OniGroundChunkBuilder.ChunkSize - 1;
                if (horizontalEdge && verticalEdge) _dirty.Add((candidateX, candidateY));
            }
        }
    }

    public void MarkAll(int worldWidth, int worldHeight)
    {
        for (var y = 0; y * OniGroundChunkBuilder.ChunkSize < worldHeight; y++)
        {
            for (var x = 0; x * OniGroundChunkBuilder.ChunkSize < worldWidth; x++) _dirty.Add((x, y));
        }
    }

    public IReadOnlyList<(int X, int Y)> Consume()
    {
        var result = _dirty.ToArray();
        _dirty.Clear();
        return result;
    }
}
