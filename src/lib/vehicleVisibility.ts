import type { Vehicle } from "../types/vehicle";

/** 予約画面に表示する車両（個人保有は所有者のみ、それ以外は共有車両のみ） */
export function filterVehiclesForReservation(
  vehicles: Vehicle[],
  userEmail: string | undefined
): Vehicle[] {
  const email = userEmail?.trim() ?? "";
  const personalOwned = vehicles.filter(
    (v) => v.isPersonal && v.personalOwnerEmail === email
  );

  if (personalOwned.length > 0) {
    return personalOwned;
  }

  return vehicles.filter((v) => !v.isPersonal);
}
