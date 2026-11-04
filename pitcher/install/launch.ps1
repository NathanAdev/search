# Starts the Pitcher server in the background (if it is not already running) and opens it in its own app window.
# The server stops itself about 10 minutes after the last Pitcher window closes.
$ErrorActionPreference = 'SilentlyContinue'
$app = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:8787'
$node = Join-Path $app 'runtime\node.exe'
if (-not (Test-Path $node)) { $node = (Get-Command node).Source }

function Test-Up { try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 "$url/api/health").StatusCode -eq 200 } catch { $false } }
if (-not (Test-Up)) {
  $env:PITCHER_AUTOSTOP = '10'
  Start-Process -FilePath $node -ArgumentList "`"$(Join-Path $app 'server.js')`"" -WorkingDirectory $app -WindowStyle Hidden
  for ($i = 0; $i -lt 40 -and -not (Test-Up); $i++) { Start-Sleep -Milliseconds 250 }
}

$browsers = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$browser = $browsers | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($browser) { Start-Process -FilePath $browser -ArgumentList "--app=$url/#pitch" }
else { Start-Process "$url/#pitch" }
