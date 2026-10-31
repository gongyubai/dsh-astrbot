[CmdletBinding()]
param(
  [string]$DshHome = (Join-Path $env:USERPROFILE '.dsh'),
  [string]$Profile = 'desktop',
  [string]$ElectronPath = '',
  [string]$CliJs = '',
  [string]$NodePath = '',
  [int]$BridgePort = 18081,
  [switch]$SkipBridge
)
$ErrorActionPreference = 'Stop'
$PackageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$profileRoot = Join-Path $DshHome ('profiles\' + $Profile)
if (-not (Test-Path $profileRoot)) { throw 'DSH profile not found: ' + $profileRoot }
$nodeModules = Join-Path $profileRoot 'node_modules'
New-Item -ItemType Directory -Path $nodeModules -Force | Out-Null
$target = Join-Path $nodeModules 'dsh-astriax-native'
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Junction -Path $target -Target $PackageRoot | Out-Null
Write-Output ('plugin linked: ' + $target + ' -> ' + $PackageRoot)
$patchFile = Join-Path $profileRoot 'cordis.patch.yml'
$patch = ''
if (Test-Path $patchFile) { $patch = Get-Content $patchFile -Raw }
$begin = '# === DSH AstriaX Native BEGIN ==='
$end = '# === DSH AstriaX Native END ==='
$block = $begin + "`r`n" +
'# Portable native AstriaX manager. Data defaults to %USERPROFILE%\.dsh\astriax-native.' + "`r`n" +
'- insert:' + "`r`n" +
'    - id: astriax-native-host' + "`r`n" +
'      name: dsh-astriax-native/host' + "`r`n" +
'      config:' + "`r`n" +
('        dataRoot: ''' + (($DshHome -replace '\\','/') + '/astriax-native') + '''') + "`r`n" +
'        watchdogMs: 10000' + "`r`n" +
('        bridgePort: ' + $BridgePort) + "`r`n" +
'    - id: ui-settings-astriax-native' + "`r`n" +
'      name: dsh-astriax-native' + "`r`n" +
$end
$pattern = '(?s)' + [regex]::Escape($begin) + '.*?' + [regex]::Escape($end)
if ($patch -match $pattern) { $patch = [regex]::Replace($patch, $pattern, $block) }
else { $patch = $patch.TrimEnd() + "`r`n`r`n" + $block + "`r`n" }
[IO.File]::WriteAllText($patchFile, $patch, (New-Object Text.UTF8Encoding($false)))
Write-Output ('profile patch updated: ' + $patchFile)
$dataRoot = Join-Path $DshHome 'astriax-native'
New-Item -ItemType Directory -Path (Join-Path $dataRoot 'bridge') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dataRoot 'qq-work') -Force | Out-Null
Copy-Item (Join-Path $PackageRoot 'bridge\server.mjs') (Join-Path $dataRoot 'bridge\server.mjs') -Force
Write-Output ('bridge copied to: ' + (Join-Path $dataRoot 'bridge\server.mjs'))
Write-Output 'Bridge will auto-start with the DSH plugin after DSH restart.'
Write-Output ''
Write-Output 'Next steps:'
Write-Output '1. Fully restart DSH.'
Write-Output '2. Open Settings -> AstriaX Native -> Runtimes.'
Write-Output '3. Install Python, AstrBot and NapCat runtimes.'
Write-Output '4. Create an AstrBot instance, start it once, then use "Auto detect and configure DSH Provider".'
Write-Output '5. Create/pair a NapCat instance and log in to QQ.'
