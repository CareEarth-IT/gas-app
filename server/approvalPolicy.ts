import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type { ApprovalStatus } from "../shared/drivingApproval.ts";

type StaffProfileDoc = {
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

function staffSkipsApproval(profile: StaffProfileDoc | undefined): boolean {
  return profile?.skipEtcApproval === true;
}

/** スタッフ設定に応じた初期承認状態（承認省略のスタッフは即 approved） */
export async function resolveInitialApprovalStatus(
  db: Firestore,
  email: string
): Promise<ApprovalStatus> {
  const profile = await loadStaffProfile(db, email);
  return staffSkipsApproval(profile) ? "approved" : "pending";
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
