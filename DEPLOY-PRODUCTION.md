# 本番デプロイ手順書（省略版）

プロジェクト: **ce-gr-drive-2605st**  
構成: **Firebase Hosting + Firestore + Auth + Cloud Run + さくら PHP（メール・画像）**  
※ `/api/**` は Cloud Run へ転送。メールはさくら `send-mail.php` 経由。

---

## 構成図

```
ユーザー
  ↓
Firebase Hosting  (https://ce-gr-drive-2605st.web.app)
  ├─ / , /admin     → React アプリ（dist/）
  └─ /api/**        → Cloud Run サービス gas-app（API 主軸）
                        ↓ Firebase Admin SDK
                      Firestore（DB）
認証              → Firebase Auth（ブラウザ）→ ID トークンを API に送信
画像                → さくらサーバー
```

**データの流れ:** ブラウザは Firestore に直接アクセスせず、Cloud Run API 経由で読み書きします。

---

## Cloud Run もデプロイが必要？

**はい。** Hosting から Cloud Run に転送するには、**先に Cloud Run サービス `gas-app` をデプロイしておく必要**があります。

| 手順 | 内容 |
|------|------|
| ① ビルド | `npm run build` |
| ② **Cloud Run デプロイ** | `gas-app` を公開デプロイ（必須） |
| ③ Firebase デプロイ | Hosting（rewrite 含む）+ Firestore |

②を飛ばすと、③の Hosting デプロイが失敗するか、`/api` が動きません。

---

## 前提

### API 有効化（初回のみ）

```powershell
.\scripts\setup-cloudrun.ps1
```

`run.googleapis.com` などを有効化し、Cloud Run のサービスアカウントに **Firestore 読み書き権限**（`roles/datastore.user`）を付与します。Hosting デプロイ（rewrite あり）にも必要です。

### Blaze について

| 作業 | Blaze |
|------|-------|
| Cloud Run デプロイ | GCP 請求先があれば可（Blaze 不要なことも） |
| Hosting → Cloud Run の rewrite | **Blaze が必要な場合あり** |

Hosting デプロイで 403 が出たら Firebase Console で Blaze にアップグレードしてください。

### ツール

```powershell
gcloud auth login
firebase login
gcloud config set project ce-gr-drive-2605st
```

---

## 本番デプロイ（毎回）

```powershell
cd C:\xampp\htdocs\gas-app
npm run deploy:production
```

手動:

```powershell
npm run build
npm run deploy:cloudrun
firebase deploy --only firestore,hosting --project ce-gr-drive-2605st
```

**必ず Cloud Run → Firebase の順**で実行してください。

---

## デプロイ後の確認

| 確認項目 | 方法 |
|---------|------|
| ドライバーアプリ | https://ce-gr-drive-2605st.web.app/ （タイトル「社用車管理アプリ」） |
| 管理画面 | https://ce-gr-drive-2605st.web.app/admin |
| **Hosting → Cloud Run 連携** | https://ce-gr-drive-2605st.web.app/api/health → `{"ok":true}` |
| **Cloud Run → Firestore** | https://ce-gr-drive-2605st.web.app/api/firebase-status → `{"ok":true,"firebase":{"connected":true,...}}` |
| Cloud Run 直 | GCP Console → Cloud Run → gas-app → URL + `/health` |

`/api/health` が JSON を返せば、Hosting 経由の Cloud Run 連携は成功です。  
`/api/firebase-status` で `firebase.connected: true` なら、Cloud Run から Firestore へのアクセスも成功です。  
HTML が返る場合は、Cloud Run 未デプロイまたは rewrite 未反映です。

### ローカルで Firebase Admin を試す場合

```powershell
gcloud auth application-default login
npm run dev
# http://localhost:3000/api/firebase-status
```

### ブラウザキャッシュ

画面が古い場合は `Ctrl + Shift + R` でスーパーリロードしてください。

---

## トラブルシューティング

| エラー | 対処 |
|--------|------|
| Cloud Run Admin API 403 | `npm run setup:cloudrun` を実行 |
| `/api/health` が HTML | ② Cloud Run デプロイ後に ③ Firebase を再実行 |
| Blaze 関連エラー | Firebase Blaze にアップグレード |
| ログインできない | Auth 承認ドメインを確認 |
| `/api/firebase-status` が 503 | `npm run setup:cloudrun` で IAM 付与、または Cloud Run のサービスアカウントに `roles/datastore.user` を手動付与 |
| `storage.objects.get` denied（デプロイ失敗） | `npm run setup:cloudrun` を実行してから `npm run deploy:cloudrun` を再実行 |

---

## 2回目以降

```powershell
npm run deploy:production
```

Cloud Run のみ更新:

```powershell
npm run deploy:cloudrun
```

Firebase のみ更新:

```powershell
npm run build
npm run deploy:firebase
```
