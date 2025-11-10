# download_three_module.ps1
# PowerShell スクリプト: three.module.js をダウンロードして ./lib に保存します
# 使い方 (PowerShell):
#   .\download_three_module.ps1

$ErrorActionPreference = 'Stop'
$version = '0.152.2'
$baseUrl = "https://cdn.jsdelivr.net/npm/three@$version/build/three.module.js"
$libDir = Join-Path -Path (Get-Location) -ChildPath 'lib'
if(-not (Test-Path $libDir)){
  New-Item -ItemType Directory -Path $libDir | Out-Null
}
$outFile = Join-Path -Path $libDir -ChildPath 'three.module.js'
Write-Host "Downloading three.module.js from $baseUrl ..."
Invoke-WebRequest -Uri $baseUrl -OutFile $outFile -UseBasicParsing
Write-Host "Saved to $outFile"
Write-Host "Done. You can now open index.html (file:///) — it will import ./lib/three.module.js as an ES module."