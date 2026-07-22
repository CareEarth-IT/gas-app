import { useCallback, useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";

import {
  cancelReservation,
  fetchUserReservationsForUser,
  formatReservationPeriod,
  type UserReservation
} from "../lib/reservations";

type Props = {
  userEmail: string | undefined;
  enabled: boolean;
  onCancelled: () => void;
  compact?: boolean;
};

export function ActiveReservationCard({
  userEmail,
  enabled,
  onCancelled,
  compact = false
}: Props) {
  const [reservations, setReservations] = useState<UserReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userEmail || !enabled) {
      setReservations([]);
      return;
    }

    setLoading(true);
    try {
      const list = await fetchUserReservationsForUser(userEmail);
      setReservations(list);
    } catch (error) {
      console.error("予約情報の取得に失敗しました", error);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [userEmail, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = async (reservation: UserReservation) => {
    const label =
      reservation.vehicleModel || reservation.vehicleNumber || "社用車";
    if (
      !confirm(
        `${label}の予約（${formatReservationPeriod(reservation)}）をキャンセルしますか？`
      )
    ) {
      return;
    }

    setCancellingId(reservation.id);
    try {
      await cancelReservation(reservation.id);
      await load();
      onCancelled();
      alert("予約をキャンセルしました。");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "キャンセルに失敗しました";
      alert("キャンセルに失敗しました: " + message);
    } finally {
      setCancellingId(null);
    }
  };

  if (!enabled || (!loading && reservations.length === 0)) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        予約を確認中...
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg border border-accent-blue/30 shadow-sm ${
        compact ? "p-3 space-y-3" : "p-4 space-y-4"
      }`}
    >
      <p className="text-xs font-bold text-accent-blue">
        あなたの予約（{reservations.length}件）
      </p>

      {reservations.map((reservation) => {
        const vehicleLabel =
          reservation.vehicleModel && reservation.vehicleNumber
            ? `${reservation.vehicleModel}（${reservation.vehicleNumber}）`
            : reservation.vehicleModel ||
              reservation.vehicleNumber ||
              "社用車";

        return (
          <div
            key={reservation.id}
            className={`border border-slate-100 rounded-lg ${
              compact ? "p-2.5" : "p-3"
            }`}
          >
            <p
              className={`font-bold text-slate-800 ${
                compact ? "text-sm" : "text-base"
              }`}
            >
              {vehicleLabel}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {formatReservationPeriod(reservation)}
            </p>
            {reservation.usageArea && (
              <p className="text-xs text-text-muted">
                利用エリア：{reservation.usageArea}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleCancel(reservation)}
              disabled={cancellingId === reservation.id}
              className="mt-2 w-full py-2 border-2 border-red-300 text-red-600 font-bold text-xs rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {cancellingId === reservation.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              予約をキャンセル
            </button>
          </div>
        );
      })}
    </div>
  );
}
