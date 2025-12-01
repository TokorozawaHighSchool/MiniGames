# download_three_umd.ps1
# PowerShell スクリプト: three.min.js (UMD) をダウンロードして ./lib に保存します
# 使い方 (PowerShell):
#   .\download_three_umd.ps1

$ErrorActionPreference = 'Stop'
$version = '0.152.2'
$baseUrl = "https://cdn.jsdelivr.net/npm/three@$version/build/three.min.js"
$libDir = Join-Path -Path (Get-Location) -ChildPath 'lib'
if(-not (Test-Path $libDir)){
  New-Item -ItemType Directory -Path $libDir | Out-Null
}
$outFile = Join-Path -Path $libDir -ChildPath 'three.min.js'
Write-Host "Downloading three.min.js from $baseUrl ..."
Invoke-WebRequest -Uri $baseUrl -OutFile $outFile -UseBasicParsing
Write-Host "Saved to $outFile"
Write-Host "Done. You can now open index.html (file:///) — the page will attempt to load ./lib/three.min.js as a UMD fallback."