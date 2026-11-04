# Installs Pitcher for the current Windows user. No admin rights, no npm, no developer tools.
#  - copies the app to %LOCALAPPDATA%\Pitcher
#  - uses your Node.js 20+ if you have it; otherwise downloads a portable node.exe (checked against nodejs.org's SHA-256 list)
#  - downloads the open-source speech runtimes (about 25 MB, hash-verified)
#  - adds Start Menu and Desktop shortcuts that open Pitcher in its own window
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $env:LOCALAPPDATA 'Pitcher'
Write-Host ''
Write-Host '  Installing Pitcher into' $dest
Write-Host ''

# ---- copy the app (only what it needs to run) ----
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($item in @('server.js', 'package.json', 'README.md', 'lib', 'public', 'scripts', 'install')) {
  $from = Join-Path $src $item
  if (Test-Path $from) { Copy-Item -Recurse -Force -Path $from -Destination $dest }
}
New-Item -ItemType Directory -Force -Path (Join-Path $dest 'data') | Out-Null

# ---- Node.js: reuse the system one if new enough, otherwise a portable node.exe in the app folder ----
$node = $null
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) {
  $ver = (& $cmd.Source -v) -replace '^v', ''
  if ([int]($ver.Split('.')[0]) -ge 20) { $node = $cmd.Source; Write-Host "  Using your Node.js $ver" }
}
if (-not $node) {
  $runtime = Join-Path $dest 'runtime'
  $node = Join-Path $runtime 'node.exe'
  if (-not (Test-Path $node)) {
    Write-Host '  Downloading a portable Node.js (one file, about 80 MB, only for Pitcher)...'
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    $arch = if ([Environment]::Is64BitOperatingSystem) { if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' } } else { 'x86' }
    $base = 'https://nodejs.org/dist/latest-v22.x'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $sums = (Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt").Content -split "`n"
    $line = $sums | Where-Object { $_ -match "node-v[\d.]+-win-$arch\.zip$" } | Select-Object -First 1
    if (-not $line) { throw "Could not find a Node.js download for win-$arch." }
    $hash, $file = $line -split '\s+', 2
    $zip = Join-Path $env:TEMP $file.Trim()
    Invoke-WebRequest -UseBasicParsing "$base/$($file.Trim())" -OutFile $zip
    if ((Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower() -ne $hash.ToLower()) { Remove-Item $zip; throw 'Node.js download failed its checksum; nothing was installed.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $z = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
      $entry = $z.Entries | Where-Object { $_.FullName -match '/node\.exe$' } | Select-Object -First 1
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $node, $true)
      $lic = $z.Entries | Where-Object { $_.FullName -match '/LICENSE$' } | Select-Object -First 1
      if ($lic) { [IO.Compression.ZipFileExtensions]::ExtractToFile($lic, (Join-Path $runtime 'LICENSE-node.txt'), $true) }
    } finally { $z.Dispose() }
    Remove-Item $zip
    Write-Host '  Portable Node.js ready (verified).'
  }
}

# ---- speech runtimes ----
if (-not (Test-Path (Join-Path $dest 'public\vendor\manifest.json'))) {
  Write-Host '  Downloading the open-source speech runtimes (Whisper + Kokoro runtimes, about 25 MB)...'
  & $node (Join-Path $dest 'scripts\fetch-vendor.mjs')
  if ($LASTEXITCODE -ne 0) { Write-Host '  Speech runtimes could not be downloaded; Pitcher will use the browser''s speech instead. Re-run the installer later to retry.' -ForegroundColor Yellow }
}

# ---- shortcuts ----
$ws = New-Object -ComObject WScript.Shell
$launch = Join-Path $dest 'install\launch.ps1'
$icon = Join-Path $dest 'install\pitcher.ico'
foreach ($dir in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
  $lnk = $ws.CreateShortcut((Join-Path $dir 'Pitcher.lnk'))
  $lnk.TargetPath = (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
  $lnk.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launch`""
  $lnk.WorkingDirectory = $dest
  $lnk.IconLocation = $icon
  $lnk.Description = 'Pitch a Roblox game to a crowd of claudes'
  $lnk.Save()
}

Write-Host ''
Write-Host '  Done. Open Pitcher from the Start Menu or the Desktop shortcut.' -ForegroundColor Green
Write-Host '  Real AI uses Claude Code (the "claude" command) if it is installed and logged in; otherwise the scripted crowd plays.'
Write-Host '  To remove it later, run' (Join-Path $dest 'install\uninstall.ps1')
Write-Host ''
$open = Read-Host '  Open Pitcher now? [Y/n]'
if ($open -ne 'n') { & powershell -NoProfile -ExecutionPolicy Bypass -File $launch }
