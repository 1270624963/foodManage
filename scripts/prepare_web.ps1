$ErrorActionPreference = "Stop"
node scripts/sync_env.mjs
New-Item -ItemType Directory -Force www | Out-Null
Get-ChildItem www -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item index.html,styles.css,app.js,api.js,config.js,manifest.webmanifest,sw.js www -Force
if (Test-Path icons) {
  Copy-Item icons www\icons -Recurse -Force
}
