import type { Firestore } from "firebase-admin/firestore";

import { isAdminEmail } from "./adminConfig.ts";
import {
  canOfficerApproveStaff,
  getStaffEmailsVisibleToOfficer
} from "./departmentScope.ts";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type OfficerContext = {
  departmentIds: string[];
  staffEmails: string[];
};

/** いずれかの部署の役員（上長）メールに含まれるか */
export async function isOfficerEmail(
  db: Firestore,
  email: string | null | undefined
): Promise<boolean> {
  const key = normalizeEmail(email ?? "");
  if (!key) return false;

  const ctx = await getStaffEmailsVisibleToOfficer(db, key);
  return ctx.departmentIds.length > 0;
}

/** 上長が担当する部署と、その部署スタッフのメール一覧 */
export async function getOfficerContext(
  db: Firestore,
  officerEmail: string
): Promise<OfficerContext> {
  return getStaffEmailsVisibleToOfficer(db, officerEmail);
}

export async function canApproveStaffRecord(
  db: Firestore,
  approverEmail: string | null | undefined,
  staffEmail: string | null | undefined
): Promise<boolean> {
  const approver = normalizeEmail(approverEmail ?? "");
  if (!approver) return false;
  if (isAdminEmail(approver)) return true;

  const driver = normalizeEmail(staffEmail ?? "");
  if (!driver) return false;

  return canOfficerApproveStaff(db, approver, driver);
}

/** @deprecated canApproveStaffRecord を使用 */
export const canApproveDrivingLog = canApproveStaffRecord;
