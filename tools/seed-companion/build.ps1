param(
    [Parameter(Mandatory=$true)][string]$GameDirectory,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'artifacts/win-x64')
)
$ErrorActionPreference='Stop'
$GameDirectory = (Resolve-Path -LiteralPath $GameDirectory).Path
if (!(Test-Path -LiteralPath (Join-Path $GameDirectory 'OxygenNotIncluded.exe'))) { throw '请选择完整的缺氧安装目录。' }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if ($OutputDirectory.Equals($GameDirectory,[StringComparison]::OrdinalIgnoreCase) -or $OutputDirectory.StartsWith($GameDirectory + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw '发布包不能写入游戏安装目录。' }
if (Test-Path -LiteralPath (Join-Path $OutputDirectory 'OxygenNotIncluded_Data')) { throw '输出目录不能是游戏目录或运行副本。' }
& dotnet build (Join-Path $PSScriptRoot 'Worker/Worker.csproj') -c Release "-p:OniGameDirectory=$GameDirectory" --nologo -v:q
if ($LASTEXITCODE -ne 0) { throw '工作组件编译失败。' }
& dotnet publish (Join-Path $PSScriptRoot 'Launcher/Launcher.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o $OutputDirectory --nologo -v:q
if ($LASTEXITCODE -ne 0) { throw '独立程序打包失败。' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Worker/bin/Release/netstandard2.1/OniSeedWorker.dll') -Destination $OutputDirectory
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'PLAYER-README.md') -Destination (Join-Path $OutputDirectory '使用说明.md')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'THIRD-PARTY-NOTICES.txt') -Destination $OutputDirectory
$nugetRoot = if ($env:NUGET_PACKAGES) { $env:NUGET_PACKAGES } else { Join-Path $env:USERPROFILE '.nuget/packages' }
foreach ($package in @('microsoft.netcore.app.runtime.win-x64','microsoft.aspnetcore.app.runtime.win-x64','microsoft.windowsdesktop.app.runtime.win-x64')) {
    $versions = Get-ChildItem -LiteralPath (Join-Path $nugetRoot $package) -Directory -ErrorAction SilentlyContinue | Where-Object {$_.Name.StartsWith('9.')} | Sort-Object {[version]$_.Name} -Descending
    if ($versions.Count -gt 0) {
        foreach ($notice in @('LICENSE.TXT','THIRD-PARTY-NOTICES.TXT')) {
            $noticePath = Join-Path $versions[0].FullName $notice
            if (Test-Path -LiteralPath $noticePath) { Add-Content -LiteralPath (Join-Path $OutputDirectory 'THIRD-PARTY-NOTICES.txt') -Value ("`n$package`n" + [IO.File]::ReadAllText($noticePath)) -Encoding utf8 }
        }
    }
}
# Only our own adapter and the self-contained .NET launcher are distributed.
if ((Get-ChildItem -LiteralPath $OutputDirectory -Recurse -File | Where-Object {$_.Name -match '^(Assembly-CSharp|UnityEngine|UnityPlayer|SimDLL)'}).Count -gt 0) { throw '发现游戏二进制，禁止放入工具发布包。' }
$manifest = Get-ChildItem -LiteralPath $OutputDirectory -File | Where-Object {$_.Extension -in '.exe','.dll'} | ForEach-Object { [PSCustomObject]@{file=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} }
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'checksums.json') -Encoding utf8
Write-Output "已生成独立工具：$OutputDirectory"
