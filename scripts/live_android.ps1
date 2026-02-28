param(
  [string]$Target = "emulator-5554",
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

Write-Host "[live] Starting local dev server on port $Port ..."
$serverJob = Start-Job -ScriptBlock {
  param($P, $Root)
  Set-Location $Root
  npm run serve:web -- $P
} -ArgumentList $Port, (Get-Location).Path

Start-Sleep -Seconds 2

Write-Host "[live] Enabling adb reverse tcp:$Port -> tcp:$Port on $Target ..."
npx cap run android `
  --target $Target `
  --live-reload `
  --host 127.0.0.1 `
  --port $Port `
  --forwardPorts "$Port`:$Port"

Write-Host "[live] Stopping dev server ..."
Stop-Job $serverJob -ErrorAction SilentlyContinue | Out-Null
Remove-Job $serverJob -ErrorAction SilentlyContinue | Out-Null
