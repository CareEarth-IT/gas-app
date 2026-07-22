export type Vehicle = {
  id?: string;
  vehicleNumber: string;
  chassisNumber: string;
  vehicleName: string;
  modelType: string;
  fuelType: string;
  usageArea: string;
  /** 個人保有車（予約一覧では所有者以外に非表示） */
  isPersonal: boolean;
  /** 個人保有の利用者メールアドレス */
  personalOwnerEmail: string;
  /** 故障・修理などによる代車 */
  isSubstitute?: boolean;
  /** 代車の終了予定日時（ISO文字列） */
  substituteUntil?: string;
};

export type VehicleFormData = Omit<Vehicle, "id">;

export const FUEL_TYPES = ["ガソリン", "軽油"] as const;

export const USAGE_AREAS = ["大阪", "神戸", "滋賀", "名古屋", "東京", "福岡", "レンタル"] as const;

export const RENTAL_VEHICLE_NAME = "レンタカー";
export const ROUTE_START_PARKING = "駐車場から";

export function isRentalVehicleName(vehicleName?: string | null): boolean {
  const name = vehicleName?.trim() ?? "";
  return name.startsWith(RENTAL_VEHICLE_NAME);
}

export function isSubstituteVehicleName(vehicleName?: string | null): boolean {
  const name = vehicleName?.trim() ?? "";
  return name.includes("代車");
}

/** 福島拠点・車両はレンタカーでも領収書不要 */
export function isFukushimaAreaOrVehicle(
  usageArea?: string | null,
  vehicleName?: string | null
): boolean {
  const area = usageArea?.trim() ?? "";
  const name = vehicleName?.trim() ?? "";
  return area.includes("福島") || name.includes("福島");
}
