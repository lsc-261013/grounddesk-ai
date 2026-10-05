$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ((Get-Location).Path -ne $projectRoot) {
  throw 'Run this script from the GroundDesk repository root.'
}
$runtimeVersion = [version](& node -p 'process.versions.node')
if (-not (($runtimeVersion.Major -eq 22 -and $runtimeVersion -ge [version]'22.21.0') -or $runtimeVersion -ge [version]'24.5.0')) {
  throw 'This optional proxy runner requires Node 22.21+ or 24.5+ with NODE_USE_ENV_PROXY support.'
}

$settings = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
$proxyAddress = $settings.ProxyServer
if ($settings.ProxyEnable -ne 1 -or $proxyAddress -notmatch '^127\.0\.0\.1:\d+$') {
  throw 'An existing enabled loopback HTTP proxy is required. No system setting was changed.'
}
if (Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Port 8787 is already in use. Stop the existing GroundDesk API before starting another.'
}

# Only this process tree adopts the existing proxy; deployed environments remain unchanged.
$env:NODE_USE_ENV_PROXY = '1'
$env:HTTPS_PROXY = "http://$proxyAddress"
$env:NO_PROXY = 'localhost,127.0.0.1,::1'
pnpm dev:api
exit $LASTEXITCODE
