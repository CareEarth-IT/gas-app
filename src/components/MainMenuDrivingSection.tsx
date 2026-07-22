import { AlertTriangle } from "lucide-react";

import { useOilChangeAlert } from "../hooks/useOilChangeAlert";
import { oilChangeAlertMessage } from "../lib/oilChangeAlert";
import { Screen, type DrivingStatus } from "../types";

type Props = {
  drivingStatus: DrivingStatus;
  canStartDriving: boolean;
  drivingBlockReason: string | null;
  vehicleNumber: string;
  setScreen: (screen: Screen) => void;
  onEndDriving: () => void;
};

export function MainMenuDrivingSection({
  drivingStatus,
  canStartDriving,
  drivingBlockReason,
  vehicleNumber,
  setScreen,
  onEndDriving
}: Props) {
  const isReportingNeeded = drivingStatus === "needs_report";
  const isDriving = drivingStatus === "driving";
  const oilChangeAlert = useOilChangeAlert(vehicleNumber);

  return (
    <div className="mb-6 space-y-2">
      {!isDriving && !isReportingNeeded && !canStartDriving && (
        <p className="text-sm text-text-muted text-center py-2 px-2">
          {drivingBlockReason ??
            "終日利用の運転開始は本日1回のみです。翌日以降に再度お試しください。"}
        </p>
      )}

      {!isDriving && !isReportingNeeded && canStartDriving && (
        <p className="text-sm text-text-muted text-center py-2 px-2">
          車両に貼られたQRコードを読み取ると、運転開始（アルコールチェック）へ進みます。
        </p>
      )}

      {isReportingNeeded && (
        <p className="text-sm text-red-600 font-bold text-center py-1">
          運転報告の入力が必要です
        </p>
      )}

      {isDriving && (
        <button
          onClick={onEndDriving}
          className="w-full py-4 font-bold rounded-lg text-lg shadow-md transition-colors bg-red-500 text-white hover:bg-red-600"
          type="button"
        >
          車の運転終了 (到着)
        </button>
      )}

      <button
        onClick={() => setScreen(Screen.DRIVING_LOG)}
        className={`w-full py-2 font-bold rounded-md text-sm transition-colors ${
          isReportingNeeded
            ? "bg-slate-700 text-white"
            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
        }`}
        type="button"
      >
        {isReportingNeeded ? "運転報告を入力する" : "運転履歴 / 報告"}
      </button>

      {oilChangeAlert && (
        <p
          className={`text-sm font-bold text-center px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 ${
            oilChangeAlert.status === "overdue"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {oilChangeAlertMessage(oilChangeAlert)}
        </p>
      )}
    </div>
  );
}
