import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type { ApprovalStatus } from "../shared/drivingApproval.ts";

type ApprovalKind = "driving" | "etc";

type StaffProfileDoc = {
  skipDrivingApproval?: boolean;
  skipEtcApproval?: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function loadStaffProfile(
  db: Firestore,
  email: string
): Promise<StaffProfileDoc | undefined> {
  const snap = await db
    .collection("staffProfiles")
    .doc(normalizeEmail(email))
    .get();
  if (!snap.exists) return undefined;
  return snap.data() as StaffProfileDoc;
}

function staffSkipsApproval(
  profile: StaffProfileDoc | undefined,
  kind: ApprovalKind
): boolean {
  if (!profile) return false;
  return kind === "driving"
    ? profile.skipDrivingApproval === true
    : profile.skipEtcApproval === true;
}

/** スタッフ設定に応じた初期承認状態（承認省略のスタッフは即 approved） */
export async function resolveInitialApprovalStatus(
  db: Firestore,
  email: string,
  kind: ApprovalKind
): Promise<ApprovalStatus> {
  const profile = await loadStaffProfile(db, email);
  return staffSkipsApproval(profile, kind) ? "approved" : "pending";
}

/** 新規作成（collection.add）用。FieldValue.delete() は add では使えない */
export function approvalFieldsForCreate(
  status: ApprovalStatus,
  approverEmail?: string
): Record<string, unknown> {
  if (status === "approved") {
    return {
      approvalStatus: "approved",
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: approverEmail ?? "(自動承認)"
    };
  }
  return { approvalStatus: status === "rejected" ? "rejected" : "pending" };
}

/** 更新（doc.update）用。pending 時は承認フィールドを削除する */
export function approvalFieldsForStatus(
  status: ApprovalStatus,
  approverEmail?: string
): Record<string, unknown> {
  if (status === "approved") {
    return {
      approvalStatus: "approved",
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: approverEmail ?? "(自動承認)"
    };
  }
  return {
    approvalStatus: status === "rejected" ? "rejected" : "pending",
    approvedAt: FieldValue.delete(),
    approvedBy: FieldValue.delete()
  };
}
