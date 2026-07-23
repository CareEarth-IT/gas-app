/**
 * 管理画面で全タブを閲覧できる部署名。
 * スタッフの所属部署名と一致した場合に閲覧権限を付与する。
 */
export const FULL_VIEW_DEPARTMENT_NAMES = ["経理部", "大阪管理部"] as const;

export type FullViewDepartmentName = (typeof FULL_VIEW_DEPARTMENT_NAMES)[number];

export function normalizeDepartmentLabel(name: string): string {
  return name.trim().replace(/\s+/g, "");
}

export function isFullViewDepartmentName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const normalized = normalizeDepartmentLabel(name);
  return FULL_VIEW_DEPARTMENT_NAMES.some(
    (allowed) => normalizeDepartmentLabel(allowed) === normalized
  );
}
