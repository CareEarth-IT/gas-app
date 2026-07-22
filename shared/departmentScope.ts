export type DepartmentRef = {
  id: string;
  name: string;
};

export function normalizeDepartmentName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function collectStaffDepartmentIds(data: {
  departmentId?: string | null;
  departmentIds?: string[] | null;
}): string[] {
  const ids = new Set<string>();
  const single = data.departmentId?.trim();
  if (single) ids.add(single);
  for (const id of data.departmentIds ?? []) {
    const trimmed = id?.trim();
    if (trimmed) ids.add(trimmed);
  }
  return [...ids];
}

/** 同じ部署名のドキュメントも含めて部署 ID を広げる */
export function expandDepartmentIdsByName(
  seedIds: string[],
  departments: DepartmentRef[]
): string[] {
  if (seedIds.length === 0) return [];

  const byId = new Map(departments.map((dept) => [dept.id, dept]));
  const names = new Set<string>();

  for (const id of seedIds) {
    const dept = byId.get(id);
    if (dept?.name) {
      names.add(normalizeDepartmentName(dept.name));
    }
  }

  const expanded = new Set(seedIds);
  for (const dept of departments) {
    if (names.has(normalizeDepartmentName(dept.name))) {
      expanded.add(dept.id);
    }
  }

  return [...expanded];
}

export function departmentSetsOverlap(
  leftIds: string[],
  rightIds: string[]
): boolean {
  if (leftIds.length === 0 || rightIds.length === 0) return false;
  const right = new Set(rightIds);
  return leftIds.some((id) => right.has(id));
}
