type TimestampLike = string | Date | { toDate?: () => Date } | null | undefined;

export type ReservationLike = {
  email?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  startTime?: TimestampLike;
  endTime?: TimestampLike;
  status?: string;
  allDay?: boolean;
};

export type DrivingLogLike = {
  email?: string;
  startTime?: TimestampLike;
  status?: string;
};

export const SESSION_STALE_MS = 30 * 60 * 1000;

export function toDate(value: TimestampLike): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return null;
}

export function isReservationEffective(
  reservation: ReservationLike,
  at: Date = new Date()
): boolean {
  if (reservation.status === "completed") return false;
  if (reservation.status && reservation.status !== "active") return false;
  const end = toDate(reservation.endTime);
  return !!end && end > at;
}

export function isReservationInProgress(
  reservation: ReservationLike,
  at: Date = new Date()
): boolean {
  const start = toDate(reservation.startTime);
  const end = toDate(reservation.endTime);
  return !!start && !!end && start <= at && at < end;
}

function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfCalendarDay(a).getTime() === startOfCalendarDay(b).getTime();
}

/** 予約期間が1日を超える（長期・1ヶ月共有利用） */
export function isLongTermReservation(
  reservation: ReservationLike,
  minSpanMs = 24 * 60 * 60 * 1000
): boolean {
  const start = toDate(reservation.startTime);
  const end = toDate(reservation.endTime);
  if (!start || !end) return false;
  return end.getTime() - start.getTime() > minSpanMs;
}

export function canStartDrivingSession(
  activeReservation: ReservationLike | undefined,
  logs: DrivingLogLike[],
  isCurrentlyDriving: boolean,
  options?: { vehicleNumber?: string; now?: Date }
): boolean {
  if (isCurrentlyDriving) return true;
  if (!activeReservation?.allDay) return true;
  if (isLongTermReservation(activeReservation)) return true;

  const now = options?.now ?? new Date();
  const vehicleNumber =
    activeReservation.vehicleNumber?.trim() ??
    options?.vehicleNumber?.trim() ??
    "";

  const hasStartedTodayForVehicle = logs.some((log) => {
    if (
      vehicleNumber &&
      log.vehicleNumber?.trim() &&
      log.vehicleNumber.trim() !== vehicleNumber
    ) {
      return false;
    }
    const logStart = toDate(log.startTime);
    return !!logStart && isSameCalendarDay(logStart, now);
  });

  return !hasStartedTodayForVehicle;
}

export function drivingStartBlockReason(
  reservation: ReservationLike | undefined,
  at: Date = new Date()
): string | null {
  if (!reservation) {
    return "有効な予約がありません。予約時間を確認するか、管理者に連絡してください。";
  }
  if (!isReservationInProgress(reservation, at)) {
    const start = toDate(reservation.startTime);
    const end = toDate(reservation.endTime);
    const jst = { timeZone: "Asia/Tokyo" } as const;
    if (start && end && at < start) {
      return `予約開始前です。利用可能時間: ${start.toLocaleString("ja-JP", jst)} 〜 ${end.toLocaleString("ja-JP", jst)}`;
    }
    if (end && at > end) {
      return `予約時間を過ぎています。終了: ${end.toLocaleString("ja-JP", jst)}`;
    }
    return "現在は予約時間外です。予約時間内に再度お試しください。";
  }
  return null;
}
