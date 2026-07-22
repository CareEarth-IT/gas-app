import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { waitForAuthReady } from "./firebase";
import type { Vehicle, VehicleFormData } from "../types/vehicle";

function toApiError(err: unknown): Error {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return new Error(
        "保存権限がありません。管理者メールでログインしているか確認してください。"
      );
    }
    return err;
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}

async function requireSignedIn() {
  const user = await waitForAuthReady();
  if (!user) {
    throw new Error("ログインが必要です。再度ログインしてください。");
  }
  return user;
}

function toVehicle(id: string, data: Record<string, unknown>): Vehicle {
  const substituteUntil =
    typeof data.substituteUntil === "string" ? data.substituteUntil : "";
  const substituteEnd = substituteUntil ? new Date(substituteUntil) : null;
  const substituteIsEffective =
    !substituteEnd ||
    Number.isNaN(substituteEnd.getTime()) ||
    substituteEnd >= new Date();

  return {
    id,
    vehicleNumber: String(data.vehicleNumber ?? ""),
    chassisNumber: String(data.chassisNumber ?? ""),
    vehicleName: String(data.vehicleName ?? ""),
    modelType: String(data.modelType ?? ""),
    fuelType: String(data.fuelType ?? ""),
    usageArea: String(data.usageArea ?? ""),
    isPersonal: data.isPersonal === true,
    personalOwnerEmail: String(data.personalOwnerEmail ?? ""),
    isSubstitute: data.isSubstitute === true && substituteIsEffective,
    substituteUntil
  };
}

function sortVehicles(list: Vehicle[]): Vehicle[] {
  return [...list].sort((a, b) => {
    const areaCmp = a.usageArea.localeCompare(b.usageArea, "ja");
    if (areaCmp !== 0) return areaCmp;
    return a.vehicleName.localeCompare(b.vehicleName, "ja");
  });
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  await requireSignedIn();

  try {
    const rows = await apiGet<Array<Record<string, unknown> & { id: string }>>(
      "/vehicles"
    );
    return sortVehicles(
      rows.map((row) => toVehicle(row.id, row))
    );
  } catch (err) {
    throw toApiError(err);
  }
}

export async function createVehicle(data: VehicleFormData): Promise<string> {
  await requireSignedIn();

  try {
    const result = await apiPost<{ id: string }>("/vehicles", data);
    return result.id;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateVehicle(
  id: string,
  data: VehicleFormData
): Promise<void> {
  await requireSignedIn();

  try {
    await apiPatch(`/vehicles/${id}`, data);
  } catch (err) {
    throw toApiError(err);
  }
}

export async function deleteVehicle(id: string): Promise<void> {
  await requireSignedIn();

  try {
    await apiDelete(`/vehicles/${id}`);
  } catch (err) {
    throw toApiError(err);
  }
}

export async function claimVehicleAsPersonal(
  vehicleId: string,
  _email: string
): Promise<void> {
  await requireSignedIn();

  try {
    await apiPatch(`/vehicles/${vehicleId}/claim-personal`, {});
  } catch (err) {
    throw toApiError(err);
  }
}

export async function seedInitialVehicles(
  vehicles: VehicleFormData[]
): Promise<{ added: number; skipped: number }> {
  const existing = await fetchVehicles();
  const existingKeys = new Set(
    existing.map((v) => `${v.vehicleNumber}::${v.chassisNumber}`)
  );

  let added = 0;
  let skipped = 0;

  for (const vehicle of vehicles) {
    const key = `${vehicle.vehicleNumber}::${vehicle.chassisNumber}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    await createVehicle(vehicle);
    existingKeys.add(key);
    added++;
  }

  return { added, skipped };
}

export function toDriverVehicle(v: Vehicle) {
  return {
    vehicleNumber: v.vehicleNumber,
    vehicleModel: v.vehicleName
  };
}
