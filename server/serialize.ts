import type { Timestamp } from "firebase-admin/firestore";

function isTimestamp(value: unknown): value is Timestamp {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Timestamp).toDate === "function"
  );
}

export function serializeValue(value: unknown): unknown {
  if (isTimestamp(value)) {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value && typeof value === "object") {
    return serializeDoc(value as Record<string, unknown>);
  }
  return value;
}

export function serializeDoc<T extends Record<string, unknown>>(
  data: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = serializeValue(value);
  }
  return result;
}

export function serializeDocs(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): Array<Record<string, unknown> & { id: string }> {
  return docs.map((docSnap) => ({
    id: docSnap.id,
    ...serializeDoc(docSnap.data())
  }));
}
