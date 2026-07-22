const PRODUCTION_ORIGIN = "https://drive.careearth.net";

/** 車両の運転開始用 QR URL（本番ドメイン固定） */
export function buildDriveStartUrl(
  vehicleNumber: string,
  vehicleModel = ""
): string {
  const params = new URLSearchParams({
    mode: "drive",
    name: vehicleNumber.trim()
  });
  if (vehicleModel.trim()) {
    params.set("vin", vehicleModel.trim());
  }
  return `${PRODUCTION_ORIGIN}/?${params.toString()}`;
}

/** 管理画面表示用の QR 画像 URL */
export function driveStartQrImageUrl(
  vehicleNumber: string,
  vehicleModel = "",
  size = 180
): string {
  const data = encodeURIComponent(
    buildDriveStartUrl(vehicleNumber, vehicleModel)
  );
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}

export function clearQrQueryParamsFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("mode") && !url.searchParams.has("name")) {
    return;
  }
  url.searchParams.delete("mode");
  url.searchParams.delete("name");
  url.searchParams.delete("vin");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next || "/");
}
