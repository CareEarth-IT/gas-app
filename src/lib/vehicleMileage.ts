import { toDate } from "./drivingLogUtils";
import { isDrivingLogRecognized } from "../../shared/drivingApproval";

export const OIL_CHANGE_INTERVAL_KM = 5000;
export const OIL_CHANGE_WARNING_KM = 4500;

export type MonthColumn = {
  key: string;
  label: string;
  year: number;
  month: number;
  isCurrent: boolean;
};

export type DrivingLogMileage = {
  vehicleNumber?: string;
  startMileageKm?: number;
  endMileageKm?: number;
  startTime?: unknown;
  endTime?: unknown;
  reportTime?: unknown;
  status?: string;
  approvalStatus?: string;
};

const DISPLAY_MONTHS = [7, 8, 9, 10, 11, 12] as const;

/** 7月〜12月の列（管理画面の走行距離表用） */
export function buildMonthColumns(now = new Date()): MonthColumn[] {
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return DISPLAY_MONTHS.map((month) => {
    const isCurrent = month === currentMonth;

    return {
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: isCurrent ? `${month}月〜現在` : `${month}月`,
      year,
      month,
      isCurrent
    };
  });
}

export function normalizeVehicleNumber(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getLogDate(log: DrivingLogMileage): Date | null {
  return toDate(log.reportTime) ?? toDate(log.endTime) ?? toDate(log.startTime);
}

export function tripDistanceKm(log: DrivingLogMileage): number | null {
  if (log.startMileageKm == null || log.endMileageKm == null) return null;
  const distance = log.endMileageKm - log.startMileageKm;
  return distance >= 0 ? distance : null;
}

export function monthlyDrivenKm(
  logs: DrivingLogMileage[],
  vehicleNumber: string,
  year: number,
  month: number
): number {
  const normalized = normalizeVehicleNumber(vehicleNumber);

  return logs
    .filter(
      (log) =>
        normalizeVehicleNumber(log.vehicleNumber) === normalized &&
        isDrivingLogRecognized(log)
    )
    .filter((log) => {
      const date = getLogDate(log);
      return (
        !!date &&
        date.getFullYear() === year &&
        date.getMonth() + 1 === month
      );
    })
    .reduce((sum, log) => sum + (tripDistanceKm(log) ?? 0), 0);
}

export function latestOdometerKm(
  logs: DrivingLogMileage[],
  vehicleNumber: string
): number | null {
  const normalized = normalizeVehicleNumber(vehicleNumber);
  let max: number | null = null;

  for (const log of logs) {
    if (normalizeVehicleNumber(log.vehicleNumber) !== normalized) continue;
    if (!isDrivingLogRecognized(log)) continue;
    if (
      log.endMileageKm != null &&
      (max === null || log.endMileageKm > max)
    ) {
      max = log.endMileageKm;
    }
  }

  return max;
}

export type OilChangeStatus = "ok" | "warning" | "overdue" | "unknown";

export function kmSinceLastOilChange(
  currentOdometer: number | null,
  lastOilChangeMileage: number | null
): number | null {
  if (currentOdometer == null || lastOilChangeMileage == null) return null;
  return currentOdometer - lastOilChangeMileage;
}

export function getOilChangeStatus(kmSince: number | null): OilChangeStatus {
  if (kmSince === null) return "unknown";
  if (kmSince >= OIL_CHANGE_INTERVAL_KM) return "overdue";
  if (kmSince >= OIL_CHANGE_WARNING_KM) return "warning";
  return "ok";
}

export function formatKm(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")} km`;
}

export function formatMaintenanceDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
