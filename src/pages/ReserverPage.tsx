import { useEffect, useState } from "react";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import {
  getAllDayReservationEnd,
  getBookingRangeError,
  getMaxEndForStart,
  getMaxStartBookingDate,
  hasUserReservationOverlap,
  isVehicleBooked,
  normalizeBookingStart,
  parseDatetimeLocalValue,
  toDatetimeLocalValue,
  type ActiveReservation
} from "../lib/reservationBooking";
import {
  completeExpiredReservations,
  createReservation,
  fetchActiveReservations
} from "../lib/reservations";
import { fetchVehicles, claimVehicleAsPersonal } from "../lib/vehicles";
import { filterVehiclesForReservation } from "../lib/vehicleVisibility";
import {
  clearReserveDraft,
  parseReserveReturnScreen,
  restoreFlowMeta,
  saveFlowMeta
} from "../lib/flowPersistence";
import {
  pathForScreen,
  replacePathname,
  RESERVE_FORM_PATH
} from "../lib/screenRoutes";
import { Screen, type UserProfile } from "../types";
import {
  ROUTE_START_PARKING,
  USAGE_AREAS
} from "../types/vehicle";
import { toDate } from "../lib/drivingLogUtils";
import { RESERVE_CATEGORIES } from "./reserve/constants";

type Vehicle = {
  id: string;
  vehicleNumber: string;
  vehicleModel: string;
  usageArea: string;
  isPersonal: boolean;
  personalOwnerEmail: string;
  isSubstitute: boolean;
  substituteUntil: string;
};

const INITIAL_FORM = {
  reserveStart: "",
  reserveEnd: "",
  allDayUse: false,
  isSubstituteUse: false,
  substituteUntil: "",
  reserveCategory: "スタッフ送迎",
  reservePurpose: "",
  reserveRouteStart: "",
  reserveRouteEnd: ""
};

type Props = {
  userProfile: UserProfile | null;
  vehicleNumber: string;
  vehicleModel: string;
  setVehicleNumber: (value: string) => void;
  setVehicleModel: (value: string) => void;
  setScreen: (screen: Screen) => void;
  onReserved: () => void;
  onReservationCancelled: () => void;
};

export default function ReservePage({
  userProfile,
  vehicleNumber,
  vehicleModel,
  setVehicleNumber,
  setVehicleModel,
  setScreen,
  onReserved,
  onReservationCancelled
}: Props) {
  const [reserveStart, setReserveStart] = useState("");
  const [reserveEnd, setReserveEnd] = useState("");
  const [allDayUse, setAllDayUse] = useState(false);
  const [isPersonalUse, setIsPersonalUse] = useState(false);
  const [isSubstituteUse, setIsSubstituteUse] = useState(false);
  const [substituteUntil, setSubstituteUntil] = useState("");
  const [reserveCategory, setReserveCategory] = useState<string>("スタッフ送迎");
  const [reservePurpose, setReservePurpose] = useState("");
  const [reserveRouteStart, setReserveRouteStart] = useState("");
  const [reserveRouteEnd, setReserveRouteEnd] = useState("");

  const [step, setStep] = useState<"status" | "form">("form");
  const [usageArea, setUsageArea] = useState<string>(USAGE_AREAS[0]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeReservations, setActiveReservations] = useState<ActiveReservation[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const showPurposeField = reserveCategory === "その他";
  const bookingMin = toDatetimeLocalValue(new Date());
  const bookingStartMax = toDatetimeLocalValue(getMaxStartBookingDate());
  const bookingEndMax = reserveStart
    ? toDatetimeLocalValue(getMaxEndForStart(parseDatetimeLocalValue(reserveStart)))
    : bookingStartMax;
  /** 終了は開始より後のみ（datetime-local の min は開始+1分） */
  const bookingEndMin = reserveStart
    ? toDatetimeLocalValue(
        new Date(parseDatetimeLocalValue(reserveStart).getTime() + 60_000)
      )
    : bookingMin;

  const getReservationStart = (): Date => parseDatetimeLocalValue(reserveStart);

  const handleReserveStartChange = (value: string) => {
    setReserveStart(value);
    if (
      value &&
      reserveEnd &&
      parseDatetimeLocalValue(reserveEnd) <= parseDatetimeLocalValue(value)
    ) {
      setReserveEnd("");
    }
    if (
      value &&
      substituteUntil &&
      parseDatetimeLocalValue(substituteUntil) <= parseDatetimeLocalValue(value)
    ) {
      setSubstituteUntil("");
    }
  };

  const handleReserveEndChange = (value: string) => {
    if (
      value &&
      reserveStart &&
      parseDatetimeLocalValue(value) <= parseDatetimeLocalValue(reserveStart)
    ) {
      return;
    }
    setReserveEnd(value);
  };

  const getReservationEnd = (): Date => {
    const start = getReservationStart();
    if (allDayUse) {
      return reserveEnd
        ? parseDatetimeLocalValue(reserveEnd)
        : getAllDayReservationEnd(start);
    }
    return parseDatetimeLocalValue(reserveEnd);
  };

  const hasValidPeriod =
    !!reserveStart &&
    (allDayUse ||
      (!!reserveEnd && getReservationStart() < getReservationEnd()));

  const isSelectedVehicleBooked =
    hasValidPeriod &&
    !!vehicleNumber &&
    isVehicleBooked(
      vehicleNumber,
      activeReservations,
      getReservationStart(),
      getReservationEnd(),
      allDayUse
    );

  const isUserTimeConflict =
    hasValidPeriod &&
    !!userProfile?.email &&
    hasUserReservationOverlap(
      userProfile.email,
      activeReservations,
      getReservationStart(),
      getReservationEnd(),
      allDayUse
    );

  useEffect(() => {
    if (draftRestored) return;
    const draft = restoreFlowMeta().reserve;

    if (!draft) {
      setStep("form");
      setDraftRestored(true);
      return;
    }

    setStep("form");
    setUsageArea(draft.usageArea);
    setIsPersonalUse(draft.isPersonalUse);
    setIsSubstituteUse(draft.isSubstituteUse);
    setSubstituteUntil(draft.substituteUntil);
    setReserveStart(toDatetimeLocalValue(new Date()));
    setReserveEnd(draft.reserveEnd);
    setAllDayUse(draft.allDayUse);
    setReserveCategory(draft.reserveCategory);
    setReservePurpose(draft.reservePurpose);
    setReserveRouteStart(
      draft.reserveRouteStart === ROUTE_START_PARKING
        ? ""
        : draft.reserveRouteStart
    );
    setReserveRouteEnd(draft.reserveRouteEnd);
    setDraftRestored(true);
  }, [draftRestored]);

  useEffect(() => {
    if (!draftRestored || !userProfile) return;
    if (!vehicleNumber.trim()) {
      setScreen(Screen.RESERVE_SCHEDULE);
    }
  }, [draftRestored, userProfile, vehicleNumber, setScreen]);

  useEffect(() => {
    if (!draftRestored) return;
    replacePathname(
      step === "form" ? RESERVE_FORM_PATH : pathForScreen(Screen.RESERVE)
    );
  }, [draftRestored, step]);

  useEffect(() => {
    if (!draftRestored || step !== "form") return;
    setReserveStart(toDatetimeLocalValue(new Date()));
  }, [draftRestored, step]);

  useEffect(() => {
    if (!draftRestored) return;

    const syncStartToNow = () => {
      setReserveStart((current) => {
        if (!current) return current;
        const normalized = normalizeBookingStart(parseDatetimeLocalValue(current));
        const next = toDatetimeLocalValue(normalized);
        if (next === current) return current;

        setReserveEnd((endValue) => {
          if (!endValue) return endValue;
          if (parseDatetimeLocalValue(endValue) <= normalized) return "";
          return endValue;
        });
        setSubstituteUntil((untilValue) => {
          if (!untilValue) return untilValue;
          if (parseDatetimeLocalValue(untilValue) <= normalized) return "";
          return untilValue;
        });
        return next;
      });
    };

    syncStartToNow();
    const timerId = window.setInterval(syncStartToNow, 30_000);
    return () => window.clearInterval(timerId);
  }, [draftRestored]);

  useEffect(() => {
    if (!draftRestored) return;
    const meta = restoreFlowMeta();
    saveFlowMeta({
      ...meta,
      screen: Screen.RESERVE,
      reserve: {
        step,
        usageArea,
        isPersonalUse,
        isSubstituteUse,
        substituteUntil,
        reserveStart,
        reserveEnd,
        allDayUse,
        reserveCategory,
        reservePurpose,
        reserveRouteStart,
        reserveRouteEnd
      }
    });
  }, [
    draftRestored,
    step,
    usageArea,
    isPersonalUse,
    isSubstituteUse,
    substituteUntil,
    reserveStart,
    reserveEnd,
    allDayUse,
    reserveCategory,
    reservePurpose,
    reserveRouteStart,
    reserveRouteEnd
  ]);

  const loadReserveData = async () => {
    if (!userProfile) return;

    try {
      await completeExpiredReservations({
        userEmail: userProfile.email
      });

      const [list, activeList] = await Promise.all([
        fetchVehicles(),
        fetchActiveReservations()
      ]);

      setVehicles(
        filterVehiclesForReservation(list, userProfile.email).map((v) => ({
          id: v.id ?? "",
          vehicleNumber: v.vehicleNumber,
          vehicleModel: v.vehicleName,
          usageArea: v.usageArea,
          isPersonal: v.isPersonal,
          personalOwnerEmail: v.personalOwnerEmail,
          isSubstitute: v.isSubstitute === true,
          substituteUntil: v.substituteUntil ?? ""
        }))
      );
      setActiveReservations(activeList as ActiveReservation[]);
    } catch (error) {
      console.error("予約用データの取得に失敗しました", error);
    }
  };

  useEffect(() => {
    void loadReserveData();
  }, [userProfile]);

  const selectedVehicle = vehicles.find((v) => v.vehicleNumber === vehicleNumber);

  const handleBack = () => {
    const returnScreen =
      restoreFlowMeta().reserve?.returnScreen ?? Screen.RESERVE_SCHEDULE;
    clearReserveDraft();
    setScreen(parseReserveReturnScreen(returnScreen));
  };

  const handleReserveSubmit = async () => {
    if (!userProfile || !vehicleNumber || !reserveStart || !reserveRouteStart || !reserveRouteEnd) {
      alert("必須項目が入力されていません。");
      return;
    }

    if (!allDayUse && !reserveEnd) {
      alert("利用終了日時を入力してください。");
      return;
    }

    const now = new Date();
    const parsedStart = getReservationStart();
    const startDate = normalizeBookingStart(parsedStart, now);
    if (startDate.getTime() !== parsedStart.getTime()) {
      setReserveStart(toDatetimeLocalValue(startDate));
    }
    const endDate = allDayUse
      ? reserveEnd
        ? parseDatetimeLocalValue(reserveEnd)
        : getAllDayReservationEnd(startDate)
      : parseDatetimeLocalValue(reserveEnd);

    if (allDayUse && reserveEnd && endDate <= startDate) {
      alert("終了日時は開始日時より後に設定してください。");
      return;
    }

    const substituteUntilDate = substituteUntil
      ? parseDatetimeLocalValue(substituteUntil)
      : null;
    if (
      isSubstituteUse &&
      substituteUntilDate &&
      (Number.isNaN(substituteUntilDate.getTime()) ||
        substituteUntilDate <= startDate)
    ) {
      alert("代車の終了日時は利用開始日時より後に設定してください。");
      return;
    }

    if (showPurposeField && !reservePurpose.trim()) {
      alert("目的、利用した理由を入力してください。");
      return;
    }
    const bookingError =
      getBookingRangeError(startDate, endDate) ??
      (isVehicleBooked(
        vehicleNumber,
        activeReservations,
        startDate,
        endDate,
        allDayUse
      )
        ? "選択した車両はこの時間帯にすでに予約されています。"
        : userProfile?.email &&
            hasUserReservationOverlap(
              userProfile.email,
              activeReservations,
              startDate,
              endDate,
              allDayUse
            )
          ? "この時間帯には、すでにあなたの別の予約があります。時間を変更するか、先の予約が終わってからお試しください。"
          : null);

    if (bookingError) {
      alert(bookingError);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isPersonalUse && selectedVehicle?.id) {
        await claimVehicleAsPersonal(selectedVehicle.id, userProfile.email);
      }

      await createReservation({
        vehicleNumber,
        vehicleModel,
        usageArea,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        allDay: allDayUse,
        isPersonal: isPersonalUse,
        isSubstituteVehicle: isSubstituteUse,
        category: reserveCategory,
        purpose: showPurposeField ? reservePurpose.trim() : "",
        routeStart: reserveRouteStart,
        routeEnd: reserveRouteEnd,
        ...(isSubstituteUse
          ? {
              usageStatus: "substitute",
              ...(substituteUntilDate
                ? { substituteUntil: substituteUntilDate.toISOString() }
                : {})
            }
          : {})
      });

      alert(
        allDayUse
          ? `${vehicleNumber}の終日利用予約が完了しました！`
          : `${vehicleNumber}の予約が完了しました！`
      );

      onReserved();
      clearReserveDraft();
      setReserveStart(INITIAL_FORM.reserveStart);
      setReserveEnd(INITIAL_FORM.reserveEnd);
      setAllDayUse(INITIAL_FORM.allDayUse);
      setIsPersonalUse(false);
      setIsSubstituteUse(INITIAL_FORM.isSubstituteUse);
      setSubstituteUntil(INITIAL_FORM.substituteUntil);
      setReserveCategory(INITIAL_FORM.reserveCategory);
      setReservePurpose(INITIAL_FORM.reservePurpose);
      setReserveRouteStart(INITIAL_FORM.reserveRouteStart);
      setReserveRouteEnd(INITIAL_FORM.reserveRouteEnd);
    } catch (error: any) {
      alert("予約失敗: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-app">
      <div className="p-4 bg-white border-b flex items-center gap-3">
        <button onClick={handleBack} className="p-2">
          <ArrowLeft />
        </button>

        <div>
          <h2 className="font-bold">車両の予約</h2>
          {vehicleNumber ? (
            <p className="text-xs text-text-muted">
              {vehicleModel
                ? `${vehicleModel}（${vehicleNumber}）`
                : vehicleNumber}
            </p>
          ) : (
            <p className="text-xs text-text-muted">利用エリア：{usageArea}</p>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4 flex-1 overflow-y-auto">
        <div>
          <label className="text-sm font-bold text-text-muted">利用開始</label>
          <input
            type="datetime-local"
            value={reserveStart}
            max={bookingStartMax}
            onChange={(e) => handleReserveStartChange(e.target.value)}
            className="w-full h-12 px-4 mt-1 border-2 border-border-muted rounded-lg"
          />
          <p className="text-xs text-text-muted mt-1">
            開始は1ヶ月先まで、終了は開始から1ヶ月以内
          </p>
          <label className="inline-flex items-center gap-2 mt-3 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={allDayUse}
              onChange={(e) => setAllDayUse(e.target.checked)}
              className="w-4 h-4 shrink-0 accent-accent-blue"
            />
            <span className="text-sm font-medium">終日利用</span>
          </label>
          <label className="inline-flex items-center gap-2 mt-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={isPersonalUse}
              onChange={(e) => setIsPersonalUse(e.target.checked)}
              className="w-4 h-4 shrink-0 accent-accent-blue"
            />
            <span className="text-sm font-medium">個人保有</span>
          </label>
          <label className="inline-flex items-center gap-2 mt-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={isSubstituteUse}
              onChange={(e) => {
                setIsSubstituteUse(e.target.checked);
                if (!e.target.checked) setSubstituteUntil("");
              }}
              className="w-4 h-4 shrink-0 accent-accent-blue"
            />
            <span className="text-sm font-medium">代車</span>
          </label>
          {isPersonalUse && (
            <p className="text-xs text-text-muted mt-2">
              個人保有として所有者メールを登録します。予約・利用は他の人も可能です。
            </p>
          )}
          {isSubstituteUse && (
            <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3">
              <label className="text-xs font-bold text-purple-900">
                代車の終了予定日時（分かる場合）
              </label>
              <input
                type="datetime-local"
                value={substituteUntil}
                min={bookingEndMin}
                disabled={!reserveStart}
                onChange={(e) => {
                  const value = e.target.value;
                  if (
                    value &&
                    reserveStart &&
                    parseDatetimeLocalValue(value) <=
                      parseDatetimeLocalValue(reserveStart)
                  ) {
                    return;
                  }
                  setSubstituteUntil(value);
                }}
                className="w-full h-11 px-3 mt-1 border-2 border-purple-200 bg-white rounded-lg disabled:opacity-50"
              />
              <p className="text-xs text-purple-700 mt-1">
                故障・修理などで代車を使用する期間が未定の場合は、空欄でも登録できます。
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-bold text-text-muted">利用終了</label>
          <input
            type="datetime-local"
            value={reserveEnd}
            min={bookingEndMin}
            max={bookingEndMax}
            disabled={!reserveStart}
            onChange={(e) => handleReserveEndChange(e.target.value)}
            className="w-full h-12 px-4 mt-1 border-2 border-border-muted rounded-lg disabled:opacity-50 disabled:bg-slate-50"
          />
          {!reserveStart ? (
            <p className="text-xs text-text-muted mt-1">
              先に利用開始を選択してください。終了は開始より後のみ選べます。
            </p>
          ) : allDayUse ? (
            <p className="text-xs text-text-muted mt-1">
              終日利用でも終了日時を指定できます。未入力の場合は開始日の23:59までです。
            </p>
          ) : (
            <p className="text-xs text-text-muted mt-1">
              終了は開始日時より後のみ選択できます。
            </p>
          )}
        </div>

        {isSelectedVehicleBooked && (
          <p className="text-xs text-red-500">
            選択した車両はこの時間帯に予約できません。時間を変更するか、戻って別の車両を選んでください。
          </p>
        )}

        {isUserTimeConflict && !isSelectedVehicleBooked && (
          <p className="text-xs text-red-500">
            この時間帯には、すでにあなたの別の予約があります。時間を変更するか、先の予約が終わってからお試しください。
          </p>
        )}

        <div>
          <label className="text-sm font-bold text-text-muted">利用目的</label>
          <div className="mt-2 space-y-2 bg-white p-3 rounded-lg border border-border-muted">
            {RESERVE_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex items-center gap-3 cursor-pointer"
              >
                <div
                  className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                    reserveCategory === cat
                      ? "border-accent-blue bg-white"
                      : "border-border-muted bg-white"
                  }`}
                >
                  {reserveCategory === cat && (
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
                  )}
                </div>
                <span className="text-sm font-medium">{cat}</span>
                <input
                  type="radio"
                  className="sr-only"
                  name="reserveCategory"
                  value={cat}
                  checked={reserveCategory === cat}
                  onChange={() => {
                    setReserveCategory(cat);
                    if (cat !== "その他") setReservePurpose("");
                    // 旧「駐車場から」自動入力の残存をクリア
                    setReserveRouteStart((prev) =>
                      prev === ROUTE_START_PARKING ? "" : prev
                    );
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        {showPurposeField && (
          <div>
            <label className="text-sm font-bold text-text-muted">
              目的、利用した理由
            </label>
            <input
              type="text"
              value={reservePurpose}
              onChange={(e) => setReservePurpose(e.target.value)}
              placeholder="例：〇〇様宅 打ち合わせ"
              className="w-full h-12 px-4 mt-1 border-2 border-border-muted rounded-lg"
            />
          </div>
        )}

        <div>
          <label className="text-sm font-bold text-text-muted">利用区間</label>
          <div className="flex w-full min-w-0 items-center gap-2 mt-1">
            <input
              type="text"
              value={reserveRouteStart}
              onChange={(e) => setReserveRouteStart(e.target.value)}
              placeholder="出発場所"
              className="min-w-0 flex-1 h-12 px-4 border-2 border-border-muted rounded-lg"
            />
            <ArrowRight className="w-5 h-5 shrink-0 text-text-muted" />
            <input
              type="text"
              value={reserveRouteEnd}
              onChange={(e) => setReserveRouteEnd(e.target.value)}
              placeholder="到着場所"
              className="min-w-0 flex-1 h-12 px-4 border-2 border-border-muted rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t bg-white">
        <button
          onClick={handleReserveSubmit}
          disabled={
            isSubmitting ||
            !reserveStart ||
            (!allDayUse && !reserveEnd) ||
            !vehicleNumber ||
            isSelectedVehicleBooked ||
            isUserTimeConflict ||
            (showPurposeField && !reservePurpose.trim()) ||
            !reserveRouteStart ||
            !reserveRouteEnd
          }
          className="w-full py-3 bg-accent-blue text-white font-bold text-lg rounded-lg disabled:opacity-40 flex justify-center items-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
          予約を確定する
        </button>
      </div>
    </div>
  );
}
