# Cloud Run + Firebase 運用ガイド

> **本番デプロイだけ行う場合は [DEPLOY-PRODUCTION.md](./DEPLOY-PRODUCTION.md) を参照してください。**

このアプリは次の構成で運用します。

| 役割 | サービス |
|------|----------|
| フロント（ドライバーアプリ・管理画面） | **Firebase Hosting**（`dist/` を配信） |
| API | **Cloud Run**（`server.ts` → `dist/server.cjs`） |
| データベース・認証 | **Firestore** / **Firebase Auth** |
| メール送信 | **さくら PHP**（`sakura/send-mail.php`） |
| 画像アップロード | **さくら PHP**（`upload.php`） |

---

## 前提

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)（`gcloud`）
2. [Firebase CLI](https://firebase.google.com/docs/cli)（`firebase login` 済み）
3. Firebase プロジェクト **ce-gr-drive-2605st** の **Blaze（従量課金）** プラン  
   ※ Hosting → Cloud Run の rewrite には Blaze が必要です
4. ローカルで `gcloud auth login` と `gcloud config set project ce-gr-drive-2605st`

---

## 初回セットアップ

### 1. Firebase 設定ファイル

`public/firebase-applet-config.json` に本番の Firebase Web 設定が入っていることを確認します。  
ビルド時に `dist/` にコピーされます。

### 2. Cloud Run 環境変数（メール）

```powershell
.\scripts\setup-sakura-mail-cloudrun.cmd <SAKURA_MAIL_SECRET>
```

### 3. Firebase Auth の承認ドメイン

[Firebase Console](https://console.firebase.google.com/) → Authentication → Settings → Authorized domains に以下を追加します。

- `drive.careearth.net`
- `ce-gr-drive-2605st.web.app`
- `ce-gr-drive-2605st.firebaseapp.com`

### 4. Firestore ルールの管理者メール

`shared/adminEmails.ts` を編集後、`npm run sync:admin` で `firestore.rules` に反映してください。

---

## デプロイ手順

**順番が重要です。** 先に Cloud Run、次に Firebase です。

```bash
npm run deploy:production
```

手動:

```bash
npm run build
npm run deploy:cloudrun
firebase deploy --only firestore,hosting --project ce-gr-drive-2605st
```

---

## アクセス URL

| 画面 | URL |
|------|-----|
| ドライバーアプリ | `https://drive.careearth.net/` |
| 管理画面 | `https://drive.careearth.net/admin` |
| ヘルスチェック | `https://gas-app-231655548437.asia-northeast1.run.app/health` |

---

## ローカル開発

```bash
cd C:\xampp\htdocs\gas-app
Copy-Item .env.example .env
npm run dev
```

起動後、**必ず次の URL をブラウザで開いてください。**

| 画面 | URL |
|------|-----|
| ドライバーアプリ | **http://localhost:3000/** |
| 管理画面 | **http://localhost:3000/admin** |

### よくある間違い

- ❌ `http://localhost/gas-app` … XAMPP のパス。**このアプリでは動きません**
- ❌ `https://localhost:3000` … **http**（s なし）を使ってください
- ✅ `http://localhost:3000/` … 正しい URL

ローカルで管理画面のデータが取れない場合は、`.env` に `VITE_API_BASE_URL` を設定して本番 API を使うか、`LOCAL_FIREBASE_ADC=true` と `gcloud auth application-default login` を設定してください。詳細は `secrets/README.md`。

```powershell
.\scripts\check-local-setup.ps1
```

---

## トラブルシューティング

| 症状 | 確認事項 |
|------|----------|
| ログインできない | Auth の承認ドメイン、 `firebase-applet-config.json` |
| API が 404 | Cloud Run がデプロイ済みか、`firebase.json` の `serviceId` が一致しているか |
| Firestore 権限エラー | `npm run deploy:firestore` でルールをデプロイしたか |
| 管理画面でデータ取得失敗（ローカル） | `.env` の `VITE_API_BASE_URL` または Firebase Admin 認証情報 |
| メールが届かない | Cloud Run の `SAKURA_MAIL_*`、さくらの `send-mail.php` |
| Hosting rewrite エラー | Blaze プランか、Cloud Run と Firebase が同一 GCP プロジェクトか |

### Cloud Run サービス名を変える場合

`firebase.json` の `hosting.rewrites` 内 `serviceId` を合わせて変更してください。

```json
"run": {
  "serviceId": "your-service-name",
  "region": "asia-northeast1"
}
```
