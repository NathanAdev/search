# Removes Pitcher: shortcuts, the app folder and its portable Node.js. Asks before deleting your saved sessions.
$dest = Join-Path $env:LOCALAPPDATA 'Pitcher'
foreach ($dir in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) { Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $dir 'Pitcher.lnk') }
try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8787/api/health' | Out-Null; Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$dest*" } | Stop-Process -Force } catch { }
$sessions = Join-Path $dest 'data\sessions'
if ((Test-Path $sessions) -and (Get-ChildItem $sessions -Filter *.json).Count -gt 0) {
  $keep = Read-Host 'Keep your saved pitch sessions (moved to Documents\Pitcher sessions)? [Y/n]'
  if ($keep -ne 'n') { $to = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Pitcher sessions'; New-Item -ItemType Directory -Force $to | Out-Null; Copy-Item (Join-Path $sessions '*') $to; Write-Host "Sessions kept in $to" }
}
Set-Location $env:TEMP
Remove-Item -Recurse -Force $dest
Write-Host 'Pitcher removed. Speech models cached by your browser can be cleared in its site settings for 127.0.0.1:8787.'
