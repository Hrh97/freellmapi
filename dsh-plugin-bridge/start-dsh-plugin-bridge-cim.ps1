$ErrorActionPreference = 'Stop'
$root = 'D:\Ai\freellmapi'
$node = 'C:\Users\onemt\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\node.exe'
if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction Stop).Source }
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*dsh-plugin-bridge.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$cmd = '"' + $node + '" dsh-plugin-bridge.mjs'
$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $root }
Write-Output ("cim pid=" + $res.ProcessId + " return=" + $res.ReturnValue)
$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 500
  try { $h = Invoke-RestMethod -UseBasicParsing 'http://127.0.0.1:31418/healthz'; if ($h.ok) { $ok = $true; break } } catch {}
}
if (-not $ok) { throw 'bridge did not become healthy' }
$m = Invoke-RestMethod -Headers @{ Authorization = 'Bearer dsh-plugin-bridge-local' } 'http://127.0.0.1:31418/v1/models'
Write-Output ("healthy=true routes=" + $h.routes + " models=" + $m.data.Count)
Write-Output ("samples=" + (($m.data | Select-Object -First 5 -ExpandProperty id) -join ','))
