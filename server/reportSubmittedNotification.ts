import type { Firestore } from "firebase-admin/firestore";

import { NOTIFICATION_FALLBACK_EMAILS } from "../shared/adminEmails.ts";
import { collectStaffDepartmentIds } from "../shared/departmentScope.ts";
import { inferEmploymentType } from "../shared/staffTypes.ts";
import { getApproverEmailsForStaff } from "./departmentScope.ts";
import { toDate } from "./drivingLogic.ts";
import { sendMail } from "./mail/index.ts";

type DrivingLogReport = {
  email?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  destination?: string;
  purpose?: string;
  remarks?: string;
  startMileageKm?: number;
  endMileageKm?: number;
  startTime?: unknown;
  endTime?: unknown;
  reportTime?: unknown;
};

type StaffProfileDoc = {
  name?: string;
  employmentType?: "employee" | "part_time";
  departmentId?: string;
  departmentIds?: string[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function formatJstDateTime(value: unknown): string {
  const date = toDate(value as Parameters<typeof toDate>[0]);
  if (!date) return "不明";
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

async function loadStaffProfile(
  db: Firestore,
  email: string
): Promise<{
  exists: boolean;
  name?: string;
  departmentIds: string[];
}> {
  const key = normalizeEmail(email);
  const snap = await db.collection("staffProfiles").doc(key).get();
  if (!snap.exists) {
    return { exists: false, departmentIds: [] };
  }
  const data = snap.data() as StaffProfileDoc;
  return {
    exists: true,
    name: data.name,
    departmentIds: collectStaffDepartmentIds(data)
  };
}

async function resolveNotificationRecipients(
  db: Firestore,
  staffEmail: string,
  context?: {
    kind: "driving" | "etc";
    recordId: string;
    email: string;
    staffProfileExists?: boolean;
  }
): Promise<{
  emails: string[];
  departmentName?: string;
  usedAdminFallback: boolean;
  usedAllDepartmentsFallback: boolean;
}> {
  const { emails: officers, departmentNames } = await getApproverEmailsForStaff(
    db,
    staffEmail
  );
  const departmentName =
    departmentNames.length > 0 ? departmentNames.join("、") : undefined;

  if (officers.length > 0) {
    return {
      emails: officers,
      departmentName,
      usedAdminFallback: false,
      usedAllDepartmentsFallback: false
    };
  }

  const fallback = NOTIFICATION_FALLBACK_EMAILS.map((e) => e.toLowerCase());
  console.warn("notification using admin fallback emails", {
    ...context,
    fallbackCount: fallback.length
  });
  return {
    emails: fallback,
    departmentName,
    usedAdminFallback: true,
    usedAllDepartmentsFallback: false
  };
}

function buildReportEmailText(options: {
  staffLabel: string;
  staffEmail: string;
  departmentName?: string;
  log: DrivingLogReport;
  drivingLogId: string;
  usedAdminFallback?: boolean;
}): string {
  const {
    staffLabel,
    staffEmail,
    departmentName,
    log,
    drivingLogId,
    usedAdminFallback
  } = options;
  const distanceKm =
    log.startMileageKm != null &&
    log.endMileageKm != null &&
    Number.isFinite(log.startMileageKm) &&
    Number.isFinite(log.endMileageKm)
      ? log.endMileageKm - log.startMileageKm
      : null;

  const adminUrl =
    process.env.APP_URL?.replace(/\/$/, "") ?? "https://drive.careearth.net";

  const lines = [
    "所属部署の役員各位",
    "",
    "以下のスタッフから運転報告が提出されました。",
    "",
    `スタッフ: ${staffLabel}（${staffEmail}）`,
    departmentName ? `所属: ${departmentName}` : null,
    `車両: ${[log.vehicleNumber, log.vehicleModel].filter(Boolean).join(" ") || "不明"}`,
    `目的地: ${log.destination?.trim() || "未入力"}`,
    `利用目的: ${log.purpose?.trim() || "未入力"}`,
    log.remarks?.trim() ? `備考: ${log.remarks.trim()}` : null,
    log.startMileageKm != null ? `出発時走行距離: ${log.startMileageKm} km` : null,
    log.endMileageKm != null ? `終了時走行距離: ${log.endMileageKm} km` : null,
    distanceKm != null ? `走行距離: ${distanceKm} km` : null,
    `運転開始: ${formatJstDateTime(log.startTime)}`,
    `運転終了: ${formatJstDateTime(log.endTime)}`,
    `報告日時: ${formatJstDateTime(log.reportTime ?? new Date())}`,
    "",
    `管理画面: ${adminUrl}/admin`,
    `記録 ID: ${drivingLogId}`,
    "",
    "管理画面の運転記録タブから承認してください。承認されるまで正式な記録として認められません。",
    "※本メールは運転報告の送信時に自動送信されています。",
    usedAdminFallback
      ? "※申請者の所属部署に役員メールが未設定のため、管理者宛に送信しています。"
      : null
  ].filter(Boolean);

  return lines.join("\n");
}

/** 運転報告提出時に所属部署の役員へ通知メールを送る */
export async function notifyOfficersOnReportSubmitted(
  db: Firestore,
  drivingLogId: string,
  log: DrivingLogReport
): Promise<{ sent: boolean; officerCount: number }> {
  const email = log.email?.trim();
  if (!email) {
    console.warn("report notification skipped: missing driver email", {
      drivingLogId
    });
    return { sent: false, officerCount: 0 };
  }

  const normalizedEmail = normalizeEmail(email);
  const profile = await loadStaffProfile(db, normalizedEmail);
  const { emails: officers, departmentName, usedAdminFallback } =
    await resolveNotificationRecipients(db, normalizedEmail, {
      kind: "driving",
      recordId: drivingLogId,
      email: normalizedEmail,
      staffProfileExists: profile.exists
    });

  if (officers.length === 0) {
    console.warn("report notification skipped: no recipients", {
      drivingLogId,
      email: normalizedEmail,
      departmentIds: profile.departmentIds,
      staffProfileExists: profile.exists,
      employmentType: inferEmploymentType(normalizedEmail)
    });
    return { sent: false, officerCount: 0 };
  }

  const staffLabel = profile.name?.trim() || normalizedEmail;
  const ok = await sendMail({
    to: officers,
    subject: "【社用車】運転報告が提出されました",
    text: buildReportEmailText({
      staffLabel,
      staffEmail: normalizedEmail,
      departmentName,
      log,
      drivingLogId,
      usedAdminFallback
    })
  });

  return { sent: ok, officerCount: officers.length };
}

type EtcRecordSubmitted = {
  email?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  category?: string;
  otherReason?: string;
  destination?: string;
  routeStart?: string;
  routeEnd?: string;
  startTime?: unknown;
  endTime?: unknown;
  approvalStatus?: string;
};

function buildEtcEmailText(options: {
  staffLabel: string;
  staffEmail: string;
  departmentName?: string;
  record: EtcRecordSubmitted;
  etcRecordId: string;
  usedAdminFallback?: boolean;
}): string {
  const {
    staffLabel,
    staffEmail,
    departmentName,
    record,
    etcRecordId,
    usedAdminFallback
  } = options;
  const adminUrl =
    process.env.APP_URL?.replace(/\/$/, "") ?? "https://drive.careearth.net";

  const lines = [
    "所属部署の役員各位",
    "",
    "以下のスタッフから ETC 利用申請が提出されました。",
    "",
    `スタッフ: ${staffLabel}（${staffEmail}）`,
    departmentName ? `所属: ${departmentName}` : null,
    `車両: ${[record.vehicleNumber, record.vehicleModel].filter(Boolean).join(" ") || "不明"}`,
    `カテゴリ: ${record.category?.trim() || "未入力"}`,
    record.otherReason?.trim()
      ? `その他の理由: ${record.otherReason.trim()}`
      : null,
    `①ICの乗り口、降り口: ${record.routeStart?.trim() || "未入力"} → ${record.routeEnd?.trim() || "未入力"}`,
    `ETC 利用開始: ${formatJstDateTime(record.startTime)}`,
    `申請日時: ${formatJstDateTime(record.endTime ?? new Date())}`,
    record.approvalStatus === "approved"
      ? "承認状態: スタッフ設定により自動承認済み"
      : "承認状態: 上長の承認待ち",
    "",
    `管理画面: ${adminUrl}/admin`,
    `記録 ID: ${etcRecordId}`,
    "",
    "管理画面の ETC タブから承認してください。承認されるまで正式な記録として認められません。",
    "※本メールは ETC 利用申請の送信時に自動送信されています。",
    usedAdminFallback
      ? "※申請者の所属部署に役員メールが未設定のため、管理者宛に送信しています。"
      : null
  ].filter(Boolean);

  return lines.join("\n");
}

/** ETC 利用申請提出時に所属部署の役員へ通知メールを送る */
export async function notifyOfficersOnEtcSubmitted(
  db: Firestore,
  etcRecordId: string,
  record: EtcRecordSubmitted
): Promise<{ sent: boolean; officerCount: number }> {
  const email = record.email?.trim();
  if (!email) {
    console.warn("etc notification skipped: missing driver email", {
      etcRecordId
    });
    return { sent: false, officerCount: 0 };
  }

  const normalizedEmail = normalizeEmail(email);
  const profile = await loadStaffProfile(db, normalizedEmail);
  const { emails: officers, departmentName, usedAdminFallback } =
    await resolveNotificationRecipients(db, normalizedEmail, {
      kind: "etc",
      recordId: etcRecordId,
      email: normalizedEmail,
      staffProfileExists: profile.exists
    });

  if (officers.length === 0) {
    console.warn("etc notification skipped: no recipients", {
      etcRecordId,
      email: normalizedEmail,
      departmentIds: profile.departmentIds,
      staffProfileExists: profile.exists,
      employmentType: inferEmploymentType(normalizedEmail)
    });
    return { sent: false, officerCount: 0 };
  }

  const staffLabel = profile.name?.trim() || normalizedEmail;
  const ok = await sendMail({
    to: officers,
    subject: "【社用車】ETC利用申請が提出されました",
    text: buildEtcEmailText({
      staffLabel,
      staffEmail: normalizedEmail,
      departmentName,
      record,
      etcRecordId,
      usedAdminFallback
    })
  });

  return { sent: ok, officerCount: officers.length };
}
