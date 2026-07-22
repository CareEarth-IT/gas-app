import { FieldValue, type Firestore } from "firebase-admin/firestore";

import type { EmployeeSiteStaffInput } from "./employeeSiteAuth.ts";
import { inferEmploymentType } from "../shared/staffTypes.ts";

type DepartmentIndex = Map<string, string>;

export type StaffSyncResult = {
  email: string;
  ok: boolean;
  created?: boolean;
  error?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDepartmentKey(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

async function buildDepartmentIndex(db: Firestore): Promise<DepartmentIndex> {
  const snap = await db.collection("departments").get();
  const index = new Map<string, string>();

  for (const doc of snap.docs) {
    const name = (doc.data().name as string | undefined)?.trim();
    if (!name) continue;
    index.set(normalizeDepartmentKey(name), doc.id);
  }

  return index;
}

function resolveEmploymentType(
  email: string,
  raw?: string
): "employee" | "part_time" | null {
  if (raw === "employee" || raw === "part_time") return raw;
  if (!raw || !String(raw).trim()) {
    return inferEmploymentType(email);
  }
  return null;
}

function resolveDepartmentId(
  input: EmployeeSiteStaffInput,
  index: DepartmentIndex
): string | null {
  const departmentId = input.departmentId?.trim();
  if (departmentId) return departmentId;

  const departmentName = input.departmentName?.trim();
  if (!departmentName) return null;

  return index.get(normalizeDepartmentKey(departmentName)) ?? null;
}

export async function syncStaffFromEmployeeSite(
  db: Firestore,
  inputs: EmployeeSiteStaffInput[]
): Promise<StaffSyncResult[]> {
  const departmentIndex = await buildDepartmentIndex(db);
  const results: StaffSyncResult[] = [];

  for (const input of inputs) {
    const email = normalizeEmail(String(input.email ?? ""));
    if (!email) {
      results.push({ email: "", ok: false, error: "email is required" });
      continue;
    }

    const employmentType = resolveEmploymentType(email, input.employmentType);
    if (!employmentType) {
      results.push({
        email,
        ok: false,
        error: "employmentType must be employee or part_time"
      });
      continue;
    }

    const departmentId = resolveDepartmentId(input, departmentIndex);
    if (!departmentId) {
      results.push({
        email,
        ok: false,
        error: "departmentId or departmentName is required and must match drive departments"
      });
      continue;
    }

    if (input.departmentId?.trim()) {
      const deptSnap = await db.collection("departments").doc(departmentId).get();
      if (!deptSnap.exists) {
        results.push({
          email,
          ok: false,
          error: `departmentId not found: ${departmentId}`
        });
        continue;
      }
    }

    try {
      const ref = db.collection("staffProfiles").doc(email);
      const existing = await ref.get();
      const payload: Record<string, unknown> = {
        email,
        name: input.name?.trim() || null,
        employmentType,
        departmentId,
        syncedFrom: "employee-site",
        syncedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!existing.exists) {
        payload.skipDrivingApproval = false;
        payload.skipEtcApproval = false;
      }

      await ref.set(payload, { merge: true });
      results.push({
        email,
        ok: true,
        created: !existing.exists
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ email, ok: false, error: message });
    }
  }

  return results;
}

export async function listDepartmentsForEmployeeSite(
  db: Firestore
): Promise<Array<{ id: string; name: string }>> {
  const snap = await db.collection("departments").orderBy("name").get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    name: String((doc.data().name as string | undefined) ?? "").trim()
  }));
}
