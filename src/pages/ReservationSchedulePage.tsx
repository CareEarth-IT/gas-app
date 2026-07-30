import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { ReservationScheduleList } from "../components/ReservationScheduleList";
import {
  fetchActiveReservations,
  fetchReservationSchedule,
  type UserReservation
} from "../lib/reservations";
import { fetchVehicles } from "../lib/vehicles";
import { type UserProfile } from "../types";
import { type Vehicle } from "../types/vehicle";

type Props = {
  userProfile: UserProfile | null;
  onBackToMainMenu: () => void;
  onReserveVehicle: (vehicle: {
    vehicleNumber: string;
    vehicleName: string;
    usageArea: string;
    isSubstitute: boolean;
    isPersonal: boolean;
    substituteUntil: string;
  }) => void;
};

export default function ReservationSchedulePage({
  userProfile,
  onBackToMainMenu,
  onReserveVehicle
}: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeReservations, setActiveReservations] = useState<UserReservation[]>([]);
  const [scheduleReservations, setScheduleReservations] = useState<UserReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userProfile) {
      setVehicles([]);
      setActiveReservations([]);
      setScheduleReservations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [vehicleList, activeList, scheduleList] = await Promise.all([
        fetchVehicles(),
        fetchActiveReservations(),
        fetchReservationSchedule()
      ]);
      setVehicles(vehicleList);
      setActiveReservations(activeList);
      setScheduleReservations(scheduleList);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "車両情報の取得に失敗しました";
      setError(message);
      setVehicles([]);
      setActiveReservations([]);
      setScheduleReservations([]);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-white">
      <div className="shrink-0 p-4 border-b flex items-center gap-3 bg-white">
        <button
          type="button"
          onClick={onBackToMainMenu}
          className="p-2"
          aria-label="メインメニューに戻る"
        >
          <ArrowLeft />
        </button>
        <h2 className="font-bold">社用車予約一覧</h2>
      </div>

      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {error && (
          <p className="shrink-0 mx-4 mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}

        <ReservationScheduleList
          variant="vehicleStatus"
          vehicles={vehicles}
          activeReservations={activeReservations}
          scheduleReservations={scheduleReservations}
          currentUserEmail={userProfile?.email}
          loading={loading}
          onRefresh={() => void load()}
          onSelectAvailableVehicle={onReserveVehicle}
          fillHeight
        />

        <p className="shrink-0 px-4 py-3 text-xs text-text-muted border-t border-slate-100 bg-white">
          「空き」の車両をタップすると予約できます。「予約中」は本日〜1ヶ月先の予約一覧です。
        </p>
      </div>
    </div>
  );
}
