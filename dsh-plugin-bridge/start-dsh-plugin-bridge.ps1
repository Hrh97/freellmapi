$ErrorActionPreference = 'Stop'
$root = 'D:\Ai\freellmapi'
$node = 'C:\Users\onemt\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\node.exe'
if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) { throw 'node.exe not found' }
$running = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*dsh-plugin-bridge.mjs*' }
if ($running) {
  foreach ($proc in $running) { Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue }
  Write-Output "stopped old pid=$($running.ProcessId -join ',')"
}
$p = Start-Process -FilePath $node -ArgumentList @('dsh-plugin-bridge.mjs') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root 'dsh-plugin-bridge.log') -RedirectStandardError (Join-Path $root 'dsh-plugin-bridge.err.log')
Write-Output "started node pid=$($p.Id)"
Start-Sleep -Milliseconds 1500
(Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:31418/healthz').Content
$models = Invoke-RestMethod -Headers @{ Authorization = 'Bearer dsh-plugin-bridge-local' } 'http://127.0.0.1:31418/v1/models'
Write-Output "models=$($models.data.Count)"
Write-Output ("samples=" + (($models.data | Select-Object -First 6 -ExpandProperty id) -join ','))
