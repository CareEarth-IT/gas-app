import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { ReservationScheduleList } from "../components/ReservationScheduleList";
import {
  fetchReservationSchedule,
  type UserReservation
} from "../lib/reservations";
import { type UserProfile } from "../types";

type Props = {
  userProfile: UserProfile | null;
  onBackToMainMenu: () => void;
};

export default function ReservationSchedulePage({
  userProfile,
  onBackToMainMenu
}: Props) {
  const [reservations, setReservations] = useState<UserReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userProfile) {
      setReservations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const list = await fetchReservationSchedule();
      setReservations(list);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "予約一覧の取得に失敗しました";
      setError(message);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col h-full bg-bg-app">
      <div className="p-4 bg-white border-b flex items-center gap-3">
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

      <div className="p-4 flex-1 overflow-y-auto">
        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}

        <ReservationScheduleList
          reservations={reservations}
          loading={loading}
          onRefresh={() => void load()}
          currentUserEmail={userProfile?.email}
        />

        <p className="text-xs text-text-muted mt-4">
          予約の新規登録は「車の利用予約」から行えます。
        </p>
      </div>
    </div>
  );
}
