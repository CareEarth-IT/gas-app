# Employee site -> Drive app staff sync
# Usage:
#   .\scripts\setup-employee-site-sync-cloudrun.ps1 -SyncSecret "same-secret-on-both-cloud-runs"

param(
    [Parameter(Mandatory = $true)]
    [string]$SyncSecret,

    [string]$Project = "ce-gr-drive-2605st",
    [string]$Region = "asia-northeast1",
    [string]$Service = "gas-app"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Employee site sync -> Drive Cloud Run ===" -ForegroundColor Cyan
Write-Host "Service: $Service"
Write-Host "Set the same EMPLOYEE_SITE_SYNC_SECRET on employee Cloud Run." -ForegroundColor Yellow
Write-Host ""

gcloud run services update $Service `
    --region $Region `
    --project $Project `
    --update-env-vars "EMPLOYEE_SITE_SYNC_SECRET=$SyncSecret" `
    --quiet

if ($LASTEXITCODE -ne 0) { throw "Cloud Run update failed" }

Write-Host ""
Write-Host "Done. Drive API endpoints:" -ForegroundColor Green
Write-Host "  GET  /api/integrations/employee-site/departments"
Write-Host "  POST /api/integrations/employee-site/staff-profiles"
Write-Host ""
