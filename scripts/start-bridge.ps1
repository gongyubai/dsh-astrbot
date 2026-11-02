[CmdletBinding()]
param(
  [string]$Root = (Join-Path $env:USERPROFILE '.dsh\astriax-native'),
  [string]$ElectronPath = '',
  [string]$CliJs = '',
  [string]$NodePath = '',
  [int]$Port = 18081,
  [string]$Provider = 'deepseek-official',
  [string]$Model = 'deepseek-flash',
  [string]$Profile = 'sdk',
  [string]$WorkspaceRoot = ''
)
$ErrorActionPreference = 'Stop'
$PackageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ConfigPath = Join-Path $Root 'bridge-config.json'
if (Test-Path $ConfigPath) {
  try {
    $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    if (-not $ElectronPath -and $cfg.electronPath) { $ElectronPath = [string]$cfg.electronPath }
    if (-not $CliJs -and $cfg.cliJs) { $CliJs = [string]$cfg.cliJs }
    if (-not $NodePath -and $cfg.nodePath) { $NodePath = [string]$cfg.nodePath }
    if ($cfg.bridgePort) { $Port = [int]$cfg.bridgePort }
    if ($cfg.provider) { $Provider = [string]$cfg.provider }
    if ($cfg.model) { $Model = [string]$cfg.model }
    if ($cfg.profile) { $Profile = [string]$cfg.profile }
    if (-not $WorkspaceRoot -and $cfg.workspaceRoot) { $WorkspaceRoot = [string]$cfg.workspaceRoot }
  } catch {}
}
if (-not $ElectronPath) {
  $envElectron = $env:DSH_ELECTRON
  if ($envElectron -and (Test-Path $envElectron)) { $ElectronPath = $envElectron }
}
if (-not $ElectronPath) {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\DeepSeek Harness.exe'),
    (Join-Path $env:ProgramFiles 'DeepSeek Harness\DeepSeek Harness.exe')
  )
  foreach ($candidate in $candidates) { if ($candidate -and (Test-Path $candidate)) { $ElectronPath = $candidate; break } }
}
if (-not $ElectronPath -or -not (Test-Path $ElectronPath)) { throw 'DeepSeek Harness.exe not found. Pass -ElectronPath.' }
$electronDir = Split-Path $ElectronPath
if (-not $CliJs) { $CliJs = Join-Path $electronDir 'resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js' }
if (-not (Test-Path $CliJs) -and ($CliJs -notmatch '\.asar\\')) { throw 'DSH CLI JS not found: ' + $CliJs }
if (-not $NodePath -or -not (Test-Path $NodePath)) {
  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($nodeCommand) { $NodePath = $nodeCommand.Source }
  else {
    $candidateNode = Join-Path $electronDir 'resources\runtime\primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path $candidateNode) { $NodePath = $candidateNode }
  }
}
if (-not $NodePath -or -not (Test-Path $NodePath)) { throw 'node.exe not found. Pass -NodePath.' }
$server = Join-Path $Root 'bridge\server.mjs'
if (-not (Test-Path $server)) {
  New-Item -ItemType Directory -Path (Join-Path $Root 'bridge') -Force | Out-Null
  Copy-Item (Join-Path $PackageRoot 'bridge\server.mjs') $server -Force
}
if (-not $WorkspaceRoot) { $WorkspaceRoot = Join-Path $Root 'qq-work' }
New-Item -ItemType Directory -Path $WorkspaceRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Root 'bridge') -Force | Out-Null
$env:DSH_ASTRIAX_BRIDGE_ROOT = $Root
$env:DSH_ELECTRON = $ElectronPath
$env:DSH_CLI_JS = $CliJs
$env:DSH_BRIDGE_PORT = [string]$Port
$env:DSH_PROVIDER = $Provider
$env:DSH_MODEL = $Model
$env:DSH_PROFILE = $Profile
$env:DSH_WORKSPACE_ROOT = $WorkspaceRoot
$out = Join-Path $Root 'bridge\server-out.log'
$err = Join-Path $Root 'bridge\server-err.log'
$p = Start-Process -FilePath $NodePath -ArgumentList $server -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
Set-Content (Join-Path $Root 'bridge\bridge.pid') $p.Id -Encoding ascii
@{ electronPath = $ElectronPath; cliJs = $CliJs; nodePath = $NodePath; bridgePort = $Port; provider = $Provider; model = $Model; profile = $Profile; workspaceRoot = $WorkspaceRoot } | ConvertTo-Json | Set-Content (Join-Path $Root 'bridge-config.json') -Encoding utf8
$health = 'http://127.0.0.1:' + $Port + '/health'
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 1
  try {
    $h = Invoke-RestMethod -Uri $health -TimeoutSec 3 -UseBasicParsing
    if ($h.ready) { Write-Output ('bridge ready: ' + $health); exit 0 }
  } catch {}
  if ($p.HasExited) { throw ('bridge exited early code=' + $p.ExitCode) }
}
throw 'bridge did not become ready within 90 seconds'
