$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$command = Get-Command node.exe -ErrorAction SilentlyContinue
$node = if ($command) { $command.Source } else { $null }
if ($node) {
  try { if ([int]((& $node -p "process.versions.node.split('.')[0]").Trim()) -lt 24) { $node = $null } } catch { $node = $null }
}
if (-not $node) {
  if (-not [Environment]::Is64BitOperatingSystem) { throw 'Otomatik Node.js kurulumu Windows x64 içindir.' }
  $version = '24.21.0'
  $archiveName = "node-v$version-win-x64.zip"
  $runtime = Join-Path $PSScriptRoot '.runtime\node'
  $installed = Join-Path $runtime "node-v$version-win-x64\node.exe"
  if (-not (Test-Path -LiteralPath $installed)) {
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    $archive = Join-Path $runtime $archiveName
    $base = "https://nodejs.org/dist/v$version"
    Write-Host 'Node.js 24 ilk kullanım için indiriliyor ve doğrulanıyor…'
    $checksums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing).Content
    $line = $checksums -split "`n" | Where-Object { $_.Trim() -match "^[a-fA-F0-9]{64}\s+$([regex]::Escape($archiveName))$" } | Select-Object -First 1
    if (-not $line) { throw 'Node.js doğrulama değeri bulunamadı.' }
    $line = $line.Trim()
    Invoke-WebRequest -Uri "$base/$archiveName" -OutFile $archive -UseBasicParsing
    $expected = ($line -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw 'Node.js indirme bütünlük kontrolü başarısız.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $runtime -Force
    Remove-Item -LiteralPath $archive -Force
  }
  $node = $installed
}
& $node --use-system-ca scripts/start.mjs
exit $LASTEXITCODE
