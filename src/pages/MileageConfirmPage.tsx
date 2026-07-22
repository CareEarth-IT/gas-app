import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { fetchActiveDrivingLog } from "../lib/drivingLogs";
import type { UserProfile } from "../types";

type Props = {
  userProfile: UserProfile | null;
  startMileageImageUrl: string | null;
  vehicleNumber: string;
  vehicleModel: string;
  onBack: () => void;
};

type ActiveDrivingLog = {
  status?: string;
  startMileageImageUrl?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  startTime?: string;
};

function formatStartTime(value: ActiveDrivingLog["startTime"]): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ja-JP");
}

export default function MileageConfirmPage({
  userProfile,
  startMileageImageUrl,
  vehicleNumber,
  vehicleModel,
  onBack
}: Props) {
  const [loading, setLoading] = useState(!startMileageImageUrl);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<ActiveDrivingLog | null>(
    startMileageImageUrl
      ? {
          startMileageImageUrl,
          vehicleNumber,
          vehicleModel
        }
      : null
  );

  useEffect(() => {
    if (!userProfile || startMileageImageUrl) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const active = await fetchActiveDrivingLog();
        const data = active as ActiveDrivingLog | null;

        if (isMounted) {
          setLog(data);
          if (!data?.startMileageImageUrl) {
            setError("走行距離の写真が見つかりませんでした。");
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "走行距離の取得に失敗しました";
        if (isMounted) setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [userProfile, startMileageImageUrl]);

  const imageUrl = log?.startMileageImageUrl ?? startMileageImageUrl;
  const displayVehicleNumber = log?.vehicleNumber || vehicleNumber;
  const displayVehicleModel = log?.vehicleModel || vehicleModel;
  const startTimeLabel = formatStartTime(log?.startTime);

  return (
    <div className="flex flex-col h-full bg-bg-app">
      <div className="p-4 bg-white border-b flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft />
        </button>
        <h2 className="font-bold text-lg">走行距離の確認</h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : imageUrl ? (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <p className="text-sm text-text-muted">車両</p>
              <p className="font-bold">
                {displayVehicleModel}（{displayVehicleNumber}）
              </p>
              {startTimeLabel && (
                <p className="text-xs text-text-muted mt-1">
                  運転開始: {startTimeLabel}
                </p>
              )}
            </div>
            <img
              src={imageUrl}
              alt="走行距離メーター"
              className="w-full rounded-lg border shadow-sm"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
