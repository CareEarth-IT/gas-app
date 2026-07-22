import type { Firestore } from "firebase-admin/firestore";

import { toDate } from "./drivingLogic.ts";
import { sendMail } from "./mail/index.ts";

export type MissingReportLog = {
  id: string;
  email: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  startTime?: unknown;
  endTime?: unknown;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function formatJstDateTime(value: unknown): string {
  const date = toDate(value as Parameters<typeof toDate>[0]);
  if (!date) return "不明";
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

/** 運転終了済み・報告未提出（status=driving かつ endTime あり） */
export async function findMissingDrivingReports(
  db: Firestore
): Promise<MissingReportLog[]> {
  const snap = await db
    .collection("drivingLogs")
    .where("status", "==", "driving")
    .limit(500)
    .get();

  const results: MissingReportLog[] = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as {
      email?: string;
      endTime?: unknown;
      vehicleNumber?: string;
      vehicleModel?: string;
      startTime?: unknown;
    };
    if (!data.endTime) continue;
    const email = normalizeEmail(data.email ?? "");
    if (!email) continue;

    results.push({
      id: docSnap.id,
      email,
      vehicleNumber: data.vehicleNumber,
      vehicleModel: data.vehicleModel,
      startTime: data.startTime,
      endTime: data.endTime
    });
  }

  return results;
}

function buildReminderText(log: MissingReportLog): string {
  const appUrl =
    process.env.APP_URL?.replace(/\/$/, "") ?? "https://drive.careearth.net";
  const vehicle =
    [log.vehicleNumber, log.vehicleModel].filter(Boolean).join(" ") || "不明";

  return [
    "運転報告の提出をお願いします。",
    "",
    "運転は終了していますが、運転報告がまだ提出されていません。",
    "アプリから運転報告を入力してください。",
    "",
    `車両: ${vehicle}`,
    `運転開始: ${formatJstDateTime(log.startTime)}`,
    `運転終了: ${formatJstDateTime(log.endTime)}`,
    "",
    `アプリ: ${appUrl}/`,
    "",
    "※本メールは毎日 13:00 / 18:00（日本時間）に自動送信されています。"
  ].join("\n");
}

export type ReminderJobResult = {
  missingCount: number;
  uniqueRecipients: number;
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: string;
};

/**
 * 未提出の運転報告がある利用者へリマインドメールを送る。
 * 同一メールに複数件ある場合は最新の1件の内容で1通だけ送る。
 */
export async function runMissingReportReminderJob(
  db: Firestore
): Promise<ReminderJobResult> {
  const missing = await findMissingDrivingReports(db);
  if (missing.length === 0) {
    return {
      missingCount: 0,
      uniqueRecipients: 0,
      sent: 0,
      failed: 0,
      skipped: false
    };
  }

  const byEmail = new Map<string, MissingReportLog>();
  for (const log of missing) {
    const existing = byEmail.get(log.email);
    if (!existing) {
      byEmail.set(log.email, log);
      continue;
    }
    const existingEnd = toDate(existing.endTime as Parameters<typeof toDate>[0])?.getTime() ?? 0;
    const nextEnd = toDate(log.endTime as Parameters<typeof toDate>[0])?.getTime() ?? 0;
    if (nextEnd >= existingEnd) {
      byEmail.set(log.email, log);
    }
  }

  let sent = 0;
  let failed = 0;

  for (const log of byEmail.values()) {
    const ok = await sendMail({
      to: log.email,
      subject: "【社用車】運転報告が未入力です",
      text: buildReminderText(log)
    });
    if (ok) sent += 1;
    else failed += 1;
  }

  return {
    missingCount: missing.length,
    uniqueRecipients: byEmail.size,
    sent,
    failed,
    skipped: false
  };
}
