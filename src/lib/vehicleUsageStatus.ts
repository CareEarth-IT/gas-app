import { isReservationEffective, toDate, type ReservationLike } from "./drivingLogUtils";
import { isReservationInProgress } from "./reservationBooking";

export type VehicleUsageEntry = {
  vehicleNumber: string;
  vehicleName: string;
  usageArea: string;
  userEmail: string | null;
  inUse: boolean;
  isReserved: boolean;
  reservationEndTime: Date | null;
};

function reservationsForVehicle(
  vehicleNumber: string,
  reservations: ReservationLike[],
  at: Date
): ReservationLike[] {
  return reservations.filter(
    (reservation) =>
      reservation.vehicleNumber === vehicleNumber &&
      isReservationEffective(reservation, at)
  );
}

function pickDisplayReservation(
  forVehicle: ReservationLike[],
  at: Date
): ReservationLike | undefined {
  if (forVehicle.length === 0) return undefined;

  const inProgress = forVehicle.find((r) => isReservationInProgress(r, at));
  if (inProgress) return inProgress;

  return forVehicle
    .filter((r) => {
      const start = toDate(r.startTime);
      return start && start > at;
    })
    .sort(
      (a, b) =>
        (toDate(a.startTime)?.getTime() ?? 0) -
        (toDate(b.startTime)?.getTime() ?? 0)
    )[0];
}

export function buildVehicleUsageList(
  vehicles: Array<{
    vehicleNumber: string;
    vehicleName: string;
    usageArea: string;
  }>,
  reservations: ReservationLike[],
  at: Date = new Date()
): VehicleUsageEntry[] {
  return vehicles.map((vehicle) => {
    const forVehicle = reservationsForVehicle(
      vehicle.vehicleNumber,
      reservations,
      at
    );
    const display = pickDisplayReservation(forVehicle, at);

    return {
      vehicleNumber: vehicle.vehicleNumber,
      vehicleName: vehicle.vehicleName,
      usageArea: vehicle.usageArea,
      userEmail: display?.email ?? null,
      inUse: forVehicle.some((r) => isReservationInProgress(r, at)),
      isReserved: forVehicle.length > 0,
      reservationEndTime: display ? toDate(display.endTime) : null
    };
  });
}

export function groupByUsageArea<T extends { usageArea: string }>(
  items: T[],
  areaOrder: readonly string[]
): Array<{ area: string; items: T[] }> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const area = item.usageArea || "未設定";
    const list = groups.get(area) ?? [];
    list.push(item);
    groups.set(area, list);
  }

  const orderedAreas = [
    ...areaOrder.filter((area) => groups.has(area)),
    ...[...groups.keys()].filter((area) => !areaOrder.includes(area))
  ];

  return orderedAreas.map((area) => ({
    area,
    items: groups.get(area) ?? []
  }));
}
