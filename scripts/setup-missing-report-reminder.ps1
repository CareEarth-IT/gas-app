# 運転報告未提出リマインド（毎日 13:00 / 18:00 JST）
# Usage:
#   .\scripts\setup-missing-report-reminder.ps1
#   .\scripts\setup-missing-report-reminder.ps1 -JobSecret "your-secret"
#
# Cloud Run に CRON_JOB_SECRET を設定し、
# Cloud Scheduler から Hosting URL 経由で POST します（IAM invoker 不要）。

param(
    [string]$JobSecret = "",
    [string]$Project = "ce-gr-drive-2605st",
    [string]$Region = "asia-northeast1",
    [string]$Service = "gas-app",
    [string]$SchedulerLocation = "asia-northeast1",
    [string]$HostingUrl = "https://drive.careearth.net"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Missing driving-report reminder setup ===" -ForegroundColor Cyan
Write-Host "Project: $Project"
Write-Host "Service: $Service"
Write-Host ""

if (-not $JobSecret) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $JobSecret = [Convert]::ToBase64String($bytes)
    Write-Host "Generated new CRON_JOB_SECRET (kept on Cloud Run / Scheduler only)" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[1/3] Enable Cloud Scheduler API" -ForegroundColor Yellow
gcloud services enable cloudscheduler.googleapis.com --project=$Project --quiet
if ($LASTEXITCODE -ne 0) { throw "Failed to enable cloudscheduler.googleapis.com" }

Write-Host "[2/3] Set CRON_JOB_SECRET on Cloud Run" -ForegroundColor Yellow
gcloud run services update $Service `
    --region=$Region `
    --project=$Project `
    --update-env-vars="CRON_JOB_SECRET=$JobSecret" `
    --quiet
if ($LASTEXITCODE -ne 0) { throw "Cloud Run update failed" }

$Uri = "$($HostingUrl.TrimEnd('/'))/api/jobs/remind-missing-reports"
Write-Host "Job URI: $Uri"

function Upsert-SchedulerJob {
    param(
        [string]$Name,
        [string]$Schedule
    )

    $ErrorActionPreference = "Continue"
    $existing = gcloud scheduler jobs describe $Name `
        --location=$SchedulerLocation `
        --project=$Project `
        --format="value(name)" 2>$null
    $describeOk = ($LASTEXITCODE -eq 0 -and $existing)
    $ErrorActionPreference = "Stop"

    if ($describeOk) {
        Write-Host "  Recreating job: $Name ($Schedule)" -ForegroundColor DarkYellow
        gcloud scheduler jobs delete $Name `
            --location=$SchedulerLocation `
            --project=$Project `
            --quiet
        if ($LASTEXITCODE -ne 0) { throw "Failed to delete scheduler job: $Name" }
    } else {
        Write-Host "  Creating job: $Name ($Schedule)" -ForegroundColor Green
    }

    gcloud scheduler jobs create http $Name `
        --location=$SchedulerLocation `
        --project=$Project `
        --schedule=$Schedule `
        --time-zone="Asia/Tokyo" `
        --uri=$Uri `
        --http-method=POST `
        --headers="X-Job-Secret=$JobSecret,Content-Type=application/json" `
        --message-body="{}" `
        --attempt-deadline=180s `
        --quiet

    if ($LASTEXITCODE -ne 0) { throw "Scheduler job failed: $Name" }
}

Write-Host "[3/3] Create/update Scheduler jobs" -ForegroundColor Yellow
Upsert-SchedulerJob -Name "remind-missing-reports-1300" -Schedule "0 13 * * *"
Upsert-SchedulerJob -Name "remind-missing-reports-1800" -Schedule "0 18 * * *"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "  Endpoint: POST $Uri"
Write-Host "  Schedule: 13:00 and 18:00 (Asia/Tokyo) every day"
Write-Host ""
Write-Host "Manual test:" -ForegroundColor Cyan
Write-Host "  gcloud scheduler jobs run remind-missing-reports-1300 --location=$SchedulerLocation --project=$Project"
Write-Host ""
