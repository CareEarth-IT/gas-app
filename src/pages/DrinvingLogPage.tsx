import { useEffect, useState } from "react";

import { ArrowLeft, Camera, CheckCircle, Loader2, RefreshCw } from "lucide-react";

import {
  APPROVAL_LABELS,
  getApprovalStatus,
  getDrivingApprovalStatus
} from "../../shared/drivingApproval";
import { ReceiptUploadCard } from "../components/ReceiptUploadCard";
import {
  fetchMyDrivingLogs,
  reportDrivingLog
} from "../lib/drivingLogs";
import {
  findReservationForDrivingLog,
  destinationFromReservation,
  isRentalReceiptRequired,
  type VehicleNameLookup
} from "../lib/drivingLogUtils";
import { isSubstituteVehicleName } from "../types/vehicle";
import { fetchUserReservationsForUser } from "../lib/reservations";
import { fetchVehicles } from "../lib/vehicles";

type DrivingLog = {
  id: string;
  startTime: any;
  endTime?: any;
  email?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  destination?: string;
  purpose?: string;
  startMileageKm?: number;
  endMileageKm?: number;
  startMileageImageUrl?: string;
  endMileageImageUrl?: string;
  receiptImageUrl?: string;
  remarks?: string;
  status: "driving" | "reported";
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedBy?: string;
};

type Reservation = {
  id: string;
  email?: string;
  vehicleNumber: string;
  vehicleModel?: string;
  purpose?: string;
  category?: string;
  routeEnd?: string;
  usageArea?: string;
  usageStatus?: string;
  startTime: any;
  endTime: any;
  status?: string;
};

type UserProfile = {
  name: string | null;
  email: string;
};

type Props = {
  userProfile: UserProfile | null;
  onBack: () => void;
  onReportSubmitted: () => void;
  onRebookSubstitute?: () => void;
  uploadToSakura: (imageData: string) => Promise<string>;
  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraActive: boolean;
  startCamera: () => Promise<boolean> | void;
  stopCamera: () => void;
  capturePhoto: (setter: (val: string) => void) => Promise<void>;
};

function formatTimestamp(value: any): string {
  if (!value) return "";

  let date: Date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    date = new Date(value);
  } else {
    console.error("Unknown timestamp format:", value);
    return "";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}/${m}/${d} ${h}:${min}`;
}

function formatMileage(value?: number): string {
  return value != null && Number.isFinite(value) ? String(value) : "";
}

function drivingLogCardClass(log: DrivingLog): string {
  const approval = getDrivingApprovalStatus(log);
  if (log.status === "driving") {
    return "bg-white border-border-muted";
  }
  if (approval === "pending") {
    return "bg-amber-50 border-amber-300";
  }
  if (approval === "rejected") {
    return "bg-red-50 border-red-300";
  }
  if (approval === "approved") {
    return "bg-emerald-50 border-emerald-300";
  }
  return "bg-white border-border-muted";
}

function ApprovalBadge({ log }: { log: DrivingLog }) {
  if (log.status === "driving") {
    return (
      <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full">
        未報告
      </span>
    );
  }

  const approval = getDrivingApprovalStatus(log);
  if (approval === "pending") {
    return (
      <span className="text-xs font-bold bg-amber-200 text-amber-900 px-2 py-1 rounded-full">
        {APPROVAL_LABELS.pending}
      </span>
    );
  }
  if (approval === "rejected") {
    return (
      <span className="text-xs font-bold bg-red-200 text-red-800 px-2 py-1 rounded-full">
        {APPROVAL_LABELS.rejected}
      </span>
    );
  }
  return (
    <span className="text-xs font-bold bg-emerald-200 text-emerald-900 px-2 py-1 rounded-full">
      {APPROVAL_LABELS.approved}
    </span>
  );
}

function parseMileage(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function loadReportFields(
  log: DrivingLog,
  reservations: Reservation[]
): {
  destination: string;
  purpose: string;
  startMileage: string;
  endMileage: string;
  endMileageImage: string | null;
  receiptImage: string | null;
  remarks: string;
} {
  const reservation = findReservationForDrivingLog(
    log,
    reservations
  ) as Reservation | undefined;

  return {
    destination: log.destination || destinationFromReservation(reservation),
    purpose: log.purpose || reservation?.category || "派遣スタッフ送迎のため",
    startMileage: formatMileage(log.startMileageKm),
    endMileage: formatMileage(log.endMileageKm),
    endMileageImage: log.endMileageImageUrl ?? null,
    receiptImage: log.receiptImageUrl ?? null,
    remarks: log.remarks ?? ""
  };
}

export default function DrivingLogPage({
  userProfile,
  onBack,
  onReportSubmitted,
  onRebookSubstitute,
  uploadToSakura,
  videoRef,
  isCameraActive,
  startCamera,
  stopCamera,
  capturePhoto
}: Props) {
  const [drivingLogs, setDrivingLogs] = useState<DrivingLog[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<VehicleNameLookup[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [reportDestination, setReportDestination] = useState("");
  const [reportPurpose, setReportPurpose] = useState("派遣スタッフ送迎のため");
  const [reportStartMileage, setReportStartMileage] = useState("");
  const [reportEndMileage, setReportEndMileage] = useState("");
  const [endMileageImage, setEndMileageImage] = useState<string | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [reportRemarks, setReportRemarks] = useState("");
  const [rebookSubstitute, setRebookSubstitute] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showReportForm = drivingLogs.some(
    (log) =>
      editingLogId === log.id || (log.status === "driving" && !editingLogId)
  );

  const isFormOpenForLog = (log: DrivingLog) =>
    editingLogId === log.id || (log.status === "driving" && !editingLogId);

  useEffect(() => {
    async function fetchData() {
      if (!userProfile) return;

      setIsFetchingLogs(true);
      try {
        const [logs, reservationList, vehicleList] = await Promise.all([
          fetchMyDrivingLogs(50),
          userProfile.email
            ? fetchUserReservationsForUser(userProfile.email)
            : Promise.resolve([]),
          fetchVehicles().catch(() => [])
        ]);

        setDrivingLogs(logs as DrivingLog[]);
        setReservations(reservationList as Reservation[]);
        setVehicles(
          vehicleList.map((vehicle) => ({
            vehicleNumber: vehicle.vehicleNumber,
            vehicleName: vehicle.vehicleName
          }))
        );
      } finally {
        setIsFetchingLogs(false);
      }
    }
    fetchData();
  }, [userProfile]);

  useEffect(() => {
    const activeLog = drivingLogs.find((log) => log.status === "driving");
    if (!activeLog || editingLogId) return;

    const fields = loadReportFields(activeLog, reservations);
    setReportDestination(fields.destination);
    setReportPurpose(fields.purpose);
    setReportStartMileage(fields.startMileage);
    setReportEndMileage(fields.endMileage);
    setEndMileageImage(fields.endMileageImage);
    setReceiptImage(fields.receiptImage);
    setReportRemarks(fields.remarks);
  }, [drivingLogs, reservations, editingLogId]);

  useEffect(() => {
    if (!showReportForm) {
      stopCamera();
    }
  }, [showReportForm, stopCamera]);

  const capture = (
    setter: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    void capturePhoto((val) => setter(val));
  };

  const retake = (
    setter: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    setter(null);
    void startCamera();
  };

  const handleReportSubmit = async (logId: string) => {
    if (!reportDestination.trim()) {
      alert("目的地を入力してください。");
      return;
    }

    const startKm = parseMileage(reportStartMileage);
    const endKm = parseMileage(reportEndMileage);
    if (startKm === null || endKm === null) {
      alert("出発時・終了時の走行距離を正しく入力してください。");
      return;
    }

    if (endKm < startKm) {
      alert("終了時の走行距離は出発時以上で入力してください。");
      return;
    }

    const target = drivingLogs.find((log) => log.id === logId);
    const reservation = target
      ? (findReservationForDrivingLog(target, reservations) as
          | Reservation
          | undefined)
      : undefined;
    const needsReceipt = target
      ? isRentalReceiptRequired(target, reservation, vehicles)
      : false;

    if (needsReceipt && !receiptImage && !target?.receiptImageUrl) {
      alert("レンタカーの領収書をアップロードしてください。");
      return;
    }

    if (!endMileageImage && !target?.endMileageImageUrl) {
      alert("終了時の走行距離写真を撮影してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      let endMileageImageUrl = target?.endMileageImageUrl ?? "";
      if (endMileageImage?.startsWith("data:")) {
        endMileageImageUrl = await uploadToSakura(endMileageImage);
      } else if (endMileageImage) {
        endMileageImageUrl = endMileageImage;
      }

      let receiptImageUrl = target?.receiptImageUrl ?? "";
      if (receiptImage?.startsWith("data:")) {
        receiptImageUrl = await uploadToSakura(receiptImage);
      } else if (receiptImage) {
        receiptImageUrl = receiptImage;
      }

      await reportDrivingLog(logId, {
        destination: reportDestination,
        purpose: reportPurpose,
        vehicleNumber:
          target?.vehicleNumber?.trim() || reservation?.vehicleNumber || "",
        vehicleModel:
          target?.vehicleModel?.trim() || reservation?.vehicleModel || "",
        startMileageKm: startKm,
        endMileageKm: endKm,
        endMileageImageUrl,
        ...(receiptImageUrl ? { receiptImageUrl } : {}),
        ...(reportRemarks.trim() ? { remarks: reportRemarks.trim() } : {})
      });

      alert("報告を送信しました。上長の承認後に正式に認められます。");
      onReportSubmitted();
      const shouldRebook = rebookSubstitute;
      setEditingLogId(null);
      setReportDestination("");
      setReportStartMileage("");
      setReportEndMileage("");
      setReportRemarks("");
      setRebookSubstitute(false);
      setEndMileageImage(null);
      setReceiptImage(null);
      stopCamera();

      if (shouldRebook) {
        onRebookSubstitute?.();
        return;
      }

      const [logs, reservationList, vehicleList] = await Promise.all([
        fetchMyDrivingLogs(50),
        fetchUserReservationsForUser(userProfile!.email),
        fetchVehicles().catch(() => [])
      ]);
      setDrivingLogs(logs as DrivingLog[]);
      setReservations(reservationList as Reservation[]);
      setVehicles(
        vehicleList.map((vehicle) => ({
          vehicleNumber: vehicle.vehicleNumber,
          vehicleName: vehicle.vehicleName
        }))
      );
    } catch (error: unknown) {
      console.error("Report Submission Error: ", error);
      const message =
        error instanceof Error ? error.message : "報告の送信に失敗しました";
      alert("報告の送信に失敗しました: " + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    stopCamera();
    onBack();
  };

  return (
    <div className="flex flex-col h-full bg-bg-app">
      <div className="p-4 bg-white border-b flex items-center gap-3 shadow-sm">
        <button onClick={handleBack} className="p-2 -ml-2">
          <ArrowLeft />
        </button>
        <h2 className="font-bold text-lg">運転履歴 / 報告</h2>
      </div>
      {isFetchingLogs ? (
        <div className="m-auto">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {drivingLogs.map((log) => (
            <div
              key={log.id}
              className={`p-4 rounded-lg border shadow-sm ${drivingLogCardClass(log)}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs text-text-muted">
                    運転記録 No. {log.id.substring(0, 4)}
                  </p>
                  <p className="font-bold text-lg">
                    {formatTimestamp(log.startTime)} -{" "}
                    {log.endTime ? formatTimestamp(log.endTime) : "運転中"}
                  </p>
                </div>
                <ApprovalBadge log={log} />
              </div>

              {getDrivingApprovalStatus(log) === "pending" && (
                <p className="text-xs text-amber-800 mb-2">
                  上長の承認待ちです。承認されるまで正式な運転記録として認められません。
                </p>
              )}
              {getDrivingApprovalStatus(log) === "rejected" && (
                <p className="text-xs text-red-700 mb-2">
                  差戻されました。内容を修正して再送信してください。
                </p>
              )}

              {isFormOpenForLog(log) ? (
                (() => {
                  const reservation = findReservationForDrivingLog(
                    log,
                    reservations
                  ) as Reservation | undefined;
                  const needsReceipt = isRentalReceiptRequired(
                    log,
                    reservation,
                    vehicles
                  );
                  const showSubstituteRebook =
                    isSubstituteVehicleName(
                      log.vehicleModel || reservation?.vehicleModel
                    ) || reservation?.usageStatus === "substitute";

                  return (
                <div className="space-y-3 mt-4">
                  <div>
                    <label className="text-xs font-bold text-text-muted">
                      目的地
                    </label>
                    <input
                      type="text"
                      value={reportDestination}
                      onChange={(e) => setReportDestination(e.target.value)}
                      className="w-full h-11 px-3 mt-1 border-2 bg-slate-50 border-border-muted rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted">
                      利用目的
                    </label>
                    <input
                      type="text"
                      value={reportPurpose}
                      onChange={(e) => setReportPurpose(e.target.value)}
                      className="w-full h-11 px-3 mt-1 border-2 bg-slate-50 border-border-muted rounded-md"
                    />
                  </div>

                  {log.startMileageImageUrl && (
                    <div>
                      <p className="text-xs font-bold text-text-muted mb-1">
                        出発時の走行距離（撮影済み）
                      </p>
                      <img
                        src={log.startMileageImageUrl}
                        alt="出発時の走行距離"
                        className="w-full max-h-40 object-contain rounded-md border bg-black/5"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-text-muted">
                        出発時の距離 (km)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.1"
                        value={reportStartMileage}
                        onChange={(e) => setReportStartMileage(e.target.value)}
                        placeholder="例: 12345"
                        className="w-full h-11 px-3 mt-1 border-2 bg-slate-50 border-border-muted rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-text-muted">
                        終了時の距離 (km)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.1"
                        value={reportEndMileage}
                        onChange={(e) => setReportEndMileage(e.target.value)}
                        placeholder="例: 12380"
                        className="w-full h-11 px-3 mt-1 border-2 bg-slate-50 border-border-muted rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-muted">
                      備考（具体的な理由）
                    </label>
                    <textarea
                      value={reportRemarks}
                      onChange={(e) => setReportRemarks(e.target.value)}
                      placeholder="例：道路工事のため迂回路を利用した など"
                      rows={3}
                      className="w-full px-3 py-2 mt-1 border-2 bg-slate-50 border-border-muted rounded-md text-sm"
                    />
                  </div>

                  {showSubstituteRebook && (
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rebookSubstitute}
                        onChange={(e) => setRebookSubstitute(e.target.checked)}
                        className="w-4 h-4 accent-accent-blue"
                      />
                      <span className="text-sm font-medium">
                        代車の予約を取り直す
                      </span>
                    </label>
                  )}

                  <div className="bg-white p-4 rounded-lg border border-border-muted space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">終了時の走行距離</p>
                      {endMileageImage && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>

                    <div className="relative w-full h-48 overflow-hidden rounded-xl border border-border-muted bg-black">
                      <video
                        ref={isFormOpenForLog(log) ? videoRef : undefined}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${
                          isCameraActive ? "block" : "hidden"
                        }`}
                      />
                      {!isCameraActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800/90 text-white text-xs px-4 text-center">
                          <p>カメラを起動して撮影してください</p>
                          <button
                            type="button"
                            onClick={() => void startCamera()}
                            className="text-[11px] font-bold text-white underline"
                          >
                            カメラを起動
                          </button>
                        </div>
                      )}
                      {isCameraActive && !endMileageImage && (
                        <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => capture(setEndMileageImage)}
                            aria-label="終了時の走行距離撮影"
                            className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform ring-4 ring-blue-100"
                          >
                            <Camera className="w-7 h-7" />
                          </button>
                          <span className="text-[10px] text-white font-bold drop-shadow">
                            撮影
                          </span>
                        </div>
                      )}
                    </div>

                    {endMileageImage && (
                      <div className="flex items-center gap-3">
                        <img
                          src={endMileageImage}
                          className="w-20 h-20 object-cover rounded-md border"
                          alt="終了時の走行距離"
                        />
                        <button
                          type="button"
                          onClick={() => retake(setEndMileageImage)}
                          className="flex items-center gap-1 text-sm font-bold text-accent-blue-light"
                        >
                          <RefreshCw className="w-4 h-4" />
                          再撮影
                        </button>
                      </div>
                    )}
                  </div>

                  {needsReceipt && (
                    <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                      <p className="text-xs font-bold text-amber-900 mb-2">
                        レンタカー利用のため領収書のアップロードが必要です
                      </p>
                      <ReceiptUploadCard
                        compact
                        label="領収書"
                        image={receiptImage}
                        setImage={setReceiptImage}
                      />
                    </div>
                  )}

                  <button
                    onClick={() => handleReportSubmit(log.id)}
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-accent-blue text-white font-bold rounded-md flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : log.status === "driving" ? (
                      "報告を送信"
                    ) : (
                      "変更を送信"
                    )}
                  </button>
                  {editingLogId === log.id && (
                    <button
                      onClick={() => {
                        setEditingLogId(null);
                        setEndMileageImage(null);
                        setReceiptImage(null);
                        stopCamera();
                      }}
                      className="w-full text-xs text-center text-text-muted mt-1"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
                  );
                })()
              ) : (
                <div className="space-y-1 mt-2 pt-2 border-t">
                  <p>
                    <span className="text-xs font-bold w-16 inline-block">
                      目的地:
                    </span>{" "}
                    {log.destination}
                  </p>
                  <p>
                    <span className="text-xs font-bold w-16 inline-block">
                      利用目的:
                    </span>{" "}
                    {log.purpose}
                  </p>
                  {(log.startMileageKm != null || log.endMileageKm != null) && (
                    <p>
                      <span className="text-xs font-bold w-16 inline-block">
                        走行距離:
                      </span>{" "}
                      {formatMileage(log.startMileageKm)} km →{" "}
                      {formatMileage(log.endMileageKm)} km
                    </p>
                  )}
                  {log.remarks && (
                    <p>
                      <span className="text-xs font-bold w-16 inline-block">
                        備考:
                      </span>{" "}
                      {log.remarks}
                    </p>
                  )}
                  {log.receiptImageUrl && (
                    <div className="mt-2">
                      <p className="text-xs font-bold text-text-muted mb-1">
                        領収書
                      </p>
                      <img
                        src={log.receiptImageUrl}
                        alt="領収書"
                        className="w-full max-h-40 object-contain rounded-md border bg-black/5"
                      />
                    </div>
                  )}
                  <div className="text-right pt-2">
                    {(log.status === "driving" ||
                      getDrivingApprovalStatus(log) === "rejected" ||
                      getDrivingApprovalStatus(log) === "approved") && (
                      <button
                      onClick={() => {
                        const fields = loadReportFields(log, reservations);
                        setEditingLogId(log.id);
                        setReportDestination(fields.destination);
                        setReportPurpose(fields.purpose);
                        setReportStartMileage(fields.startMileage);
                        setReportEndMileage(fields.endMileage);
                        setEndMileageImage(fields.endMileageImage);
                        setReceiptImage(fields.receiptImage);
                        setReportRemarks(fields.remarks);
                      }}
                      className="text-sm font-bold text-accent-blue-light"
                    >
                      編集
                    </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
