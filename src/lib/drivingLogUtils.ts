import {
  isFukushimaAreaOrVehicle,
  isRentalVehicleName
} from "../types/vehicle";
import { isReservationInProgress } from "./reservationBooking";

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

export type VehicleNameLookup = {
  vehicleNumber?: string;
  vehicleName?: string;
};

export type ReservationLike = {
  id?: string;
  email?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  usageArea?: string;
  purpose?: string;
  category?: string;
  routeStart?: string;
  routeEnd?: string;
  startTime?: TimestampLike;
  endTime?: TimestampLike;
  status?: string;
  allDay?: boolean;
  timeSpecified?: boolean;
  isPersonal?: boolean;
  usageStatus?: string;
  substituteUntil?: TimestampLike;
  remarks?: string;
};

export type DrivingLogLike = {
  email?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  destination?: string;
  purpose?: string;
  startMileageKm?: number;
  endMileageKm?: number;
  startTime?: TimestampLike;
  remarks?: string;
};

export function toDate(value: TimestampLike): Date | null {
  if (!value) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return null;
}

export function destinationFromReservation(
  reservation?: ReservationLike
): string {
  return reservation?.purpose?.trim() || reservation?.routeEnd?.trim() || "";
}

/** 指定時点で有効な予約か（active かつ終了前） */
export function isReservationEffective(
  reservation: ReservationLike,
  at: Date = new Date()
): boolean {
  if (reservation.status === "completed") return false;
  if (reservation.status && reservation.status !== "active") return false;
  const end = toDate(reservation.endTime);
  return !!end && end >= at;
}

/** 運転記録に対応する予約を検索（メール・車両・時間帯で照合） */
export function findReservationForDrivingLog(
  log: DrivingLogLike,
  reservations: ReservationLike[]
): ReservationLike | undefined {
  const logStart = toDate(log.startTime);
  const email = log.email;
  const vehicleNumber = log.vehicleNumber?.trim() ?? "";

  const candidates = reservations.filter((r) => {
    if (
      vehicleNumber &&
      r.vehicleNumber?.trim() &&
      r.vehicleNumber.trim() === vehicleNumber
    ) {
      return true;
    }
    if (email && r.email && r.email !== email) return false;
    return true;
  });

  if (logStart) {
    const inPeriod = candidates.find((r) => {
      if (vehicleNumber && r.vehicleNumber && r.vehicleNumber !== vehicleNumber) {
        return false;
      }
      const start = toDate(r.startTime);
      const end = toDate(r.endTime);
      return !!start && !!end && logStart >= start && logStart <= end;
    });
    if (inPeriod) return inPeriod;

    const anyInPeriod = candidates.find((r) => {
      const start = toDate(r.startTime);
      const end = toDate(r.endTime);
      return (
        !!start &&
        !!end &&
        logStart >= start &&
        logStart <= end &&
        isReservationEffective(r, logStart)
      );
    });
    if (anyInPeriod) return anyInPeriod;
  }

  const effectiveAt = logStart ?? new Date();

  if (vehicleNumber) {
    const forVehicle = candidates.find(
      (r) =>
        r.vehicleNumber === vehicleNumber &&
        isReservationEffective(r, effectiveAt)
    );
    if (forVehicle) return forVehicle;
  }

  return (
    candidates.find((r) => isReservationEffective(r, effectiveAt)) ??
    candidates[0]
  );
}

/** 予約期間内に運転記録があるか */
export function hasDrivingLogForReservation(
  reservation: ReservationLike,
  logs: DrivingLogLike[]
): boolean {
  const start = toDate(reservation.startTime);
  const end = toDate(reservation.endTime);
  if (!start || !end) return false;

  const email = reservation.email;
  const vehicleNumber = reservation.vehicleNumber?.trim() ?? "";

  return logs.some((log) => {
    if (email && log.email && log.email !== email) return false;
    if (
      vehicleNumber &&
      log.vehicleNumber?.trim() &&
      log.vehicleNumber.trim() !== vehicleNumber
    ) {
      return false;
    }
    const logStart = toDate(log.startTime);
    return !!logStart && logStart >= start && logStart <= end;
  });
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

function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfCalendarDay(a).getTime() === startOfCalendarDay(b).getTime();
}

/** 終日予約で運転開始できるか（長期共有・同日1回制限） */
export function canStartDrivingSession(
  reservation: ReservationLike | undefined,
  logs: DrivingLogLike[],
  isCurrentlyDriving: boolean,
  options?: { vehicleNumber?: string; now?: Date }
): boolean {
  if (isCurrentlyDriving) return true;
  if (!reservation?.allDay) return true;
  if (isLongTermReservation(reservation)) return true;

  const now = options?.now ?? new Date();
  const vehicleNumber =
    reservation.vehicleNumber?.trim() ?? options?.vehicleNumber?.trim() ?? "";

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

/** 運転開始時点で有効な予約を検索（車両共有予約を優先） */
export function findActiveReservation(
  reservations: ReservationLike[],
  email: string,
  vehicleNumber: string,
  at: Date = new Date()
): ReservationLike | undefined {
  const normalizedVehicle = vehicleNumber.trim();

  if (normalizedVehicle) {
    const vehicleInProgress = reservations.find(
      (r) =>
        r.vehicleNumber?.trim() === normalizedVehicle &&
        isReservationInProgress(r, at)
    );
    if (vehicleInProgress) return vehicleInProgress;
  }

  const userInProgress = reservations.find(
    (r) =>
      (!email || !r.email || r.email === email) &&
      isReservationInProgress(r, at)
  );
  if (userInProgress) return userInProgress;

  if (normalizedVehicle) {
    const vehicleEffective = reservations.find(
      (r) =>
        r.vehicleNumber?.trim() === normalizedVehicle &&
        isReservationEffective(r, at)
    );
    if (vehicleEffective) return vehicleEffective;
  }

  return findReservationForDrivingLog(
    { email, vehicleNumber: normalizedVehicle, startTime: at },
    reservations
  );
}

/** 欠けている車両・目的地・利用目的を予約データで補完 */
export function enrichDrivingLog<T extends DrivingLogLike>(
  log: T,
  reservations: ReservationLike[]
): T {
  const reservation = findReservationForDrivingLog(log, reservations);

  return {
    ...log,
    vehicleNumber: log.vehicleNumber?.trim() || reservation?.vehicleNumber || "",
    vehicleModel: log.vehicleModel?.trim() || reservation?.vehicleModel || "",
    destination:
      log.destination?.trim() || destinationFromReservation(reservation),
    purpose: log.purpose?.trim() || reservation?.category || ""
  };
}

function resolveVehicleNumber(
  log: DrivingLogLike,
  reservation?: ReservationLike
): string {
  return log.vehicleNumber?.trim() || reservation?.vehicleNumber?.trim() || "";
}

function resolveVehicleName(
  log: DrivingLogLike,
  reservation?: ReservationLike,
  vehicles?: VehicleNameLookup[]
): string {
  const fromLog = log.vehicleModel?.trim();
  if (fromLog) return fromLog;

  const fromReservation = reservation?.vehicleModel?.trim();
  if (fromReservation) return fromReservation;

  const vehicleNumber = resolveVehicleNumber(log, reservation);
  if (!vehicleNumber || !vehicles?.length) return "";

  const match = vehicles.find(
    (vehicle) => vehicle.vehicleNumber?.trim() === vehicleNumber
  );
  return match?.vehicleName?.trim() || "";
}

export function isRentalDrivingLog(
  log: DrivingLogLike,
  reservation?: ReservationLike,
  vehicles?: VehicleNameLookup[]
): boolean {
  return isRentalVehicleName(resolveVehicleName(log, reservation, vehicles));
}

/** レンタカー利用時に領収書が必要か（福島は不要、東京・レンタカー①などは必要） */
export function isRentalReceiptRequired(
  log: DrivingLogLike,
  reservation?: ReservationLike,
  vehicles?: VehicleNameLookup[]
): boolean {
  if (!isRentalDrivingLog(log, reservation, vehicles)) return false;

  const usageArea = reservation?.usageArea?.trim() ?? "";
  const vehicleName = resolveVehicleName(log, reservation, vehicles);
  if (isFukushimaAreaOrVehicle(usageArea, vehicleName)) return false;

  return true;
}
