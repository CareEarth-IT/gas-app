import { getAdminDb } from "./firebaseAdmin.ts";

const COLLECTIONS = [
  { name: "drivingLogs", sortFields: ["startTime", "reportTime", "endTime"] },
  { name: "reservations", sortFields: ["startTime", "createdAt"] },
  { name: "etcRecords", sortFields: ["startTime", "endTime"] },
  { name: "gpsLogs", sortFields: ["timestamp"] }
] as const;

const BATCH_SIZE = 400;

type TrimResult = {
  total: number;
  kept: string | null;
  deleted: number;
};

type FirestoreTimestamp = { toDate?: () => Date; _seconds?: number };

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object") {
    const ts = value as FirestoreTimestamp;
    if (typeof ts.toDate === "function") return ts.toDate().getTime();
    if (typeof ts._seconds === "number") return ts._seconds * 1000;
  }
  return 0;
}

function docSortTime(
  data: Record<string, unknown>,
  sortFields: readonly string[]
): number {
  for (const field of sortFields) {
    const ms = toMillis(data[field]);
    if (ms > 0) return ms;
  }
  return 0;
}

async function trimCollection(
  collectionName: string,
  sortFields: readonly string[]
): Promise<TrimResult> {
  const db = getAdminDb();
  const snap = await db.collection(collectionName).get();

  if (snap.empty) {
    return { total: 0, kept: null, deleted: 0 };
  }

  const sorted = [...snap.docs].sort((a, b) => {
    const aTime = docSortTime(a.data() as Record<string, unknown>, sortFields);
    const bTime = docSortTime(b.data() as Record<string, unknown>, sortFields);
    return bTime - aTime;
  });

  const keep = sorted[0];
  const remove = sorted.slice(1);

  let deleted = 0;
  for (let i = 0; i < remove.length; i += BATCH_SIZE) {
    const chunk = remove.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return { total: sorted.length, kept: keep.id, deleted };
}

export async function trimOperationalData(): Promise<
  Record<string, TrimResult>
> {
  const summary: Record<string, TrimResult> = {};

  for (const { name, sortFields } of COLLECTIONS) {
    summary[name] = await trimCollection(name, sortFields);
  }

  return summary;
}
