import type { Firestore } from "firebase-admin/firestore";

import { parseDepartmentOfficers } from "../shared/departmentOfficers.ts";
import {
  collectStaffDepartmentIds,
  departmentSetsOverlap,
  expandDepartmentIdsByName,
  type DepartmentRef
} from "../shared/departmentScope.ts";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function loadDepartments(db: Firestore): Promise<DepartmentRef[]> {
  const snap = await db.collection("departments").get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    name: String((doc.data().name as string | undefined) ?? "").trim()
  }));
}

export async function getOfficerSeedDepartmentIds(
  db: Firestore,
  officerEmail: string
): Promise<string[]> {
  const key = normalizeEmail(officerEmail);
  const snap = await db.collection("departments").get();
  const ids: string[] = [];

  for (const doc of snap.docs) {
    const officers = parseDepartmentOfficers(doc.data());
    if (officers.map((officer) => normalizeEmail(officer.email)).includes(key)) {
      ids.push(doc.id);
    }
  }

  return ids;
}

export async function getStaffSeedDepartmentIds(
  db: Firestore,
  staffEmail: string
): Promise<string[]> {
  const snap = await db
    .collection("staffProfiles")
    .doc(normalizeEmail(staffEmail))
    .get();
  if (!snap.exists) return [];
  return collectStaffDepartmentIds(
    snap.data() as Parameters<typeof collectStaffDepartmentIds>[0]
  );
}

export async function getExpandedDepartmentIds(
  db: Firestore,
  seedIds: string[],
  departments?: DepartmentRef[]
): Promise<string[]> {
  if (seedIds.length === 0) return [];
  const allDepartments = departments ?? (await loadDepartments(db));
  return expandDepartmentIdsByName(seedIds, allDepartments);
}

export async function canOfficerApproveStaff(
  db: Firestore,
  officerEmail: string,
  staffEmail: string
): Promise<boolean> {
  const departments = await loadDepartments(db);
  const [officerExpanded, staffExpanded] = await Promise.all([
    getExpandedDepartmentIds(
      db,
      await getOfficerSeedDepartmentIds(db, officerEmail),
      departments
    ),
    getExpandedDepartmentIds(
      db,
      await getStaffSeedDepartmentIds(db, staffEmail),
      departments
    )
  ]);

  return departmentSetsOverlap(officerExpanded, staffExpanded);
}

export async function getStaffEmailsVisibleToOfficer(
  db: Firestore,
  officerEmail: string
): Promise<{ departmentIds: string[]; staffEmails: string[] }> {
  const departments = await loadDepartments(db);
  const officerExpanded = await getExpandedDepartmentIds(
    db,
    await getOfficerSeedDepartmentIds(db, officerEmail),
    departments
  );

  if (officerExpanded.length === 0) {
    return { departmentIds: [], staffEmails: [] };
  }

  const officerSet = new Set(officerExpanded);
  const staffSnap = await db.collection("staffProfiles").get();
  const staffEmails: string[] = [];

  for (const doc of staffSnap.docs) {
    const seedIds = collectStaffDepartmentIds(
      doc.data() as Parameters<typeof collectStaffDepartmentIds>[0]
    );
    const staffExpanded = expandDepartmentIdsByName(seedIds, departments);
    if (staffExpanded.some((id) => officerSet.has(id))) {
      staffEmails.push(normalizeEmail(doc.id));
    }
  }

  return { departmentIds: officerExpanded, staffEmails };
}

export async function getApproverEmailsForStaff(
  db: Firestore,
  staffEmail: string
): Promise<{ emails: string[]; departmentNames: string[] }> {
  const departments = await loadDepartments(db);
  const staffExpanded = await getExpandedDepartmentIds(
    db,
    await getStaffSeedDepartmentIds(db, staffEmail),
    departments
  );

  if (staffExpanded.length === 0) {
    return { emails: [], departmentNames: [] };
  }

  const expandedSet = new Set(staffExpanded);
  const emails = new Set<string>();
  const names = new Set<string>();
  const deptSnap = await db.collection("departments").get();

  for (const doc of deptSnap.docs) {
    if (!expandedSet.has(doc.id)) continue;
    const data = doc.data();
    const name = String((data.name as string | undefined) ?? "").trim();
    if (name) names.add(name);
    for (const officer of parseDepartmentOfficers(data)) {
      if (officer.email) emails.add(normalizeEmail(officer.email));
    }
  }

  return {
    emails: [...emails],
    departmentNames: [...names]
  };
}
