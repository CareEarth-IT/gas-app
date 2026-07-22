# Local dev setup check
# Usage: powershell -ExecutionPolicy Bypass -File scripts/check-local-setup.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "=== Local setup check ===" -ForegroundColor Cyan
Write-Host ""

$ok = $true
$envPath = Join-Path $Root ".env"
$hasEnv = Test-Path $envPath
$localAdc = $false
$remoteApi = $false
$credPath = $null

if (-not $hasEnv) {
    Write-Host "[NG] .env missing" -ForegroundColor Red
    Write-Host "     Copy-Item .env.example .env" -ForegroundColor Yellow
    $ok = $false
} else {
    Write-Host "[OK] .env exists" -ForegroundColor Green
    foreach ($line in Get-Content $envPath) {
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*LOCAL_FIREBASE_ADC\s*=\s*"?true"?') { $localAdc = $true }
        if ($line -match '^\s*VITE_API_BASE_URL\s*=\s*"?([^"#]+)"?') { $remoteApi = $true }
        if ($line -match '^\s*GOOGLE_APPLICATION_CREDENTIALS\s*=\s*"?([^"#]+)"?') {
            $credPath = $Matches[1].Trim()
        }
        if ($line -match '^\s*FIREBASE_SERVICE_ACCOUNT_PATH\s*=\s*"?([^"#]+)"?') {
            $credPath = $Matches[1].Trim()
        }
    }
}

$hasAdminAuth = $false
if ($remoteApi) {
    Write-Host "[OK] Remote API mode (VITE_API_BASE_URL) - no local Firebase Admin needed" -ForegroundColor Green
    $hasAdminAuth = $true
} elseif ($localAdc) {
    Write-Host "[OK] LOCAL_FIREBASE_ADC=true (use gcloud auth application-default login)" -ForegroundColor Green
    $hasAdminAuth = $true
    $gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
    if (-not $gcloud) {
        Write-Host "[WARN] gcloud CLI not found - install Google Cloud SDK" -ForegroundColor Yellow
    }
} elseif ($credPath -and (Test-Path $credPath)) {
    Write-Host "[OK] Service account JSON found" -ForegroundColor Green
    Write-Host "     $credPath" -ForegroundColor DarkGray
    $hasAdminAuth = $true
} elseif ($credPath) {
    Write-Host "[NG] Service account JSON path invalid: $credPath" -ForegroundColor Red
    $ok = $false
} else {
    Write-Host "[NG] No Firebase Admin auth configured" -ForegroundColor Red
    Write-Host "     Pick one in .env:" -ForegroundColor Yellow
    Write-Host "       LOCAL_FIREBASE_ADC=true  (recommended, no JSON key)" -ForegroundColor Yellow
    Write-Host "       VITE_API_BASE_URL=...    (use production API)" -ForegroundColor Yellow
    $ok = $false
}

$configPath = Join-Path $Root "public\firebase-applet-config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "[NG] public\firebase-applet-config.json missing" -ForegroundColor Red
    $ok = $false
} else {
    Write-Host "[OK] firebase-applet-config.json exists" -ForegroundColor Green
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/firebase-status" -UseBasicParsing -TimeoutSec 3
    $json = $response.Content | ConvertFrom-Json
    if ($remoteApi) {
        Write-Host "[OK] Dev server running (admin uses remote API)" -ForegroundColor Green
    } elseif ($json.ok -and $json.firebase.connected) {
        Write-Host "[OK] Dev server running, Firestore connected" -ForegroundColor Green
    } elseif ($json.credentials -and -not $json.credentials.configured) {
        Write-Host "[NG] Server running but Firebase Admin not configured" -ForegroundColor Red
        $ok = $false
    } else {
        Write-Host "[WARN] Server running but Firestore issue" -ForegroundColor Yellow
        if ($json.firebase.error) { Write-Host "       $($json.firebase.error)" -ForegroundColor DarkYellow }
        if (-not $remoteApi) { $ok = $false }
    }
} catch {
    Write-Host "[--] Dev server not running (start: npm run dev)" -ForegroundColor DarkYellow
}

Write-Host ""
if ($ok) {
    Write-Host "Setup OK. Open:" -ForegroundColor Green
    Write-Host "  Driver: http://localhost:3000/" -ForegroundColor Cyan
    Write-Host "  Admin:  http://localhost:3000/admin" -ForegroundColor Cyan
    if ($localAdc -and -not $remoteApi) {
        Write-Host ""
        Write-Host "If admin API returns 401, run:" -ForegroundColor Yellow
        Write-Host "  gcloud auth application-default login --project ce-gr-drive-2605st" -ForegroundColor Yellow
    }
} else {
    Write-Host "Fix [NG] items, then restart: npm run dev" -ForegroundColor Red
    Write-Host "See: secrets\README.md" -ForegroundColor Yellow
}
Write-Host ""
