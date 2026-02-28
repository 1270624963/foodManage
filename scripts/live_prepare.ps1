param(
  [string]$Target = "emulator-5554",
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

Write-Host "[live] Step 1/6: sync env"
npm run sync:env | Out-Host

Write-Host "[live] Step 2/6: set capacitor live server -> http://127.0.0.1:$Port"
$cfgPath = "capacitor.config.json"
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
if (-not $cfg.server) {
  $cfg | Add-Member -NotePropertyName server -NotePropertyValue (@{})
}
$cfg.server.androidScheme = "http"
$cfg.server.url = "http://127.0.0.1:$Port"
$cfg | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $cfgPath

Write-Host "[live] Step 3/6: cap sync android"
npx cap sync android | Out-Host

Write-Host "[live] Step 4/6: force Java 17 for Android build"
$gradleFile = "android/app/capacitor.build.gradle"
$gradleText = Get-Content $gradleFile -Raw
$gradleText = $gradleText -replace "JavaVersion\.VERSION_21", "JavaVersion.VERSION_17"
Set-Content -Encoding UTF8 $gradleFile $gradleText

Write-Host "[live] Step 5/6: build apk"
android\gradlew.bat -p android assembleDebug | Out-Host

Write-Host "[live] Step 6/6: adb reverse + install + start"
& "E:\acode\Android\leidian\LDPlayer9\adb.exe" -s $Target reverse "tcp:$Port" "tcp:$Port" | Out-Host
& "E:\acode\Android\leidian\LDPlayer9\adb.exe" -s $Target install -r "android\app\build\outputs\apk\debug\app-debug.apk" | Out-Host
& "E:\acode\Android\leidian\LDPlayer9\adb.exe" -s $Target shell am start -n "com.food.manager/.MainActivity" | Out-Host

Write-Host "[live] ready. Keep 'npm run serve:web' running while coding."
