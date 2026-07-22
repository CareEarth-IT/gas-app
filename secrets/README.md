# ローカル開発の認証設定

組織ポリシーで **Firebase サービスアカウントの秘密鍵 JSON がダウンロードできない** 場合、次のいずれかを使います。

---

## 方法A（推奨）: gcloud でログイン（秘密鍵不要）

自分の Google アカウントに GCP の権限があれば、JSON なしでローカル API が動きます。

### 手順

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) をインストール

2. ログインとプロジェクト設定:

```powershell
gcloud auth login
gcloud config set project ce-gr-drive-2605st
gcloud auth application-default login --project ce-gr-drive-2605st
```

3. プロジェクト直下の `.env` に追加:

```env
LOCAL_FIREBASE_ADC=true
```

4. 開発サーバー再起動:

```powershell
npm run dev
```

起動ログに `Firebase Admin: gcloud Application Default Credentials` と出れば OK。

### 権限が足りない場合

GCP 管理者に、自分の Google アカウントへ次のいずれかの付与を依頼してください。

- `Firebase Admin` ロール
- または `編集者`（Editor）

---

## 方法B: 画面だけローカル・API は本番（最も簡単）

秘密鍵も gcloud も不要です。ブラウザは `localhost:3000`、API だけ本番 Cloud Run を呼びます。

### 手順

`.env` に1行追加:

```env
VITE_API_BASE_URL="https://gas-app-231655548437.asia-northeast1.run.app"
```

```powershell
npm run dev
```

管理画面: http://localhost:3000/admin  
（Google ログイン後、本番 API でデータ取得）

---

## 方法C: サービスアカウント JSON（許可されている場合のみ）

Firebase Console → サービスアカウント → 新しい秘密鍵の生成  
→ `secrets/firebase-adminsdk.json` に保存

```env
GOOGLE_APPLICATION_CREDENTIALS="C:\xampp\htdocs\gas-app\secrets\firebase-adminsdk.json"
```

---

## 確認コマンド

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-local-setup.ps1
```
