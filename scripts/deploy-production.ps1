# Production deploy: Cloud Run -> Firebase
# Usage: .\scripts\deploy-production.ps1

$ErrorActionPreference = "Stop"
$Project = "ce-gr-drive-2605st"
$Region = "asia-northeast1"
$Service = "gas-app"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "=== Production deploy start ===" -ForegroundColor Cyan
Write-Host "Project: $Project"
Write-Host "Cloud Run service: $Service"
Write-Host ""

Write-Host "[1/3] npm run build" -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Build failed"
}

Write-Host ""
Write-Host "[2/3] Cloud Run deploy" -ForegroundColor Yellow
gcloud run deploy $Service `
    --source . `
    --region $Region `
    --project $Project `
    --allow-unauthenticated `
    --no-invoker-iam-check `
    --service-account "firebase-adminsdk-fbsvc@ce-gr-drive-2605st.iam.gserviceaccount.com" `
    --update-env-vars "NODE_ENV=production" `
    --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Cloud Run deploy failed." -ForegroundColor Red
    Write-Host "If billing is not linked, link billing in GCP Console," -ForegroundColor Red
    Write-Host "then run: .\scripts\setup-cloudrun.ps1" -ForegroundColor Red
    throw "Cloud Run deploy failed"
}

Write-Host ""
Write-Host "[3/3] Firebase deploy (Firestore + Hosting)" -ForegroundColor Yellow
firebase deploy --only firestore,hosting --project $Project
if ($LASTEXITCODE -ne 0) {
    throw "Firebase deploy failed"
}

$RunUrl = gcloud run services describe $Service --region $Region --project $Project --format="value(status.url)" 2>$null

Write-Host ""
Write-Host "=== Deploy complete ===" -ForegroundColor Green
Write-Host "  Driver app:  https://$Project.web.app/"
Write-Host "  Admin:       https://$Project.web.app/admin"
if ($RunUrl) {
    Write-Host "  Cloud Run:   $RunUrl"
    Write-Host "  Health:      $RunUrl/health"
    Write-Host "  Via Hosting: https://$Project.web.app/api/health"
    Write-Host "  Firestore:   https://$Project.web.app/api/firebase-status"
}
Write-Host ""
