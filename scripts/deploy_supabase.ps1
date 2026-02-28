param(
  [Parameter(Mandatory = $true)]
  [string]$AccessToken,
  [Parameter(Mandatory = $true)]
  [string]$DbPassword,
  [Parameter(Mandatory = $false)]
  [string]$ProjectRef
)

$ErrorActionPreference = "Stop"

function Read-EnvFile([string]$FilePath) {
  $map = @{}
  if (-not (Test-Path $FilePath)) {
    return $map
  }

  foreach ($raw in Get-Content -Encoding UTF8 $FilePath) {
    $line = $raw.Trim()
    if (-not $line -or $line.StartsWith("#")) { continue }
    $eq = $line.IndexOf("=")
    if ($eq -le 0) { continue }
    $key = $line.Substring(0, $eq).Trim()
    if ($key.StartsWith([char]0xFEFF)) { $key = $key.Substring(1) }
    $value = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
    $map[$key] = $value
  }

  return $map
}

$root = Split-Path -Parent $PSScriptRoot
$envMap = @{}
$envMain = Read-EnvFile (Join-Path $root ".env")
foreach ($k in $envMain.Keys) {
  $envMap[$k] = $envMain[$k]
}
$envLocal = Read-EnvFile (Join-Path $root ".env.local")
foreach ($k in $envLocal.Keys) {
  $envMap[$k] = $envLocal[$k]
}

if (-not $ProjectRef) {
  if ($envMap.ContainsKey("SUPABASE_PROJECT_REF")) {
    $ProjectRef = $envMap["SUPABASE_PROJECT_REF"]
  } else {
    $supabaseUrl = $null
    if ($envMap.ContainsKey("SUPABASE_URL")) { $supabaseUrl = $envMap["SUPABASE_URL"] }
    elseif ($envMap.ContainsKey("NEXT_PUBLIC_SUPABASE_URL")) { $supabaseUrl = $envMap["NEXT_PUBLIC_SUPABASE_URL"] }

    if ($supabaseUrl) {
      $uri = [Uri]$supabaseUrl
      $ProjectRef = $uri.Host.Split(".")[0]
    }
  }
}

if (-not $ProjectRef) {
  throw "Missing ProjectRef. Pass -ProjectRef, or set SUPABASE_PROJECT_REF/SUPABASE_URL in .env"
}

$env:SUPABASE_ACCESS_TOKEN = $AccessToken
$env:npm_config_cache = "E:\workspace\food\.npm-cache"

Write-Host "Link project..."
npx --yes supabase link --project-ref $ProjectRef --password $DbPassword

Write-Host "Push database migrations..."
npx --yes supabase db push

Write-Host "Deploy edge function: food-items"
npx --yes supabase functions deploy food-items --project-ref $ProjectRef

Write-Host "Deploy edge function: dashboard-stats"
npx --yes supabase functions deploy dashboard-stats --project-ref $ProjectRef

Write-Host "Done. project-ref=$ProjectRef"
