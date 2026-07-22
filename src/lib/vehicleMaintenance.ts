import { apiGet, apiPatch, apiPost } from "./api";
import { waitForAuthReady } from "./firebase";

export type MaintenanceType = "oil" | "tire";

export type VehicleMaintenanceRecord = {
  id?: string;
  vehicleNumber: string;
  type: MaintenanceType;
  performedAt: Date;
  mileageKm: number;
};

function toRecord(row: Record<string, unknown> & { id: string }): VehicleMaintenanceRecord {
  const performedAt = row.performedAt;
  let date: Date;

  if (typeof performedAt === "string") {
    date = new Date(performedAt);
  } else if (performedAt instanceof Date) {
    date = performedAt;
  } else {
    date = new Date();
  }

  return {
    id: row.id,
    vehicleNumber: String(row.vehicleNumber ?? ""),
    type: row.type === "tire" ? "tire" : "oil",
    performedAt: date,
    mileageKm: Number(row.mileageKm ?? 0)
  };
}

async function requireSignedIn() {
  const user = await waitForAuthReady();
  if (!user) {
    throw new Error("ログインが必要です。");
  }
  return user;
}

export async function fetchMaintenanceRecords(): Promise<VehicleMaintenanceRecord[]> {
  await requireSignedIn();
  const rows = await apiGet<Array<Record<string, unknown> & { id: string }>>(
    "/vehicle-maintenance"
  );
  return rows.map(toRecord);
}

export async function createMaintenanceRecord(
  data: Omit<VehicleMaintenanceRecord, "id">
): Promise<string> {
  await requireSignedIn();
  const result = await apiPost<{ id: string }>("/vehicle-maintenance", {
    vehicleNumber: data.vehicleNumber.trim(),
    type: data.type,
    performedAt: data.performedAt.toISOString(),
    mileageKm: data.mileageKm
  });
  return result.id;
}

export async function updateMaintenanceRecord(
  id: string,
  data: Partial<Pick<VehicleMaintenanceRecord, "performedAt" | "mileageKm">>
): Promise<void> {
  await requireSignedIn();
  const payload: Record<string, unknown> = {};
  if (data.performedAt) {
    payload.performedAt = data.performedAt.toISOString();
  }
  if (data.mileageKm != null) {
    payload.mileageKm = data.mileageKm;
  }
  await apiPatch(`/vehicle-maintenance/${id}`, payload);
}
