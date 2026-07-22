export type DepartmentOfficer = {
  name?: string;
  email: string;
};

export function normalizeOfficerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** API 保存用: 氏名・メールを正規化し、メール重複を除く */
export function normalizeOfficersInput(
  officers?: DepartmentOfficer[] | null,
  legacyEmails?: string[] | null
): DepartmentOfficer[] {
  const seen = new Set<string>();
  const result: DepartmentOfficer[] = [];

  const push = (name: string | undefined, email: string) => {
    const normalized = normalizeOfficerEmail(email);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    const trimmedName = name?.trim();
    result.push(
      trimmedName ? { name: trimmedName, email: normalized } : { email: normalized }
    );
  };

  if (officers?.length) {
    for (const officer of officers) {
      push(officer.name, String(officer.email ?? ""));
    }
    return result;
  }

  for (const email of legacyEmails ?? []) {
    push(undefined, String(email));
  }
  return result;
}

export function parseDepartmentOfficers(data: {
  officers?: unknown;
  officerEmails?: unknown;
}): DepartmentOfficer[] {
  if (Array.isArray(data.officers)) {
    return normalizeOfficersInput(data.officers as DepartmentOfficer[], null);
  }
  return normalizeOfficersInput(null, data.officerEmails as string[]);
}

export function officerEmailsFromOfficers(
  officers: DepartmentOfficer[]
): string[] {
  return officers.map((officer) => officer.email);
}

export function formatOfficerLabel(officer: DepartmentOfficer): string {
  const name = officer.name?.trim();
  return name ? `${name}（${officer.email}）` : officer.email;
}
