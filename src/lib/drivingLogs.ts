import { apiGet, apiPatch, apiPost } from "./api";
import {
  getFixedAlcoholCheckFields,
  type AlcoholCheckFields
} from "../../shared/alcoholCheckDefaults";

export type DrivingLogRecord = Record<string, unknown> & { id: string };

export type { AlcoholCheckFields };

export async function fetchMyDrivingLogs(
  limit = 50
): Promise<DrivingLogRecord[]> {
  return apiGet(`/driving-logs/mine?limit=${limit}`);
}

export async function fetchActiveDrivingLog(): Promise<DrivingLogRecord | null> {
  return apiGet("/driving-logs/active");
}

export async function fetchRecentDrivingLogs(
  limit = 300
): Promise<DrivingLogRecord[]> {
  return apiGet(`/driving-logs/recent?limit=${limit}`);
}

export async function startDrivingLog(
  data: Record<string, unknown>
): Promise<string> {
  const result = await apiPost<{ id: string }>("/driving-logs", data);
  return result.id;
}

export async function endDrivingLog(logId: string): Promise<void> {
  await apiPatch(`/driving-logs/${logId}/end`, {});
}

export async function reportDrivingLog(
  logId: string,
  data: Record<string, unknown>
): Promise<void> {
  await apiPatch(`/driving-logs/${logId}/report`, data);
}

export async function approveDrivingLog(
  logId: string,
  action: "approve" | "reject"
): Promise<void> {
  await apiPatch(`/driving-logs/${logId}/approval`, { action });
}

export async function updateAlcoholCheck(
  logId: string,
  fields: AlcoholCheckFields = getFixedAlcoholCheckFields()
): Promise<AlcoholCheckFields> {
  return apiPatch(`/driving-logs/${logId}/alcohol-check`, fields);
}

export async function fetchAccessRole(): Promise<{
  role: "admin" | "officer" | "none";
  canApproveDrivingLogs: boolean;
}> {
  return apiGet("/auth/access-role");
}

export async function fetchAuthBootstrap(options?: {
  name?: string | null;
  vehicleNumber?: string;
}): Promise<{
  hasReservation: boolean;
  drivingStatus: "idle" | "driving" | "needs_report";
}> {
  const name = options?.name?.trim();
  const vehicleNumber = options?.vehicleNumber?.trim();
  const body: Record<string, string> = {};
  if (name) body.name = name;
  if (vehicleNumber) body.vehicleNumber = vehicleNumber;
  return apiPost("/auth/bootstrap", Object.keys(body).length > 0 ? body : {});
}
