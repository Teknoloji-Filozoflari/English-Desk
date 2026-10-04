$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$bundledNode = Join-Path $PSScriptRoot '../../work/runtime/node-v24.21.0-win-x64/node.exe'
$command = Get-Command node.exe -ErrorAction SilentlyContinue
if (Test-Path $bundledNode) { $nodePath = (Resolve-Path $bundledNode).Path }
elseif ($command) { $nodePath = $command.Source }
else { Write-Host 'Node.js 24 LTS gerekli: https://nodejs.org'; exit 1 }
& $nodePath --use-system-ca scripts/setup-translation.mjs
exit $LASTEXITCODE
