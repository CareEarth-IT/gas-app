export function formatTimestamp(value: unknown): string {
  if (!value) return "—";

  let date: Date;
  const v = value as { toDate?: () => Date };

  if (typeof v.toDate === "function") {
    date = v.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    return "—";
  }

  if (Number.isNaN(date.getTime())) return "—";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}/${m}/${d} ${h}:${min}`;
}

export function cell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? `${value.length}件` : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** APIキー不要の Google マップ検索URL */
export function buildGoogleMapsUrl(
  latitude: unknown,
  longitude: unknown
): string | null {
  const lat = typeof latitude === "number" ? latitude : Number(latitude);
  const lng = typeof longitude === "number" ? longitude : Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
