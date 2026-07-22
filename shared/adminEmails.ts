/**
 * 管理画面（/admin）と管理 API にアクセスできる Google アカウントのメール一覧。
 *
 * 【追加手順】
 * 1. この配列にメールアドレスを追加（Google ログインで使うアドレス）
 * 2. npm run sync:admin        … firestore.rules を自動同期
 * 3. npm run build
 * 4. npm run deploy:cloudrun   … API の管理者チェックを反映
 * 5. firebase deploy --only firestore,hosting --project ce-gr-drive-2605st
 */
export const ADMIN_EMAILS = [
  "yuta_masui@careearth.info",
  "yuki_nishikawa@careearth.info",
] as const;

/**
 * 所属部署の役員メールが取れないときの承認通知フォールバック宛先。
 * 管理画面アクセス権限（ADMIN_EMAILS）とは別。
 */
export const NOTIFICATION_FALLBACK_EMAILS = [
  "yuta_masui@careearth.info",
] as const;

export type AdminEmail = (typeof ADMIN_EMAILS)[number];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase() as AdminEmail);
}
