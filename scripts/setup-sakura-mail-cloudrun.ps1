# さくら PHP 経由メールを Cloud Run (gas-app) に設定
# Usage (cmd):
#   scripts\setup-sakura-mail-cloudrun.cmd "send-mail.phpと同じ秘密鍵"
# Usage (PowerShell):
#   .\scripts\setup-sakura-mail-cloudrun.ps1 -MailSecret "send-mail.phpと同じ秘密鍵"

param(
    [Parameter(Mandatory = $true)]
    [string]$MailSecret,

    [string]$MailUrl = "https://violetgoat8.sakura.ne.jp/employee.drive/send-mail.php",
    [string]$AppUrl = "https://drive.careearth.net",
    [string]$Project = "ce-gr-drive-2605st",
    [string]$Region = "asia-northeast1",
    [string]$Service = "gas-app"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Sakura mail -> Cloud Run ===" -ForegroundColor Cyan
Write-Host "SAKURA_MAIL_URL: $MailUrl"
Write-Host "APP_URL: $AppUrl"
Write-Host "MAIL_PROVIDER: sakura (default; do NOT set firebase on production)"
Write-Host ""

$envVars = @(
    "NODE_ENV=production",
    "SAKURA_MAIL_SECRET=$MailSecret",
    "SAKURA_MAIL_URL=$MailUrl",
    "APP_URL=$AppUrl"
) -join ","

gcloud run services update $Service `
    --region $Region `
    --project $Project `
    --update-env-vars $envVars

if ($LASTEXITCODE -ne 0) { throw "Cloud Run update failed" }

Write-Host ""
Write-Host "Done. Deploy latest code with: npm run deploy:cloudrun" -ForegroundColor Green
Write-Host "Then submit a driving report on production to test." -ForegroundColor Green
Write-Host ""
