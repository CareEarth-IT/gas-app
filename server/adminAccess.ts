import type { Firestore } from "firebase-admin/firestore";

import { isFullViewDepartmentName } from "../shared/adminViewAccess.ts";
import { isAdminEmail } from "./adminConfig.ts";
import {
  getExpandedDepartmentIds,
  getStaffSeedDepartmentIds,
  loadDepartmentsForAccess
} from "./departmentScope.ts";
import { isOfficerEmail } from "./officerAuth.ts";

export type AdminAccessRole = "admin" | "officer" | "viewer" | "none";

export type AdminAccess = {
  role: AdminAccessRole;
  canApproveDrivingLogs: boolean;
  canViewAllTabs: boolean;
  canEditMaster: boolean;
};

async function isStaffInFullViewDepartment(
  db: Firestore,
  email: string
): Promise<boolean> {
  const departments = await loadDepartmentsForAccess(db);
  const staffExpanded = await getExpandedDepartmentIds(
    db,
    await getStaffSeedDepartmentIds(db, email),
    departments
  );
  if (staffExpanded.length === 0) return false;

  const byId = new Map(departments.map((dept) => [dept.id, dept.name]));
  return staffExpanded.some((id) => isFullViewDepartmentName(byId.get(id)));
}

export async function resolveAdminAccess(
  db: Firestore,
  email: string | null | undefined
): Promise<AdminAccess> {
  const key = (email ?? "").trim().toLowerCase();
  if (!key) {
    return {
      role: "none",
      canApproveDrivingLogs: false,
      canViewAllTabs: false,
      canEditMaster: false
    };
  }

  if (isAdminEmail(key)) {
    return {
      role: "admin",
      canApproveDrivingLogs: true,
      canViewAllTabs: true,
      canEditMaster: true
    };
  }

  if (await isOfficerEmail(db, key)) {
    return {
      role: "officer",
      canApproveDrivingLogs: true,
      canViewAllTabs: true,
      canEditMaster: false
    };
  }

  if (await isStaffInFullViewDepartment(db, key)) {
    return {
      role: "viewer",
      canApproveDrivingLogs: false,
      canViewAllTabs: true,
      canEditMaster: false
    };
  }

  return {
    role: "none",
    canApproveDrivingLogs: false,
    canViewAllTabs: false,
    canEditMaster: false
  };
}

/** 役員シード取得の副作用なし確認用（departmentScope の load 公開） */
export async function canViewAdminPanel(
  db: Firestore,
  email: string | null | undefined
): Promise<boolean> {
  const access = await resolveAdminAccess(db, email);
  return access.canViewAllTabs;
}
