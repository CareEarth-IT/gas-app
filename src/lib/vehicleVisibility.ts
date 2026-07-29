import type { Vehicle } from "../types/vehicle";

/**
 * 予約画面に表示する車両。
 * 個人保有でも全員が予約・利用できる（所有者メールは表示用）。
 */
export function filterVehiclesForReservation(
  vehicles: Vehicle[],
  _userEmail?: string
): Vehicle[] {
  return vehicles;
}

/** 個人保有のとき車名の右に（メール）を付ける */
export function formatVehicleNameWithOwner(
  vehicleName: string,
  options?: {
    isPersonal?: boolean;
    personalOwnerEmail?: string | null;
  }
): string {
  const name = vehicleName.trim();
  const email = options?.personalOwnerEmail?.trim() ?? "";
  if (options?.isPersonal && email) {
    return name ? `${name} (${email})` : `(${email})`;
  }
  return name;
}
