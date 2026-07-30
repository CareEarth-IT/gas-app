import { useCallback, useEffect, useState } from "react";

import { fetchCanStartDriving } from "../lib/reservations";
import type { DrivingStatus, Screen, UserProfile } from "../types";

type Options = {
  userProfile: UserProfile | null;
  hasReservation: boolean;
  drivingStatus: DrivingStatus;
  screen: Screen;
  vehicleNumber: string;
};

export function useDrivingStartEligibility({
  userProfile,
  hasReservation,
  drivingStatus,
  screen,
  vehicleNumber
}: Options) {
  const [canStartDriving, setCanStartDriving] = useState(true);
  const [drivingBlockReason, setDrivingBlockReason] = useState<string | null>(
    null
  );

  const refreshDrivingStartEligibility = useCallback(
    async (currentlyDriving?: boolean) => {
      if (!userProfile?.email) {
        setCanStartDriving(true);
        setDrivingBlockReason(null);
        return;
      }
      const isDriving =
        currentlyDriving ?? drivingStatus === "driving";
      try {
        const result = await fetchCanStartDriving(
          userProfile.email,
          isDriving,
          vehicleNumber
        );
        setCanStartDriving(result.allowed);
        setDrivingBlockReason(result.reason ?? null);
      } catch (error) {
        console.warn("運転開始可否の確認に失敗しました", error);
        setCanStartDriving(true);
        setDrivingBlockReason(null);
      }
    },
    [userProfile, drivingStatus, vehicleNumber]
  );

  useEffect(() => {
    if (!userProfile || !hasReservation) {
      setCanStartDriving(true);
      return;
    }
    void refreshDrivingStartEligibility();
  }, [
    userProfile,
    hasReservation,
    drivingStatus,
    screen,
    refreshDrivingStartEligibility
  ]);

  return {
    canStartDriving,
    drivingBlockReason,
    setCanStartDriving,
    refreshDrivingStartEligibility
  };
}
