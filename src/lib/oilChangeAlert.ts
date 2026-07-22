import {
  getOilChangeStatus,
  kmSinceLastOilChange,
  latestOdometerKm,
  normalizeVehicleNumber,
  type DrivingLogMileage,
  type OilChangeStatus
} from "./vehicleMileage";
import type { VehicleMaintenanceRecord } from "./vehicleMaintenance";

export type OilChangeAlert = {
  status: Exclude<OilChangeStatus, "ok" | "unknown">;
  kmSince: number;
  vehicleNumber: string;
};

export function getOilChangeAlert(
  vehicleNumber: string,
  logs: DrivingLogMileage[],
  maintenanceRecords: VehicleMaintenanceRecord[]
): OilChangeAlert | null {
  const normalized = normalizeVehicleNumber(vehicleNumber);
  if (!normalized) return null;

  const odometer = latestOdometerKm(logs, normalized);
  const lastOil = maintenanceRecords.find(
    (record) =>
      record.type === "oil" &&
      normalizeVehicleNumber(record.vehicleNumber) === normalized
  );

  const kmSince = kmSinceLastOilChange(odometer, lastOil?.mileageKm ?? null);
  const status = getOilChangeStatus(kmSince);

  if (status !== "warning" && status !== "overdue") return null;
  if (kmSince == null) return null;

  return {
    status,
    kmSince,
    vehicleNumber: normalized
  };
}

export function oilChangeAlertMessage(alert: OilChangeAlert): string {
  const km = `${Math.round(alert.kmSince).toLocaleString("ja-JP")} km`;

  if (alert.status === "overdue") {
    return `オイル交換が必要です（前回交換から ${km}）`;
  }

  return `オイル交換してください（前回交換から ${km}）`;
}
