import { getAuthInstance, logout } from "../lib/firebase";
import {
  findActiveReservation,
  destinationFromReservation
} from "../lib/drivingLogUtils";
import {
  endDrivingLog,
  fetchMyDrivingLogs,
  startDrivingLog
} from "../lib/drivingLogs";
import {
  fetchActiveReservations,
  fetchCanStartDriving
} from "../lib/reservations";
import { createEtcRecord, createRefuelingRecord } from "../lib/records";
import {
  clearAllFlowDrafts,
  clearEtcDraft,
  clearRefuelDraft
} from "../lib/flowPersistence";
import { isEtcCategoryOther } from "../../shared/etcCategories";
import { uploadToSakura } from "../lib/sakuraUpload";
import {
  clearLocalSessionId,
  clearUserSession,
  getLocalSessionId
} from "../lib/userSession";
import { EtcStep, Screen, type DrivingStatus, type UserProfile } from "../types";

type GpsControls = {
  startGpsTracking: (label: string) => void;
  clearGpsTracking: () => void;
};

type AppHandlerOptions = {
  userProfile: UserProfile | null;
  drivingStatus: DrivingStatus;
  vehicleNumber: string;
  vehicleModel: string;
  meterImage: string | null;
  receiptImage: string | null;
  etcStartTime: Date | null;
  etcPhotos: string[];
  etcCategory: string;
  etcOtherReason: string;
  etcDestination: string;
  etcRouteStart: string;
  etcRouteEnd: string;
  alcoholCheckImage: string | null;
  startMeterImage: string | null;
  startMileageImage: string | null;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setDrivingStatus: (status: DrivingStatus) => void;
  setHasReservation: (value: boolean) => void;
  setCanStartDriving: (value: boolean) => void;
  setVehicleNumber: (value: string) => void;
  setVehicleModel: (value: string) => void;
  setScreen: (screen: Screen) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setEtcStartTime: (value: Date | null) => void;
  setEtcStep: (step: EtcStep) => void;
  setEtcPhotos: (value: string[]) => void;
  setEtcOtherReason: (value: string) => void;
  setEtcDestination: (value: string) => void;
  setEtcRouteStart: (value: string) => void;
  setEtcRouteEnd: (value: string) => void;
  setAlcoholCheckImage: (value: string | null) => void;
  setStartMeterImage: (value: string | null) => void;
  setStartMileageImage: (value: string | null) => void;
  setStartMileageImageUrl: (value: string | null) => void;
  gps: GpsControls;
  refreshDrivingStartEligibility: (currentlyDriving?: boolean) => Promise<void>;
};

export function useAppHandlers(options: AppHandlerOptions) {
  const {
    userProfile,
    drivingStatus,
    vehicleNumber,
    vehicleModel,
    meterImage,
    receiptImage,
    etcStartTime,
    etcPhotos,
    etcCategory,
    etcOtherReason,
    etcDestination,
    etcRouteStart,
    etcRouteEnd,
    alcoholCheckImage,
    startMeterImage,
    startMileageImage,
    setIsSubmitting,
    setDrivingStatus,
    setHasReservation,
    setCanStartDriving,
    setVehicleNumber,
    setVehicleModel,
    setScreen,
    setUserProfile,
    setEtcStartTime,
    setEtcStep,
    setEtcPhotos,
    setEtcOtherReason,
    setEtcDestination,
    setEtcRouteStart,
    setEtcRouteEnd,
    setAlcoholCheckImage,
    setStartMeterImage,
    setStartMileageImage,
    setStartMileageImageUrl,
    gps,
    refreshDrivingStartEligibility
  } = options;

  const handleEtcStart = () => {
    setEtcStartTime(new Date());
    setEtcStep(EtcStep.IN_USE);
    setScreen(Screen.ETC_IN_USE);
    gps.startGpsTracking("ETC_TRACKING");
  };

  const clearSessionAndLogout = async () => {
    try {
      const auth = await getAuthInstance();
      const uid = auth.currentUser?.uid;
      if (uid) {
        const sessionId = getLocalSessionId(uid);
        if (sessionId) {
          await clearUserSession(null, uid, sessionId);
        }
        clearLocalSessionId(uid);
      }
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const resetAppAfterLogout = () => {
    setUserProfile(null);
    void clearAllFlowDrafts();
    localStorage.clear();
    setScreen(Screen.SIGN_IN);
    setDrivingStatus("idle");
    setHasReservation(false);
  };

  const handleLogout = () => {
    if (!confirm("ログアウトしますか？")) return;

    void clearSessionAndLogout().finally(resetAppAfterLogout);
  };

  const handleForcedLogout = (message: string) => {
    void clearSessionAndLogout().finally(() => {
      resetAppAfterLogout();
      alert(message);
    });
  };

  const handleRefuelSubmit = async () => {
    if (!userProfile || !meterImage || !receiptImage) return;
    setIsSubmitting(true);
    try {
      const [meterImageUrl, receiptImageUrl] = await Promise.all([
        uploadToSakura(meterImage),
        uploadToSakura(receiptImage)
      ]);

      let logVehicleNumber = vehicleNumber.trim();
      let logVehicleModel = vehicleModel.trim();

      if (!logVehicleNumber || !logVehicleModel) {
        try {
          const reservations = await fetchActiveReservations();
          const matchedReservation = findActiveReservation(
            reservations,
            userProfile.email,
            logVehicleNumber
          );
          logVehicleNumber =
            logVehicleNumber ||
            String(matchedReservation?.vehicleNumber ?? "").trim();
          logVehicleModel =
            logVehicleModel ||
            String(matchedReservation?.vehicleModel ?? "").trim();
        } catch (error) {
          console.warn("予約情報の取得に失敗しました", error);
        }
      }

      if (!logVehicleNumber || !logVehicleModel) {
        try {
          const logs = await fetchMyDrivingLogs(20);
          const drivingLog = logs.find(
            (log) => (log.status as string | undefined) === "driving"
          );
          if (drivingLog) {
            logVehicleNumber =
              logVehicleNumber || String(drivingLog.vehicleNumber ?? "").trim();
            logVehicleModel =
              logVehicleModel || String(drivingLog.vehicleModel ?? "").trim();
          }
        } catch (error) {
          console.warn("運転記録の取得に失敗しました", error);
        }
      }

      if (logVehicleNumber) setVehicleNumber(logVehicleNumber);
      if (logVehicleModel) setVehicleModel(logVehicleModel);

      await createRefuelingRecord({
        vehicleNumber: logVehicleNumber,
        vehicleModel: logVehicleModel,
        meterImageUrl,
        receiptImageUrl
      });
      setScreen(Screen.REFUEL_COMPLETE);
      setMeterImage(null);
      setReceiptImage(null);
      await clearRefuelDraft();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "送信失敗";
      alert("送信失敗: " + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEtcSubmit = async () => {
    if (!userProfile || !etcStartTime || etcPhotos.length === 0) return;
    if (isEtcCategoryOther(etcCategory) && !etcOtherReason.trim()) {
      alert("「その他の理由」を入力してください。");
      return;
    }
    setIsSubmitting(true);
    try {
      const photoUrls = await Promise.all(etcPhotos.map(uploadToSakura));
      const payload: Record<string, unknown> = {
        startTime: etcStartTime.toISOString(),
        vehicleNumber,
        vehicleModel,
        category: etcCategory,
        destination: "",
        routeStart: etcRouteStart,
        routeEnd: etcRouteEnd,
        photoUrls
      };
      if (isEtcCategoryOther(etcCategory)) {
        payload.otherReason = etcOtherReason.trim();
      }
      const result = await createEtcRecord(payload);
      alert(
        result.approvalStatus === "approved"
          ? "ETC利用申請を保存しました。"
          : "ETC利用申請を保存しました。上長の承認後に正式に認められます。"
      );
      setEtcStartTime(null);
      setEtcStep(EtcStep.START);
      setEtcPhotos([]);
      setEtcOtherReason("");
      setEtcDestination("");
      setEtcRouteStart("");
      setEtcRouteEnd("");
      setScreen(Screen.MAIN_MENU);
      await clearEtcDraft();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "保存失敗";
      alert("保存失敗: " + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDrivingLogSubmit = async () => {
    const dashboardImage = startMeterImage ?? startMileageImage;
    if (!userProfile || !alcoholCheckImage || !dashboardImage) {
      alert("アルコールチェックと燃料・走行距離の写真が必要です。");
      return;
    }

    try {
      const result = await fetchCanStartDriving(
        userProfile.email,
        drivingStatus === "driving",
        vehicleNumber
      );
      if (!result.allowed) {
        alert(
          result.reason ??
            "終日利用の予約では、運転開始は1日1回のみです。"
        );
        setScreen(Screen.MAIN_MENU);
        return;
      }
    } catch (error) {
      console.warn("運転開始可否の確認に失敗しました", error);
    }

    setIsSubmitting(true);
    try {
      const [alcoholUrl, dashboardUrl] = await Promise.all([
        uploadToSakura(alcoholCheckImage),
        uploadToSakura(dashboardImage)
      ]);

      let matchedReservation: Record<string, unknown> | undefined;
      try {
        const reservations = await fetchActiveReservations();
        matchedReservation = findActiveReservation(
          reservations,
          userProfile.email,
          vehicleNumber
        ) as Record<string, unknown> | undefined;
      } catch (error) {
        console.warn("予約情報の取得に失敗しました", error);
      }

      if (
        matchedReservation?.isPersonal === true &&
        typeof matchedReservation?.vehicleNumber === "string"
      ) {
        try {
          const { fetchVehicles } = await import("../lib/vehicles");
          const vehicles = await fetchVehicles();
          const personalVehicle = vehicles.find(
            (v) =>
              v.vehicleNumber === matchedReservation?.vehicleNumber &&
              v.isPersonal &&
              v.personalOwnerEmail !== userProfile.email
          );
          if (personalVehicle?.id) {
            alert("この車両は他のユーザーの個人保有車です。");
            setScreen(Screen.MAIN_MENU);
            return;
          }
        } catch (error) {
          console.warn("車両情報の取得に失敗しました", error);
        }
      }

      const logVehicleNumber = String(
        matchedReservation?.vehicleNumber ?? vehicleNumber ?? ""
      );
      const logVehicleModel = String(
        matchedReservation?.vehicleModel ?? vehicleModel ?? ""
      );
      const logDestination = destinationFromReservation(
        matchedReservation as Parameters<typeof destinationFromReservation>[0]
      );
      const logPurpose = String(matchedReservation?.category ?? "");

      if (logVehicleNumber) setVehicleNumber(logVehicleNumber);
      if (logVehicleModel) setVehicleModel(logVehicleModel);

      const userName =
        userProfile.name?.trim() ||
        localStorage.getItem("userName")?.trim() ||
        "";
      const reservationId =
        typeof matchedReservation?.id === "string"
          ? matchedReservation.id
          : "";
      const reservationStartTime =
        typeof matchedReservation?.startTime === "string"
          ? matchedReservation.startTime
          : matchedReservation?.startTime instanceof Date
            ? matchedReservation.startTime.toISOString()
            : "";
      const reservationEndTime =
        typeof matchedReservation?.endTime === "string"
          ? matchedReservation.endTime
          : matchedReservation?.endTime instanceof Date
            ? matchedReservation.endTime.toISOString()
            : "";

      const drivingLogData: Record<string, unknown> = {
        vehicleNumber: logVehicleNumber,
        vehicleModel: logVehicleModel,
        alcoholCheckImageUrl: alcoholUrl,
        startMeterImageUrl: dashboardUrl,
        startMileageImageUrl: dashboardUrl
      };
      if (userName) drivingLogData.userName = userName;
      if (reservationId) drivingLogData.reservationId = reservationId;
      if (reservationStartTime) {
        drivingLogData.reservationStartTime = reservationStartTime;
      }
      if (reservationEndTime) {
        drivingLogData.reservationEndTime = reservationEndTime;
      }
      if (logDestination) drivingLogData.destination = logDestination;
      if (logPurpose) drivingLogData.purpose = logPurpose;

      await startDrivingLog(drivingLogData);
      gps.startGpsTracking("DRIVING_TRACKING");

      alert("運転開始を記録しました。");
      setAlcoholCheckImage(null);
      setStartMeterImage(null);
      setStartMileageImage(null);
      setStartMileageImageUrl(dashboardUrl);
      setDrivingStatus("driving");
      setScreen(Screen.MAIN_MENU);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "送信に失敗しました";
      alert("送信に失敗しました: " + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDrivingEnd = async () => {
    gps.clearGpsTracking();
    setDrivingStatus("needs_report");
    setVehicleNumber("");
    setVehicleModel("");
    setStartMileageImageUrl(null);
    setScreen(Screen.MAIN_MENU);

    if (!userProfile) {
      await refreshDrivingStartEligibility(false);
      return;
    }

    try {
      const logs = await fetchMyDrivingLogs(20);
      const active = logs.find(
        (log) => (log.status as string | undefined) === "driving"
      );
      if (active?.id) {
        await endDrivingLog(active.id);
      }
    } catch (error) {
      console.error("運転終了の記録に失敗しました", error);
    }

    await refreshDrivingStartEligibility(false);
  };

  return {
    handleEtcStart,
    handleLogout,
    handleForcedLogout,
    handleRefuelSubmit,
    handleEtcSubmit,
    handleDrivingLogSubmit,
    handleDrivingEnd,
    uploadToSakura
  };
}
