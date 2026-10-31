[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$AstrBotRuntimeDir,
  [string]$InstanceDir = '',
  [int]$BridgePort = 18081
)
$ErrorActionPreference = 'Stop'
$PackageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtime = (Resolve-Path $AstrBotRuntimeDir).Path
$providerSrc = Join-Path $PackageRoot 'assets\dsh_bridge_source.py'
if (-not (Test-Path $providerSrc)) { throw 'provider asset not found: ' + $providerSrc }
$providerDir = Join-Path $runtime 'astrbot\core\provider\sources'
$providerDst = Join-Path $providerDir 'dsh_bridge_source.py'
New-Item -ItemType Directory -Path $providerDir -Force | Out-Null
Copy-Item $providerSrc $providerDst -Force
$managerFile = Join-Path $runtime 'astrbot\core\provider\manager.py'
$managerText = Get-Content $managerFile -Raw
if ($managerText -notmatch 'case "dsh_bridge"') {
  $anchor = '            case "openai_chat_completion":'
  if ($managerText -notmatch [regex]::Escape($anchor)) { throw 'provider manager anchor not found' }
  $insert = '            case "dsh_bridge":' + "`r`n" + '                from .sources.dsh_bridge_source import (' + "`r`n" + '                    ProviderDSHBridge as ProviderDSHBridge,' + "`r`n" + '                )' + "`r`n"
  $managerText = $managerText.Replace($anchor, $insert + $anchor)
  [IO.File]::WriteAllText($managerFile, $managerText, (New-Object Text.UTF8Encoding($false)))
}
if ($InstanceDir) {
  $instance = (Resolve-Path $InstanceDir).Path
  $configFile = Join-Path $instance 'data\cmd_config.json'
  if (-not (Test-Path $configFile)) { throw 'cmd_config.json not found. Start AstrBot once first: ' + $configFile }
  $tokenFile = Join-Path $env:USERPROFILE '.dsh\qq-bridge-token.txt'
  $token = ''
  if (Test-Path $tokenFile) { $token = (Get-Content $tokenFile -Raw).Trim() }
  if (-not $token) { throw 'bridge token not found: ' + $tokenFile }
  $cfg = Get-Content $configFile -Raw | ConvertFrom-Json
  if (-not $cfg.provider_sources) { $cfg | Add-Member -NotePropertyName provider_sources -NotePropertyValue @() }
  if (-not $cfg.provider) { $cfg | Add-Member -NotePropertyName provider -NotePropertyValue @() }
  $sources = @($cfg.provider_sources) | Where-Object { $_ -and $_.id -ne 'dsh' }
  $sources += [pscustomobject]@{ id='dsh'; provider='dsh'; type='dsh_bridge'; provider_type='chat_completion'; api_base=('http://127.0.0.1:' + $BridgePort); key=@('dsh'); token=$token; timeout=390; custom_headers=@{}; enable=$true }
  $cfg.provider_sources = @($sources)
  $providers = @($cfg.provider) | Where-Object { $_ -and $_.id -ne 'dsh/dsh' }
  $providers += [pscustomobject]@{ id='dsh/dsh'; enable=$true; provider_source_id='dsh'; model='dsh'; modalities=@('text','tool_use'); custom_extra_body=@{}; max_context_tokens=0 }
  $cfg.provider = @($providers)
  $backup = $configFile + '.bak-dsh-provider-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
  Copy-Item $configFile $backup
  [IO.File]::WriteAllText($configFile, ($cfg | ConvertTo-Json -Depth 100), (New-Object Text.UTF8Encoding($false)))
  Write-Output ('provider configured in ' + $configFile)
}
Write-Output ('DSH provider adapter installed in ' + $runtime)
