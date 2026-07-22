import { normalizeVehicleNumber } from "./vehicleMileage";
import { toDate, type DrivingLogLike } from "./drivingLogUtils";
import type { Vehicle } from "../types/vehicle";

export type RefuelingRecordLike = Record<string, unknown> & {
  email?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  timestamp?: unknown;
};

function vehicleNameFromMaster(
  vehicles: Vehicle[],
  vehicleNumber: string
): string {
  const normalized = normalizeVehicleNumber(vehicleNumber);
  if (!normalized) return "";

  const match = vehicles.find(
    (v) => normalizeVehicleNumber(v.vehicleNumber) === normalized
  );
  return match?.vehicleName ?? "";
}

function findVehicleFromDrivingLogs(
  email: string,
  at: Date | null,
  logs: DrivingLogLike[]
): { vehicleNumber: string; vehicleModel: string } | null {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return null;

  const candidates = logs
    .filter((log) => log.email === normalizedEmail)
    .filter((log) => log.vehicleNumber?.trim() || log.vehicleModel?.trim())
    .filter((log) => {
      if (!at) return true;
      const start = toDate(log.startTime);
      return !start || start <= at;
    })
    .sort((a, b) => {
      const ta = toDate(a.startTime)?.getTime() ?? 0;
      const tb = toDate(b.startTime)?.getTime() ?? 0;
      return tb - ta;
    });

  const log = candidates[0];
  if (!log) return null;

  return {
    vehicleNumber: String(log.vehicleNumber ?? "").trim(),
    vehicleModel: String(log.vehicleModel ?? "").trim()
  };
}

/** 管理画面表示用: 車両番号・車種をマスタ／運転記録から補完 */
export function enrichRefuelingRecord<T extends RefuelingRecordLike>(
  record: T,
  vehicles: Vehicle[],
  drivingLogs: DrivingLogLike[]
): T {
  let vehicleNumber = String(record.vehicleNumber ?? "").trim();
  let vehicleModel = String(record.vehicleModel ?? "").trim();

  if (!vehicleNumber || !vehicleModel) {
    const fromLog = findVehicleFromDrivingLogs(
      String(record.email ?? ""),
      toDate(record.timestamp),
      drivingLogs
    );
    if (fromLog) {
      vehicleNumber = vehicleNumber || fromLog.vehicleNumber;
      vehicleModel = vehicleModel || fromLog.vehicleModel;
    }
  }

  if (vehicleNumber && !vehicleModel) {
    vehicleModel = vehicleNameFromMaster(vehicles, vehicleNumber);
  }

  return { ...record, vehicleNumber, vehicleModel };
}
