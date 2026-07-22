import { useEffect } from "react";

import type { User } from "firebase/auth";

import { initAuth, logout } from "../lib/firebase";
import { ApiError } from "../lib/api";
import { fetchAuthBootstrap } from "../lib/drivingLogs";
import { getRestoredFlowScreen } from "../lib/flowPersistence";
import { clearQrQueryParamsFromUrl } from "../lib/qrDriveStart";
import { screenFromPath } from "../lib/screenRoutes";
import { fetchCanStartDriving } from "../lib/reservations";
import {
  claimUserSession,
  clearLocalSessionId,
  FORCE_SESSION_TAKEOVER_KEY,
  getOrCreateLocalSessionId,
  SessionBlockedError
} from "../lib/userSession";
import { EtcStep, Screen, type DrivingStatus, type UserProfile } from "../types";

type QrParams = {
  vehicleNumber: string;
  vehicleModel: string;
  shouldOpenReserve: boolean;
  shouldOpenDriveStart: boolean;
};

type AppAuthOptions = {
  restoredDrivingStatus: DrivingStatus | null;
  restoredHasReservation: boolean;
  restoredVehicleNumber: string;
  restoredVehicleModel: string;
  restoredEtcStartTime: Date | null;
  setDrivingStatus: (status: DrivingStatus) => void;
  setHasReservation: (value: boolean) => void;
  setVehicleNumber: (value: string) => void;
  setVehicleModel: (value: string) => void;
  setEtcStartTime: (value: Date | null) => void;
  setEtcStep: (step: EtcStep) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setScreen: (screen: Screen) => void;
  setIsLoading: (value: boolean) => void;
  setSessionBlockMessage: (message: string | null) => void;
};

function parseQrParams(): QrParams {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const qrName = params.get("name");
  const hasName = !!qrName;

  return {
    shouldOpenReserve: mode === "reserve" && hasName,
    shouldOpenDriveStart: mode === "drive" && hasName,
    vehicleNumber: qrName ? decodeURIComponent(qrName) : "",
    vehicleModel: params.has("vin")
      ? decodeURIComponent(params.get("vin")!)
      : ""
  };
}

function formatPostAuthError(error: unknown): string {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (error instanceof SessionBlockedError) {
    return error.message;
  }
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === "session_blocked") {
      return new SessionBlockedError().message;
    }
    if (error.status === 401) {
      if (isLocalhost) {
        return "ローカル開発の認証に失敗しました。.env の VITE_API_BASE_URL を有効にするか、gcloud auth application-default login を実行して npm run dev を再起動してください。";
      }
      return "ログイン後の認証に失敗しました。ページを再読み込みして再度お試しください。";
    }
    if (error.status >= 500) {
      if (isLocalhost) {
        return "ローカル開発サーバーが Firestore に接続できません。.env の VITE_API_BASE_URL を有効にするか、gcloud auth application-default login を実行して npm run dev を再起動してください。";
      }
      return "サーバーとの通信に失敗しました。しばらくしてから再度お試しください。";
    }
    return error.message || "ログイン後の処理に失敗しました。";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "ログイン後の処理に失敗しました。";
}

async function resolvePostAuthScreen(
  userEmail: string,
  qrParams: QrParams,
  drivingStatus: DrivingStatus,
  options: Pick<
    AppAuthOptions,
    "setDrivingStatus" | "setVehicleNumber" | "setVehicleModel" | "setScreen"
  >
): Promise<void> {
  const { setDrivingStatus, setVehicleNumber, setVehicleModel, setScreen } =
    options;

  if (qrParams.shouldOpenReserve) {
    setVehicleNumber(qrParams.vehicleNumber);
    if (qrParams.vehicleModel) setVehicleModel(qrParams.vehicleModel);
    clearQrQueryParamsFromUrl();
    setScreen(Screen.RESERVE);
    return;
  }

  if (qrParams.shouldOpenDriveStart) {
    setVehicleNumber(qrParams.vehicleNumber);
    if (qrParams.vehicleModel) setVehicleModel(qrParams.vehicleModel);
    clearQrQueryParamsFromUrl();

    if (drivingStatus === "driving") {
      alert("すでに運転中です。終了する場合はメインメニューから操作してください。");
      setScreen(Screen.MAIN_MENU);
      return;
    }
    if (drivingStatus === "needs_report") {
      alert("未送信の運転報告があります。先に報告を完了してください。");
      setScreen(Screen.DRIVING_LOG);
      return;
    }

    try {
      const result = await fetchCanStartDriving(
        userEmail,
        false,
        qrParams.vehicleNumber
      );
      if (!result.allowed) {
        alert(
          result.reason ??
            "この車両では現在運転を開始できません。予約時間内か確認してください。"
        );
        setScreen(Screen.MAIN_MENU);
        return;
      }
    } catch (error) {
      console.warn("運転開始可否の確認に失敗しました", error);
      alert("運転開始の可否確認に失敗しました。再度QRを読み取ってください。");
      setScreen(Screen.MAIN_MENU);
      return;
    }

    setDrivingStatus("idle");
    setScreen(Screen.DRIVING_START_ALCOHOL);
    return;
  }

  setScreen(getRestoredFlowScreen() ?? screenFromPath(window.location.pathname) ?? Screen.MAIN_MENU);
}

async function handleAuthenticatedUser(
  user: User,
  qrParams: QrParams,
  isMounted: () => boolean,
  options: AppAuthOptions
) {
  const {
    setDrivingStatus,
    setHasReservation,
    setUserProfile,
    setScreen,
    setIsLoading,
    setSessionBlockMessage
  } = options;

  if (!user.email) {
    if (!isMounted()) return;
    setSessionBlockMessage(
      "ログインID（メール）が取得できません。管理者にお問い合わせください。"
    );
    setUserProfile(null);
    setScreen(Screen.SIGN_IN);
    setIsLoading(false);
    return;
  }

  setIsLoading(true);
  setSessionBlockMessage(null);

  try {
    const sessionId = getOrCreateLocalSessionId(user.uid);
    await user.getIdToken();
    const forceTakeover =
      sessionStorage.getItem(FORCE_SESSION_TAKEOVER_KEY) === "1";
    sessionStorage.removeItem(FORCE_SESSION_TAKEOVER_KEY);
    await claimUserSession(
      null,
      user.uid,
      user.email,
      sessionId,
      forceTakeover
    );

    if (!isMounted()) return;

    setUserProfile({
      email: user.email,
      uid: user.uid,
      name: user.displayName ?? localStorage.getItem("userName")
    });
    localStorage.setItem("userEmail", user.email);
    if (user.displayName) {
      localStorage.setItem("userName", user.displayName);
    }

    const bootstrap = await fetchAuthBootstrap({
      name: user.displayName ?? localStorage.getItem("userName"),
      vehicleNumber:
        qrParams.vehicleNumber || options.restoredVehicleNumber || undefined
    });
    if (!isMounted()) return;

    setHasReservation(bootstrap.hasReservation);
    const nextDrivingStatus = bootstrap.drivingStatus;
    if (bootstrap.drivingStatus !== "idle") {
      setDrivingStatus(bootstrap.drivingStatus);
    }

    await resolvePostAuthScreen(
      user.email,
      qrParams,
      nextDrivingStatus,
      options
    );
  } catch (error) {
    if (error instanceof SessionBlockedError) {
      clearLocalSessionId(user.uid);
      await logout();
      if (!isMounted()) return;
      setSessionBlockMessage(error.message);
      setUserProfile(null);
      setScreen(Screen.SIGN_IN);
      return;
    }

    console.error("認証後の処理に失敗しました", error);
    await logout();
    if (!isMounted()) return;
    setSessionBlockMessage(formatPostAuthError(error));
    setUserProfile(null);
    setScreen(Screen.SIGN_IN);
  } finally {
    if (isMounted()) setIsLoading(false);
  }
}

export function useAppAuth(options: AppAuthOptions) {
  const {
    restoredDrivingStatus,
    restoredHasReservation,
    restoredVehicleNumber,
    restoredVehicleModel,
    restoredEtcStartTime,
    setDrivingStatus,
    setHasReservation,
    setVehicleNumber,
    setVehicleModel,
    setEtcStartTime,
    setEtcStep,
    setUserProfile,
    setScreen,
    setIsLoading,
    setSessionBlockMessage
  } = options;

  useEffect(() => {
    let isMounted = true;
    let authUnsub: (() => void) | undefined;
    const qrParams = parseQrParams();

    const clearAuthReadyTimeout = () => {
      window.clearTimeout(authReadyTimeout);
    };
    // Firebase 初期化が止まってもログイン画面を出す
    const authReadyTimeout = window.setTimeout(() => {
      if (!isMounted) return;
      setIsLoading(false);
    }, 12_000);

    if (restoredDrivingStatus) setDrivingStatus(restoredDrivingStatus);
    if (restoredHasReservation) setHasReservation(true);
    if (restoredVehicleNumber) setVehicleNumber(restoredVehicleNumber);
    if (restoredVehicleModel) setVehicleModel(restoredVehicleModel);
    if (qrParams.shouldOpenReserve || qrParams.shouldOpenDriveStart) {
      setVehicleNumber(qrParams.vehicleNumber);
      if (qrParams.vehicleModel) setVehicleModel(qrParams.vehicleModel);
    }

    void initAuth(
      (user) => {
        if (!isMounted) return;
        clearAuthReadyTimeout();

        if (user?.email) {
          void handleAuthenticatedUser(user, qrParams, () => isMounted, {
            restoredDrivingStatus,
            restoredHasReservation,
            restoredVehicleNumber,
            restoredVehicleModel,
            restoredEtcStartTime,
            setDrivingStatus,
            setHasReservation,
            setVehicleNumber,
            setVehicleModel,
            setEtcStartTime,
            setEtcStep,
            setUserProfile,
            setScreen,
            setIsLoading,
            setSessionBlockMessage
          }).catch(async (error) => {
            console.error("認証後の処理に失敗しました", error);
            if (!isMounted) return;
            await logout();
            setSessionBlockMessage(formatPostAuthError(error));
            setUserProfile(null);
            setScreen(Screen.SIGN_IN);
            setIsLoading(false);
          });
        } else {
          setUserProfile(null);
          setScreen(Screen.SIGN_IN);
          setIsLoading(false);
        }
      },
      () => {
        if (!isMounted) return;
        clearAuthReadyTimeout();
        setUserProfile(null);
        setScreen(Screen.SIGN_IN);
        setIsLoading(false);
      }
    ).then((unsub) => {
      authUnsub = unsub;
    }).catch((error) => {
      console.error("認証の初期化に失敗しました", error);
      if (!isMounted) return;
      clearAuthReadyTimeout();
      setUserProfile(null);
      setScreen(Screen.SIGN_IN);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      clearAuthReadyTimeout();
      authUnsub?.();
    };
  }, []);
}
