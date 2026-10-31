[CmdletBinding()]
param([string]$Output = 'release')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$out = Join-Path $root $Output
New-Item -ItemType Directory -Path $out -Force | Out-Null
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$archive = Join-Path $out ("dsh-astriax-native-v$version.zip")
if (Test-Path $archive) { Remove-Item $archive -Force }
git archive --format=zip --prefix=dsh-astriax-native/ -o $archive HEAD
$hash = (Get-FileHash $archive -Algorithm SHA256).Hash
"$hash  $([IO.Path]::GetFileName($archive))" | Set-Content "$archive.sha256" -Encoding ascii
Write-Output $archive
Write-Output "$archive.sha256"
