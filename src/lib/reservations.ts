import {
  isReservationEffective,
  toDate,
  type ReservationLike
} from "./drivingLogUtils";
import { apiGet, apiPatch, apiPost } from "./api";

export { isReservationEffective };

export async function completeExpiredReservations(options?: {
  userEmail?: string;
  admin?: boolean;
}): Promise<number> {
  const result = await apiPost<{ completed: number }>("/reservations/expire", {
    admin: options?.admin === true
  });
  return result.completed;
}

export type UserReservation = ReservationLike & {
  id: string;
};

function formatReservationTime(date: Date): string {
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatReservationPeriod(reservation: ReservationLike): string {
  const start = toDate(reservation.startTime);
  const end = toDate(reservation.endTime);
  if (!start || !end) return "";
  return `${formatReservationTime(start)} 〜 ${formatReservationTime(end)}`;
}

export function formatReservationEndTime(end: Date): string {
  return formatReservationTime(end);
}

export async function fetchActiveReservations(): Promise<
  Array<ReservationLike & { id: string }>
> {
  return apiGet("/reservations/active");
}

/** 公開予約一覧用: 本日〜1ヶ月先の予約中スケジュール */
export async function fetchReservationSchedule(): Promise<
  Array<ReservationLike & { id: string }>
> {
  return apiGet("/reservations/schedule");
}

export async function fetchUserReservationsForUser(
  email: string
): Promise<UserReservation[]> {
  const list = await apiGet<UserReservation[]>("/reservations/mine");
  return list.filter((r) => r.email === email);
}

export async function cancelReservation(reservationId: string): Promise<void> {
  await apiPatch(`/reservations/${reservationId}/cancel`, {});
}

export async function hasActiveReservationForUser(
  email: string
): Promise<boolean> {
  const list = await fetchUserReservationsForUser(email);
  return list.length > 0;
}

export async function fetchCanStartDriving(
  email: string,
  isCurrentlyDriving: boolean,
  vehicleNumber = ""
): Promise<{ allowed: boolean; reason?: string }> {
  const params = new URLSearchParams({
    currentlyDriving: isCurrentlyDriving ? "true" : "false"
  });
  if (vehicleNumber.trim()) {
    params.set("vehicleNumber", vehicleNumber.trim());
  }
  return apiGet<{ allowed: boolean; reason?: string }>(
    `/reservations/can-start-driving?${params.toString()}`
  );
}

export async function hasActiveReservationForVehicle(
  vehicleNumber: string
): Promise<boolean> {
  if (!vehicleNumber.trim()) return false;
  const list = await fetchActiveReservations();
  const now = new Date();
  return list.some(
    (r) =>
      r.vehicleNumber?.trim() === vehicleNumber.trim() &&
      isReservationEffective(r, now)
  );
}

export async function createReservation(
  data: Record<string, unknown>
): Promise<string> {
  const result = await apiPost<{ id: string }>("/reservations", data);
  return result.id;
}
