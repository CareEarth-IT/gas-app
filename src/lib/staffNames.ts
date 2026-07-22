import { apiGet } from "./api";

export type StaffNameEntry = {
  email: string;
  name: string;
  sealImageUrl?: string;
};

export type StaffLookupMaps = {
  nameMap: Map<string, string>;
  sealMap: Map<string, string>;
};

let cachedMaps: StaffLookupMaps | null = null;
let loadPromise: Promise<StaffLookupMaps> | null = null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildStaffLookupMaps(entries: StaffNameEntry[]): StaffLookupMaps {
  const nameMap = new Map<string, string>();
  const sealMap = new Map<string, string>();
  for (const entry of entries) {
    const email = normalizeEmail(entry.email);
    if (!email) continue;
    const name = entry.name?.trim();
    if (name) nameMap.set(email, name);
    const seal = entry.sealImageUrl?.trim();
    if (seal?.startsWith("http")) sealMap.set(email, seal);
  }
  return { nameMap, sealMap };
}

/** @deprecated buildStaffLookupMaps を使用 */
export function buildStaffNameMap(entries: StaffNameEntry[]): Map<string, string> {
  return buildStaffLookupMaps(entries).nameMap;
}

export async function fetchStaffLookupMaps(): Promise<StaffLookupMaps> {
  if (cachedMaps) return cachedMaps;

  if (!loadPromise) {
    loadPromise = apiGet<{ names: StaffNameEntry[] }>("/staff/display-names")
      .then((result) => {
        cachedMaps = buildStaffLookupMaps(result.names ?? []);
        return cachedMaps;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }

  return loadPromise;
}

export async function fetchStaffNameMap(): Promise<Map<string, string>> {
  const maps = await fetchStaffLookupMaps();
  return maps.nameMap;
}

export function clearStaffNameMapCache(): void {
  cachedMaps = null;
  loadPromise = null;
}

export function getStaffDisplayName(
  email: string | null | undefined,
  nameMap: Map<string, string>
): string | null {
  if (!email?.trim()) return null;
  const key = normalizeEmail(email);
  return nameMap.get(key) ?? null;
}

export function getStaffSealImageUrl(
  email: string | null | undefined,
  sealMap: Map<string, string>
): string | null {
  if (!email?.trim()) return null;
  return sealMap.get(normalizeEmail(email)) ?? null;
}

/** 氏名があれば氏名、なければメール。未設定時は「空き」 */
export function formatStaffLabel(
  email: string | null | undefined,
  nameMap: Map<string, string>,
  emptyLabel = "空き"
): string {
  if (!email?.trim()) return emptyLabel;
  return getStaffDisplayName(email, nameMap) ?? email.trim();
}
