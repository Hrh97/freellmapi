$ErrorActionPreference = 'Stop'
$root = 'D:\Ai\freellmapi'
$node = 'C:\Users\onemt\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\node.exe'
if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction Stop).Source }
Set-Location $root
Write-Output '[1/5] refresh WorkBuddy shim credentials'
& $node 'refresh-dsh-plugin-bridge.mjs' | Out-Host
Write-Output '[2/5] restart stable bridge via CIM'
& powershell -NoProfile -ExecutionPolicy Bypass -File 'start-dsh-plugin-bridge-cim.ps1' | Out-Host
Write-Output '[3/5] register all bridge models in FreeLLMAPI'
& $node 'register-dsh-plugin-models.mjs' | Out-Host
Write-Output '[4/5] integrate Our Free Model and verify registration'
& $node 'v3_integrate_ofm_bridge.mjs' | Out-Host
Write-Output '[5/5] final end-to-end verification'
& $node 'verify-dsh-plugin-integration.mjs' | Out-Host
Write-Output 'Final snapshot: dsh-plugin-integration-final.json'
