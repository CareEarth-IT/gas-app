import {
  isReservationEffective,
  toDate,
  type ReservationLike
} from "./drivingLogUtils";
import { reservationRangesConflict } from "../../shared/reservationOverlap";

export type ActiveReservation = {
  vehicleNumber: string;
  email?: string;
  startTime: ReservationLike["startTime"];
  endTime: ReservationLike["endTime"];
  status?: string;
  usageStatus?: string;
  allDay?: boolean;
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

/** datetime-local の値（YYYY-MM-DDTHH:mm）をローカル日時として解釈 */
export function parseDatetimeLocalValue(value: string): Date {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(trimmed);
  if (!match) return new Date(trimmed);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 入力中に開始時刻が過ぎた場合、当日分は現在時刻に揃える */
export function normalizeBookingStart(start: Date, now = new Date()): Date {
  if (Number.isNaN(start.getTime())) return now;
  if (start >= now) return start;
  if (startOfDay(start).getTime() === startOfDay(now).getTime()) {
    return now;
  }
  return start;
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

function isActiveReservationStatus(reservation: ActiveReservation): boolean {
  if (reservation.status === "completed") return false;
  if (reservation.status && reservation.status !== "active") return false;
  return true;
}

function overlapsRange(
  reservation: ActiveReservation,
  rangeStart: Date,
  rangeEnd: Date,
  incomingAllDay: boolean,
  match: (reservation: ActiveReservation) => boolean
): boolean {
  if (!match(reservation) || !isActiveReservationStatus(reservation)) {
    return false;
  }

  const start = toDate(reservation.startTime);
  const end = toDate(reservation.endTime);
  if (!start || !end) return false;

  return reservationRangesConflict(
    { allDay: reservation.allDay, start, end },
    { allDay: incomingAllDay, start: rangeStart, end: rangeEnd }
  );
}

export function isVehicleBooked(
  vehicleNumber: string,
  reservations: ActiveReservation[],
  rangeStart: Date,
  rangeEnd: Date,
  incomingAllDay = false
): boolean {
  return reservations.some((reservation) =>
    overlapsRange(
      reservation,
      rangeStart,
      rangeEnd,
      incomingAllDay,
      (r) => r.vehicleNumber === vehicleNumber
    )
  );
}

export function hasUserReservationOverlap(
  email: string,
  reservations: ActiveReservation[],
  rangeStart: Date,
  rangeEnd: Date,
  incomingAllDay = false
): boolean {
  return reservations.some((reservation) =>
    overlapsRange(
      reservation,
      rangeStart,
      rangeEnd,
      incomingAllDay,
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
  return !!start && !!end && at >= start && at < end;
}
