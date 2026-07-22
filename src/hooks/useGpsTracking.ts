import { useRef } from "react";

import { createGpsLog } from "../lib/records";

type GpsTrackingOptions = {
  userEmail: string | undefined;
  vehicleNumber: string;
};

export function useGpsTracking({ userEmail, vehicleNumber }: GpsTrackingOptions) {
  const gpsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logCurrentLocation = (label: string) => {
    if (!navigator.geolocation) {
      console.error(`GPS記録失敗 (${label}): この端末は位置情報に対応していません`);
      return;
    }
    if (!userEmail) {
      console.error(`GPS記録失敗 (${label}): ログイン情報がありません`);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const id = await createGpsLog({
            email: userEmail,
            vehicleNumber,
            type: label,
            latitude,
            longitude
          });
          console.log(
            `GPS記録成功 (${label}): ${latitude}, ${longitude} → gpsLogs/${id}`
          );
        } catch (error) {
          console.error(`GPS記録失敗 (${label}): API保存エラー`, error);
        }
      },
      (error) => {
        console.error(`GPS記録失敗 (${label}): 位置情報取得エラー`, error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const clearGpsTracking = () => {
    if (gpsTimerRef.current) {
      clearInterval(gpsTimerRef.current);
      gpsTimerRef.current = null;
    }
  };

  const startGpsTracking = (label: string) => {
    clearGpsTracking();
    console.log(`GPS記録を開始します（10分間隔・${label}）...`);
    logCurrentLocation(label);
    gpsTimerRef.current = setInterval(() => {
      logCurrentLocation(label);
    }, 10 * 60 * 1000);
  };

  return { gpsTimerRef, clearGpsTracking, startGpsTracking };
}
