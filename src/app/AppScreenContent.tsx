import type { MutableRefObject, RefObject } from "react";
import { Loader2 } from "lucide-react";

import { refuelStepFromScreen, screenFromRefuelStep } from "../lib/refuelNavigation";
import DrivingLogPage from "../pages/DrinvingLogPage";
import DrivingStartPage from "../pages/DrivingStartPage";
import EtcPage from "../pages/EtcPage";
import LoginPage from "../pages/LoginPage";
import MainMenuPage from "../pages/MainMunePage";
import MileageConfirmPage from "../pages/MileageConfirmPage";
import RefuelPage from "../pages/RefuelPage";
import ReservePage from "../pages/ReserverPage";
import ReservationSchedulePage from "../pages/ReservationSchedulePage";
import SignUpPage from "../pages/SignUpPage";
import { EtcStep, Screen, type DrivingStatus, type UserProfile } from "../types";

type CameraApi = {
  videoRef: RefObject<HTMLVideoElement>;
  isCameraActive: boolean;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
  capturePhoto: (
    setter: (value: string) => void,
    options?: { keepCameraOpen?: boolean }
  ) => Promise<void>;
};

type AppScreenContentProps = {
  screen: Screen;
  isLoading: boolean;
  sessionBlockMessage: string | null;
  onClearSessionBlockMessage: () => void;
  userProfile: UserProfile | null;
  drivingStatus: DrivingStatus;
  hasReservation: boolean;
  canStartDriving: boolean;
  drivingBlockReason: string | null;
  vehicleNumber: string;
  vehicleModel: string;
  meterImage: string | null;
  receiptImage: string | null;
  etcStep: EtcStep;
  etcStartTime: Date | null;
  currentTime: Date;
  etcPhotos: string[];
  etcCategory: string;
  etcOtherReason: string;
  etcRouteStart: string;
  etcRouteEnd: string;
  alcoholCheckImage: string | null;
  startMeterImage: string | null;
  startMileageImage: string | null;
  startMileageImageUrl: string | null;
  capturingFor: "alcohol" | "startMeter" | "startMileage" | null;
  isSubmitting: boolean;
  gpsTimerRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  camera: CameraApi;
  setScreen: (screen: Screen) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setDrivingStatus: (status: DrivingStatus) => void;
  setHasReservation: (value: boolean) => void;
  onReservationCancelled: () => void;
  setVehicleNumber: (value: string) => void;
  setVehicleModel: (value: string) => void;
  setMeterImage: (value: string | null) => void;
  setReceiptImage: (value: string | null) => void;
  setEtcStep: (step: EtcStep) => void;
  setEtcCategory: (value: string) => void;
  setEtcOtherReason: (value: string) => void;
  setEtcRouteStart: (value: string) => void;
  setEtcRouteEnd: (value: string) => void;
  setEtcPhotos: (value: string[]) => void;
  setCapturingFor: (value: "alcohol" | "startMeter" | "startMileage" | null) => void;
  setAlcoholCheckImage: (value: string | null) => void;
  setStartMeterImage: (value: string | null) => void;
  setStartMileageImage: (value: string | null) => void;
  onEndDriving: () => void;
  onRefuelSubmit: () => Promise<void>;
  onEtcStart: () => void;
  onEtcSubmit: () => Promise<void>;
  onDrivingLogSubmit: () => Promise<void>;
  uploadToSakura: (imageData: string) => Promise<string>;
  onBackToMainMenu: () => void;
};

export function AppScreenContent(props: AppScreenContentProps) {
  const {
    screen,
    isLoading,
    sessionBlockMessage,
    onClearSessionBlockMessage,
    userProfile,
    drivingStatus,
    hasReservation,
    canStartDriving,
    drivingBlockReason,
    vehicleNumber,
    vehicleModel,
    meterImage,
    receiptImage,
    etcStep,
    currentTime,
    etcPhotos,
    etcCategory,
    etcOtherReason,
    etcRouteStart,
    etcRouteEnd,
    alcoholCheckImage,
    startMeterImage,
    startMileageImage,
    startMileageImageUrl,
    capturingFor,
    isSubmitting,
    gpsTimerRef,
    camera,
    setScreen,
    setUserProfile,
    setDrivingStatus,
    setHasReservation,
    onReservationCancelled,
    setVehicleNumber,
    setVehicleModel,
    setMeterImage,
    setReceiptImage,
    setEtcStep,
    setEtcCategory,
    setEtcOtherReason,
    setEtcRouteStart,
    setEtcRouteEnd,
    setEtcPhotos,
    setCapturingFor,
    setAlcoholCheckImage,
    setStartMeterImage,
    setStartMileageImage,
    onEndDriving,
    onRefuelSubmit,
    onEtcStart,
    onEtcSubmit,
    onDrivingLogSubmit,
    uploadToSakura,
    onBackToMainMenu
  } = props;

  if (isLoading) {
    return (
      <div className="m-auto">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  switch (screen) {
    case Screen.SIGN_IN:
      return (
        <LoginPage
          setScreen={setScreen}
          sessionBlockMessage={sessionBlockMessage}
          onClearSessionBlockMessage={onClearSessionBlockMessage}
        />
      );

    case Screen.SIGN_UP:
      return <SignUpPage setScreen={setScreen} />;

    case Screen.MAIN_MENU:
      return (
        <MainMenuPage
          userProfile={userProfile}
          drivingStatus={drivingStatus}
          setScreen={setScreen}
          setEtcStep={setEtcStep}
          startCamera={camera.startCamera}
          onEndDriving={onEndDriving}
          hasReservation={hasReservation}
          canStartDriving={canStartDriving}
          drivingBlockReason={drivingBlockReason}
          vehicleNumber={vehicleNumber}
          onReservationCancelled={onReservationCancelled}
        />
      );

    case Screen.REFUEL_METER:
    case Screen.REFUEL_RECEIPT:
    case Screen.REFUEL_CONFIRM:
    case Screen.REFUEL_COMPLETE:
      return (
        <RefuelPage
          step={refuelStepFromScreen(screen)}
          videoRef={camera.videoRef}
          isCameraActive={camera.isCameraActive}
          meterImage={meterImage}
          setMeterImage={setMeterImage}
          receiptImage={receiptImage}
          setReceiptImage={setReceiptImage}
          isSubmitting={isSubmitting}
          startCamera={camera.startCamera}
          stopCamera={camera.stopCamera}
          capturePhoto={camera.capturePhoto}
          handleRefuelSubmit={onRefuelSubmit}
          onBackToMenu={onBackToMainMenu}
          onChangeStep={(step) => setScreen(screenFromRefuelStep(step))}
        />
      );

    case Screen.RESERVE:
      return (
        <ReservePage
          userProfile={userProfile}
          vehicleNumber={vehicleNumber}
          vehicleModel={vehicleModel}
          setVehicleNumber={setVehicleNumber}
          setVehicleModel={setVehicleModel}
          setScreen={setScreen}
          onReserved={() => {
            setHasReservation(true);
            setScreen(Screen.MAIN_MENU);
          }}
          onReservationCancelled={onReservationCancelled}
        />
      );

    case Screen.RESERVE_SCHEDULE:
      return (
        <ReservationSchedulePage
          userProfile={userProfile}
          onBackToMainMenu={onBackToMainMenu}
        />
      );

    case Screen.DRIVING_START_ALCOHOL:
    case Screen.DRIVING_START_FUEL:
    case Screen.DRIVING_START_MILEAGE:
      return (
        <DrivingStartPage
          screen={screen}
          setScreen={setScreen}
          videoRef={camera.videoRef}
          isCameraActive={camera.isCameraActive}
          alcoholCheckImage={alcoholCheckImage}
          setAlcoholCheckImage={setAlcoholCheckImage}
          startMeterImage={startMeterImage}
          setStartMeterImage={setStartMeterImage}
          startMileageImage={startMileageImage}
          setStartMileageImage={setStartMileageImage}
          startCamera={camera.startCamera}
          stopCamera={camera.stopCamera}
          capturePhoto={camera.capturePhoto}
          isSubmitting={isSubmitting}
          handleDrivingLogSubmit={onDrivingLogSubmit}
          onBackToMenu={() => {
            camera.stopCamera();
            setScreen(Screen.MAIN_MENU);
          }}
        />
      );

    case Screen.DRIVING_LOG:
      return (
        <DrivingLogPage
          userProfile={userProfile}
          onBack={() => setScreen(Screen.MAIN_MENU)}
          onReportSubmitted={() => {
            setDrivingStatus("idle");
          }}
          onRebookSubstitute={() => setScreen(Screen.RESERVE)}
          uploadToSakura={uploadToSakura}
          videoRef={camera.videoRef}
          isCameraActive={camera.isCameraActive}
          startCamera={camera.startCamera}
          stopCamera={camera.stopCamera}
          capturePhoto={camera.capturePhoto}
        />
      );

    case Screen.MILEAGE_CONFIRM:
      return (
        <MileageConfirmPage
          userProfile={userProfile}
          startMileageImageUrl={startMileageImageUrl}
          vehicleNumber={vehicleNumber}
          vehicleModel={vehicleModel}
          onBack={() => setScreen(Screen.MAIN_MENU)}
        />
      );

    case Screen.ETC_START:
    case Screen.ETC_IN_USE:
    case Screen.ETC_ARRIVED:
      return (
        <EtcPage
          screen={screen}
          setScreen={setScreen}
          setEtcStep={setEtcStep}
          handleEtcStart={onEtcStart}
          handleEtcSubmit={onEtcSubmit}
          currentTime={currentTime}
          gpsTimerRef={gpsTimerRef}
          videoRef={camera.videoRef}
          isCameraActive={camera.isCameraActive}
          startCamera={camera.startCamera}
          stopCamera={camera.stopCamera}
          capturePhoto={camera.capturePhoto}
          etcCategory={etcCategory}
          setEtcCategory={setEtcCategory}
          etcOtherReason={etcOtherReason}
          setEtcOtherReason={setEtcOtherReason}
          etcRouteStart={etcRouteStart}
          setEtcRouteStart={setEtcRouteStart}
          etcRouteEnd={etcRouteEnd}
          setEtcRouteEnd={setEtcRouteEnd}
          etcPhotos={etcPhotos}
          setEtcPhotos={setEtcPhotos}
          isSubmitting={isSubmitting}
        />
      );

    default:
      return (
        <div className="m-auto text-center p-8">
          <p className="text-text-muted">この画面は存在しません。</p>
          <button
            onClick={() => setScreen(Screen.MAIN_MENU)}
            className="mt-4 px-4 py-2 bg-slate-200 rounded-md text-sm font-bold"
          >
            メインメニューに戻る
          </button>
        </div>
      );
  }
}
