# Cloud Run 初回セットアップ（API 有効化 + IAM）
# 使い方: .\scripts\setup-cloudrun.ps1

$ErrorActionPreference = "Stop"
$Project = "ce-gr-drive-2605st"
$Region = "asia-northeast1"

Write-Host ""
Write-Host "=== Cloud Run 初回セットアップ ===" -ForegroundColor Cyan
Write-Host "プロジェクト: $Project"
Write-Host ""

gcloud config set project $Project

Write-Host "[1/3] API を有効化..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com storage.googleapis.com --project $Project

$ProjectNumber = gcloud projects describe $Project --format="value(projectNumber)"
$ComputeSa = "$ProjectNumber-compute@developer.gserviceaccount.com"
$CloudBuildSa = "$ProjectNumber@cloudbuild.gserviceaccount.com"
$RunSourcesBucket = "run-sources-$Project-$Region"

Write-Host "[2/3] デプロイ用 IAM を付与..." -ForegroundColor Yellow

function Add-ProjectRole($Member, $Role) {
    gcloud projects add-iam-policy-binding $Project `
        --member=$Member `
        --role=$Role `
        --condition=None `
        --quiet 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK: $Member -> $Role" -ForegroundColor Green
    } else {
        Write-Host "  SKIP/FAILED: $Member -> $Role" -ForegroundColor DarkYellow
    }
}

# Cloud Build: ソースビルド + Cloud Run デプロイ
Add-ProjectRole "serviceAccount:$CloudBuildSa" "roles/storage.admin"
Add-ProjectRole "serviceAccount:$CloudBuildSa" "roles/run.admin"
Add-ProjectRole "serviceAccount:$CloudBuildSa" "roles/artifactregistry.writer"
Add-ProjectRole "serviceAccount:$CloudBuildSa" "roles/iam.serviceAccountUser"
Add-ProjectRole "serviceAccount:$CloudBuildSa" "roles/logging.logWriter"

# Compute デフォルト SA: run-sources バケット読み取り（403 対策）
Add-ProjectRole "serviceAccount:$ComputeSa" "roles/storage.objectAdmin"
Add-ProjectRole "serviceAccount:$ComputeSa" "roles/artifactregistry.writer"
Add-ProjectRole "serviceAccount:$ComputeSa" "roles/logging.logWriter"

gcloud storage buckets add-iam-policy-binding "gs://$RunSourcesBucket" `
    --member="serviceAccount:$ComputeSa" `
    --role="roles/storage.objectAdmin" `
    --quiet 2>$null

Write-Host "[3/3] Cloud Run 実行 SA と Firestore 権限..." -ForegroundColor Yellow
Add-ProjectRole "serviceAccount:$ComputeSa" "roles/datastore.user"

$FirebaseAdminSa = "firebase-adminsdk-fbsvc@ce-gr-drive-2605st.iam.gserviceaccount.com"
Add-ProjectRole "serviceAccount:$FirebaseAdminSa" "roles/datastore.user"
Write-Host "  Cloud Run は firebase-adminsdk SA で起動してください（deploy:cloudrun に設定済み）" -ForegroundColor Cyan

Write-Host ""
Write-Host "セットアップ完了。次にデプロイ:" -ForegroundColor Green
Write-Host "  npm run deploy:cloudrun"
Write-Host ""
