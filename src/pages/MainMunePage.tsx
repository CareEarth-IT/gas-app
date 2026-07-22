import { ActiveReservationCard } from "../components/ActiveReservationCard";
import { MainMenuDrivingSection } from "../components/MainMenuDrivingSection";
import { MenuButton } from "../components/MenuButton";
import { Screen, EtcStep, DrivingStatus, type UserProfile } from "../types";
import { MAIN_MENU_ITEMS } from "./mainMenu/menuItems";

type Props = {
  userProfile: UserProfile | null;
  drivingStatus: DrivingStatus;
  setScreen: (screen: Screen) => void;
  setEtcStep: (step: EtcStep) => void;
  startCamera: () => void;
  onEndDriving: () => void;
  hasReservation: boolean;
  canStartDriving: boolean;
  drivingBlockReason: string | null;
  vehicleNumber: string;
  onReservationCancelled: () => void;
};

export default function MainMenuPage({
  userProfile,
  drivingStatus,
  setScreen,
  setEtcStep,
  startCamera,
  onEndDriving,
  hasReservation,
  canStartDriving,
  drivingBlockReason,
  vehicleNumber,
  onReservationCancelled
}: Props) {
  const menuContext = { setScreen, setEtcStep, startCamera };
  const showDrivingFeatures =
    hasReservation || drivingStatus !== "idle";
  const showReserveNavigation =
    drivingStatus === "idle" && !showDrivingFeatures;

  return (
    <div
      className={`p-6 bg-bg-app flex-1 overflow-y-auto ${
        showReserveNavigation ? "flex items-center justify-center" : ""
      }`}
    >
      <div
        className={`w-full ${
          showReserveNavigation ? "max-w-sm space-y-3" : "space-y-3"
        }`}
      >
        {drivingStatus === "idle" && userProfile && (
          <ActiveReservationCard
            userEmail={userProfile.email}
            enabled
            onCancelled={onReservationCancelled}
          />
        )}

        {showDrivingFeatures && (
          <MainMenuDrivingSection
            drivingStatus={drivingStatus}
            canStartDriving={canStartDriving}
            drivingBlockReason={drivingBlockReason}
            vehicleNumber={vehicleNumber}
            setScreen={setScreen}
            onEndDriving={onEndDriving}
          />
        )}

        {showDrivingFeatures && (
          <>
            <MenuButton
              icon={MAIN_MENU_ITEMS.refuel.icon}
              title={MAIN_MENU_ITEMS.refuel.title}
              description={MAIN_MENU_ITEMS.refuel.description}
              onClick={() => MAIN_MENU_ITEMS.refuel.onClick(menuContext)}
            />
            <MenuButton
              icon={MAIN_MENU_ITEMS.etc.icon}
              title={MAIN_MENU_ITEMS.etc.title}
              description={MAIN_MENU_ITEMS.etc.description}
              onClick={() => MAIN_MENU_ITEMS.etc.onClick(menuContext)}
            />
            {drivingStatus === "driving" && (
              <MenuButton
                icon={MAIN_MENU_ITEMS.mileageConfirm.icon}
                title={MAIN_MENU_ITEMS.mileageConfirm.title}
                description={MAIN_MENU_ITEMS.mileageConfirm.description}
                onClick={() =>
                  MAIN_MENU_ITEMS.mileageConfirm.onClick(menuContext)
                }
              />
            )}
          </>
        )}

        {showReserveNavigation && (
          <>
            <p className="text-sm text-text-muted text-center mb-1">
              予約がない場合は、こちらから社用車を予約できます。
            </p>
            <MenuButton
              icon={MAIN_MENU_ITEMS.reserve.icon}
              title={MAIN_MENU_ITEMS.reserve.title}
              description={MAIN_MENU_ITEMS.reserve.description}
              onClick={() => MAIN_MENU_ITEMS.reserve.onClick(menuContext)}
            />
            <MenuButton
              icon={MAIN_MENU_ITEMS.reserveSchedule.icon}
              title={MAIN_MENU_ITEMS.reserveSchedule.title}
              description={MAIN_MENU_ITEMS.reserveSchedule.description}
              onClick={() =>
                MAIN_MENU_ITEMS.reserveSchedule.onClick(menuContext)
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
