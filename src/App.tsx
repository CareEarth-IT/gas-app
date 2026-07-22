import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Home, LogOut } from "lucide-react";

import { AppScreenContent } from "./app/AppScreenContent";
import { useAppAuth } from "./hooks/useAppAuth";
import { useAppHandlers } from "./hooks/useAppHandlers";
import { useCameraCapture } from "./hooks/useCameraCapture";
import { useDrivingStartEligibility } from "./hooks/useDrivingStartEligibility";
import { useGpsTracking } from "./hooks/useGpsTracking";
import {
  restorePersistedAppState,
  usePersistedAppState
} from "./hooks/usePersistedAppState";
import {
  buildInitialFlowMeta,
  useFlowPersistence
} from "./hooks/useFlowPersistence";
import { useScreenUrlSync } from "./hooks/useScreenUrlSync";
import { restoreFlowImages, clearFlowForScreen } from "./lib/flowPersistence";
import { useUserSession } from "./hooks/useUserSession";
import { hasActiveReservationForUser } from "./lib/reservations";
import { EtcStep, Screen, type DrivingStatus, type UserProfile } from "./types";

const persistedState = restorePersistedAppState();
const initialFlow = buildInitialFlowMeta();

export default function App() {
  const [screen, setScreen] = useState<Screen>(Screen.SIGN_IN);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drivingStatus, setDrivingStatus] = useState<DrivingStatus>(
    persistedState.drivingStatus ?? "idle"
  );
  const [hasReservation, setHasReservation] = useState(
    persistedState.hasReservation
  );
  const [vehicleNumber, setVehicleNumber] = useState(
    persistedState.vehicleNumber
  );
  const [vehicleModel, setVehicleModel] = useState(persistedState.vehicleModel);

  const [meterImage, setMeterImage] = useState<string | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const [etcStep, setEtcStep] = useState<EtcStep>(initialFlow.etcStep);
  const [etcStartTime, setEtcStartTime] = useState<Date | null>(
    persistedState.etcStartTime
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [etcPhotos, setEtcPhotos] = useState<string[]>([]);
  const [etcCategory, setEtcCategory] = useState(initialFlow.etcCategory);
  const [etcOtherReason, setEtcOtherReason] = useState(initialFlow.etcOtherReason);
  const [etcDestination, setEtcDestination] = useState(initialFlow.etcDestination);
  const [etcRouteStart, setEtcRouteStart] = useState(initialFlow.etcRouteStart);
  const [etcRouteEnd, setEtcRouteEnd] = useState(initialFlow.etcRouteEnd);

  const [alcoholCheckImage, setAlcoholCheckImage] = useState<string | null>(null);
  const [startMeterImage, setStartMeterImage] = useState<string | null>(null);
  const [startMileageImage, setStartMileageImage] = useState<string | null>(null);
  const [startMileageImageUrl, setStartMileageImageUrl] = useState<string | null>(
    persistedState.startMileageImageUrl
  );
  const [capturingFor, setCapturingFor] = useState<
    "alcohol" | "startMeter" | "startMileage" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionBlockMessage, setSessionBlockMessage] = useState<string | null>(
    null
  );

  const camera = useCameraCapture();
  const gps = useGpsTracking({
    userEmail: userProfile?.email,
    vehicleNumber
  });

  usePersistedAppState({
    drivingStatus,
    hasReservation,
    vehicleNumber,
    vehicleModel,
    etcStartTime,
    startMileageImageUrl
  });

  useFlowPersistence({
    screen,
    etcStep,
    meterImage,
    receiptImage,
    etcPhotos,
    etcCategory,
    etcOtherReason,
    etcDestination,
    etcRouteStart,
    etcRouteEnd
  });

  useScreenUrlSync({
    screen,
    setScreen,
    enabled: !isLoading
  });

  useEffect(() => {
    void restoreFlowImages().then((images) => {
      setMeterImage(images.meterImage);
      setReceiptImage(images.receiptImage);
      setEtcPhotos(images.etcPhotos);
    });
  }, []);

  useEffect(() => {
    if (!userProfile || screen !== Screen.ETC_IN_USE) return;
    gps.startGpsTracking("ETC_TRACKING");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ETC復帰時のみGPSを再開
  }, [screen === Screen.ETC_IN_USE ? userProfile?.email : null]);

  useAppAuth({
    restoredDrivingStatus: persistedState.drivingStatus,
    restoredHasReservation: persistedState.hasReservation,
    restoredVehicleNumber: persistedState.vehicleNumber,
    restoredVehicleModel: persistedState.vehicleModel,
    restoredEtcStartTime: persistedState.etcStartTime,
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
  });

  const {
    canStartDriving,
    drivingBlockReason,
    setCanStartDriving,
    refreshDrivingStartEligibility
  } = useDrivingStartEligibility({
    userProfile,
    hasReservation,
    drivingStatus,
    screen,
    vehicleNumber
  });

  const handlers = useAppHandlers({
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
    isSubmitting,
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
  });

  useUserSession({
    uid: userProfile?.uid ?? null,
    onForcedLogout: () => {
      handlers.handleForcedLogout(
        "他の端末でログインされたため、ログアウトしました。"
      );
    }
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBackToMainMenu = () => {
    camera.stopCamera();
    gps.clearGpsTracking();
    if (screen === Screen.ETC_IN_USE || screen === Screen.ETC_ARRIVED) {
      setEtcStep(EtcStep.START);
      setEtcStartTime(null);
    }
    void clearFlowForScreen(screen);
    setScreen(Screen.MAIN_MENU);
  };

  const handleReservationCancelled = () => {
    void (async () => {
      if (!userProfile) {
        setHasReservation(false);
        setVehicleNumber("");
        setVehicleModel("");
        return;
      }

      const still = await hasActiveReservationForUser(userProfile.email);
      setHasReservation(still);
      if (!still) {
        setVehicleNumber("");
        setVehicleModel("");
      }
    })();
  };

  return (
    <div className="min-h-screen bg-slate-200 font-sans flex flex-col items-center">
      <div className="w-full max-w-[450px] min-h-screen flex flex-col bg-white shadow-xl relative">
        <header className="bg-[#4a72b2] p-3 z-10 shrink-0 shadow-md flex items-center justify-between h-[52px]">
          <div>
            {userProfile && screen !== Screen.MAIN_MENU && (
              <button
                onClick={handleBackToMainMenu}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center active:bg-white/30"
                title="メインメニューに戻る"
              >
                <Home className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
          {userProfile && (
            <button
              onClick={handlers.handleLogout}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center active:bg-white/30"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>
          )}
        </header>

        <main className="flex-1 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col h-full"
            >
              <AppScreenContent
                screen={screen}
                isLoading={isLoading}
                sessionBlockMessage={sessionBlockMessage}
                onClearSessionBlockMessage={() => setSessionBlockMessage(null)}
                userProfile={userProfile}
                drivingStatus={drivingStatus}
                hasReservation={hasReservation}
                canStartDriving={canStartDriving}
                drivingBlockReason={drivingBlockReason}
                vehicleNumber={vehicleNumber}
                vehicleModel={vehicleModel}
                meterImage={meterImage}
                receiptImage={receiptImage}
                etcStep={etcStep}
                etcStartTime={etcStartTime}
                currentTime={currentTime}
                etcPhotos={etcPhotos}
                etcCategory={etcCategory}
                etcOtherReason={etcOtherReason}
                etcRouteStart={etcRouteStart}
                etcRouteEnd={etcRouteEnd}
                alcoholCheckImage={alcoholCheckImage}
                startMeterImage={startMeterImage}
                startMileageImage={startMileageImage}
                startMileageImageUrl={startMileageImageUrl}
                capturingFor={capturingFor}
                isSubmitting={isSubmitting}
                gpsTimerRef={gps.gpsTimerRef}
                camera={camera}
                setScreen={setScreen}
                setUserProfile={setUserProfile}
                setDrivingStatus={setDrivingStatus}
                setHasReservation={setHasReservation}
                onReservationCancelled={handleReservationCancelled}
                setVehicleNumber={setVehicleNumber}
                setVehicleModel={setVehicleModel}
                setMeterImage={setMeterImage}
                setReceiptImage={setReceiptImage}
                setEtcStep={setEtcStep}
                setEtcCategory={setEtcCategory}
                setEtcOtherReason={setEtcOtherReason}
                setEtcRouteStart={setEtcRouteStart}
                setEtcRouteEnd={setEtcRouteEnd}
                setEtcPhotos={setEtcPhotos}
                setCapturingFor={setCapturingFor}
                setAlcoholCheckImage={setAlcoholCheckImage}
                setStartMeterImage={setStartMeterImage}
                setStartMileageImage={setStartMileageImage}
                onEndDriving={handlers.handleDrivingEnd}
                onRefuelSubmit={handlers.handleRefuelSubmit}
                onEtcStart={handlers.handleEtcStart}
                onEtcSubmit={handlers.handleEtcSubmit}
                onDrivingLogSubmit={handlers.handleDrivingLogSubmit}
                uploadToSakura={handlers.uploadToSakura}
                onBackToMainMenu={handleBackToMainMenu}
              />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <canvas ref={camera.canvasRef} className="hidden" />
    </div>
  );
}
