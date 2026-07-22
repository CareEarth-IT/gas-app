# さくらサーバー（violetgoat8）への PHP 配置

運転報告メール・画像アップロードは **violetgoat8** 上の PHP から処理します。

## 1. PHP をアップロード

**violetgoat8** のコントロールパネル → **ファイルマネージャー** → **`www/employee.drive/`** に配置:

| ローカル | サーバー |
|----------|----------|
| `sakura/send-mail.php` | `www/employee.drive/send-mail.php` |
| `upload.php` | `www/employee.drive/upload.php` |

フォルダ構成:

```
www/
  employee.drive/
    send-mail.php
    upload.php
    photos/          ← upload.php が自動作成
```

## 2. send-mail.php の SMTP パスワード（重要）

`send-mail.php` をアップロード後、サーバー上で編集:

```php
$SMTP_PASS = "employee.drive@careearth.net のメールパスワード";
```

`ok:true` でも届かない場合、`mb_send_mail()` ではなく **SMTP 認証**が必要です（新版で対応済み）。

## 3. 秘密鍵

`send-mail.php` の `$API_SECRET` を Cloud Run の `SAKURA_MAIL_SECRET` と同じ値にする。

## 4. Cloud Run 環境変数

```cmd
scripts\setup-sakura-mail-cloudrun.cmd YOUR_SECRET_HERE
```

## 5. デプロイ

```cmd
npm run build
npm run deploy:cloudrun
npm run deploy:hosting
```

## 確認

- `https://violetgoat8.sakura.ne.jp/employee.drive/send-mail.php` → `{"error":"POST only"}`
