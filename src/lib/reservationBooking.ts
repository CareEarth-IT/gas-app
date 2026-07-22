import { isReservationEffective, toDate, type ReservationLike } from "./drivingLogUtils";

export type ActiveReservation = {
  vehicleNumber: string;
  email?: string;
  startTime: { toDate: () => Date };
  endTime: { toDate: () => Date };
  status?: string;
  usageStatus?: string;
  substituteUntil?: { toDate?: () => Date } | Date | string;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

/** カレンダー上で months ヶ月加算（例: 6/12 → 7/12） */
function addCalendarMonths(date: Date, months: number): Date {
  const base = startOfDay(date);
  const day = base.getDate();
  const result = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/** 予約開始の最遅日（今日から1ヶ月先の日の終日まで） */
export function getMaxStartBookingDate(now = new Date()): Date {
  return endOfDay(addCalendarMonths(startOfDay(now), 1));
}

/** 開始日から取れる最遅の終了日時（開始日から1ヶ月先の日の終日まで） */
export function getMaxEndForStart(start: Date): Date {
  return endOfDay(addCalendarMonths(startOfDay(start), 1));
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 予約不可の理由（問題なければ null） */
export function getBookingRangeError(
  start: Date,
  end: Date,
  now = new Date()
): string | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "日時の形式が正しくありません。";
  }

  const today = startOfDay(now);
  const startDay = startOfDay(start);

  if (startDay < today) {
    return "開始日時は今日以降に設定してください。";
  }
  if (startDay.getTime() === today.getTime() && start < now) {
    return "開始日時は現在より後に設定してください。";
  }
  if (startDay > startOfDay(getMaxStartBookingDate(now))) {
    return "予約開始は1ヶ月先までに設定してください。";
  }
  if (end <= start) {
    return "終了日時は開始日時より後に設定してください。";
  }
  if (end > getMaxEndForStart(start)) {
    return "予約終了は開始日から1ヶ月以内に設定してください。";
  }

  return null;
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function overlapsRange(
  reservation: ActiveReservation,
  rangeStart: Date,
  rangeEnd: Date,
  match: (reservation: ActiveReservation) => boolean
): boolean {
  if (!match(reservation) || !isReservationEffective(reservation, rangeStart)) {
    return false;
  }

  const start = reservation.startTime?.toDate?.();
  const end = reservation.endTime?.toDate?.();
  if (!start || !end) return false;

  return rangesOverlap(rangeStart, rangeEnd, start, end);
}

export function isVehicleBooked(
  vehicleNumber: string,
  reservations: ActiveReservation[],
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  return reservations.some((reservation) =>
    overlapsRange(
      reservation,
      rangeStart,
      rangeEnd,
      (r) => r.vehicleNumber === vehicleNumber
    )
  );
}

export function hasUserReservationOverlap(
  email: string,
  reservations: ActiveReservation[],
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  return reservations.some((reservation) =>
    overlapsRange(
      reservation,
      rangeStart,
      rangeEnd,
      (r) => r.email === email
    )
  );
}

export function getAllDayReservationEnd(start: Date): Date {
  return endOfDay(start);
}

/** 予約時間帯内（開始〜終了）か */
export function isReservationInProgress(
  reservation: ReservationLike,
  at: Date = new Date()
): boolean {
  if (!isReservationEffective(reservation, at)) return false;
  const start = toDate(reservation.startTime);
  const end = toDate(reservation.endTime);
  return !!start && !!end && at >= start && at <= end;
}
