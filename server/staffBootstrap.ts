import { FieldValue, type Firestore } from "firebase-admin/firestore";

import { inferEmploymentType } from "../shared/staffTypes.ts";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type StaffBootstrapResult = {
  created: boolean;
};

/**
 * ログイン・新規登録時に staffProfiles へ自動登録する。
 * 既存ドキュメント（管理画面・社員サイト同期）は変更しない。
 */
export async function bootstrapStaffProfile(
  db: Firestore,
  email: string,
  name?: string | null
): Promise<StaffBootstrapResult> {
  const key = normalizeEmail(email);
  if (!key) {
    return { created: false };
  }

  const ref = db.collection("staffProfiles").doc(key);
  const existing = await ref.get();
  if (existing.exists) {
    return { created: false };
  }

  await ref.set({
    email: key,
    name: name?.trim() || null,
    employmentType: inferEmploymentType(key),
    departmentId: null,
    skipDrivingApproval: false,
    skipEtcApproval: false,
    syncedFrom: "self-registration",
    syncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return { created: true };
}
