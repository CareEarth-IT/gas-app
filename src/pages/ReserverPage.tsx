import { useEffect, useState } from "react";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import {
  getAllDayReservationEnd,
  getBookingRangeError,
  getMaxEndForStart,
  getMaxStartBookingDate,
  hasUserReservationOverlap,
  isVehicleBooked,
  toDatetimeLocalValue,
  type ActiveReservation
} from "../lib/reservationBooking";
import { ActiveReservationCard } from "../components/ActiveReservationCard";
import { StaffNameText } from "../components/StaffNameText";
import { useStaffDisplayNames } from "../hooks/useStaffDisplayNames";
import {
  completeExpiredReservations,
  createReservation,
  fetchActiveReservations,
  formatReservationEndTime
} from "../lib/reservations";
import { fetchVehicles, claimVehicleAsPersonal } from "../lib/vehicles";
import { filterVehiclesForReservation } from "../lib/vehicleVisibility";
import {
  buildVehicleUsageList,
  groupByUsageArea
} from "../lib/vehicleUsageStatus";
import {
  clearReserveDraft,
  restoreFlowMeta,
  saveFlowMeta
} from "../lib/flowPersistence";
import {
  normalizeAppPath,
  pathForScreen,
  replacePathname,
  RESERVE_FORM_PATH
} from "../lib/screenRoutes";
import { Screen, type UserProfile } from "../types";
import {
  ROUTE_START_PARKING,
  USAGE_AREAS,
  isRentalVehicleName,
  isSubstituteVehicleName
} from "../types/vehicle";
import { isLongTermReservation, toDate } from "../lib/drivingLogUtils";
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

function vehicleStatusLabel(
  entry: { inUse: boolean; isReserved: boolean; usageStatus?: string }
) {
  if (entry.usageStatus === "substitute") return "代車";
  if (entry.inUse) return "利用中";
  if (entry.isReserved) return "予約済み";
  return "空き";
}

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

  const [step, setStep] = useState<"status" | "form">("status");
  const [usageArea, setUsageArea] = useState<string>(USAGE_AREAS[0]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeReservations, setActiveReservations] = useState<ActiveReservation[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [vehicleLoadError, setVehicleLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const { nameMap } = useStaffDisplayNames(!!userProfile);

  const showPurposeField = reserveCategory === "その他";
  const bookingMin = toDatetimeLocalValue(new Date());
  const bookingStartMax = toDatetimeLocalValue(getMaxStartBookingDate());
  const bookingEndMax = reserveStart
    ? toDatetimeLocalValue(getMaxEndForStart(new Date(reserveStart)))
    : bookingStartMax;

  const getReservationStart = (): Date => new Date(reserveStart);

  const getReservationEnd = (): Date => {
    const start = getReservationStart();
    if (allDayUse) {
      return reserveEnd ? new Date(reserveEnd) : getAllDayReservationEnd(start);
    }
    return new Date(reserveEnd);
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
      getReservationEnd()
    );

  useEffect(() => {
    if (draftRestored) return;
    const draft = restoreFlowMeta().reserve;
    const pathIsForm =
      normalizeAppPath(window.location.pathname) === RESERVE_FORM_PATH;

    if (!draft) {
      if (pathIsForm) setStep("form");
      setDraftRestored(true);
      return;
    }

    setStep(pathIsForm ? "form" : draft.step);
    setUsageArea(draft.usageArea);
    setIsPersonalUse(draft.isPersonalUse);
    setIsSubstituteUse(draft.isSubstituteUse);
    setSubstituteUntil(draft.substituteUntil);
    setReserveStart(draft.reserveStart);
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
    if (!draftRestored) return;
    replacePathname(
      step === "form" ? RESERVE_FORM_PATH : pathForScreen(Screen.RESERVE)
    );
  }, [draftRestored, step]);

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

  const loadVehicleUsage = async () => {
    if (!userProfile) {
      setIsLoadingVehicles(false);
      return;
    }

    setIsLoadingVehicles(true);
    setVehicleLoadError(null);
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
      const msg =
        error instanceof Error ? error.message : "車両リストの取得に失敗しました";
      console.error("車両リストの取得に失敗しました", error);
      setVehicleLoadError(msg);
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  useEffect(() => {
    void loadVehicleUsage();
  }, [userProfile]);

  const vehicleUsageList = buildVehicleUsageList(
    vehicles.map((v) => ({
      vehicleNumber: v.vehicleNumber,
      vehicleName: v.vehicleModel,
      usageArea: v.usageArea
    })),
    activeReservations
  ).map((entry) => {
    const reservation = activeReservations.find(
      (r) => r.vehicleNumber === entry.vehicleNumber
    );
    const isSubstitute =
      vehicles.find((v) => v.vehicleNumber === entry.vehicleNumber)
        ?.isSubstitute === true ||
      reservation?.usageStatus === "substitute" ||
      isSubstituteVehicleName(entry.vehicleName) ||
      (reservation &&
        isRentalVehicleName(entry.vehicleName) &&
        isLongTermReservation(reservation));
    return {
      ...entry,
      usageStatus: isSubstitute ? "substitute" : undefined
    };
  });
  const vehicleUsageByArea = groupByUsageArea(vehicleUsageList, USAGE_AREAS);
  const selectedVehicle = vehicles.find((v) => v.vehicleNumber === vehicleNumber);

  const handleStartReserveForVehicle = (entry: {
    vehicleNumber: string;
    vehicleName: string;
    usageArea: string;
  }) => {
    if (!userProfile) return;

    const match = vehicles.find((v) => v.vehicleNumber === entry.vehicleNumber);
    const existingReservation = activeReservations.find(
      (reservation) =>
        reservation.vehicleNumber === entry.vehicleNumber &&
        reservation.usageStatus === "substitute"
    );
    setVehicleNumber(entry.vehicleNumber);
    setVehicleModel(entry.vehicleName);
    setUsageArea(entry.usageArea || usageArea);
    setIsPersonalUse(match?.isPersonal ?? false);
    setIsSubstituteUse(
      match?.isSubstitute === true ||
        !!existingReservation ||
        isSubstituteVehicleName(entry.vehicleName)
    );
    const existingSubstituteUntil =
      toDate(match?.substituteUntil) ??
      toDate(existingReservation?.substituteUntil);
    setSubstituteUntil(
      existingSubstituteUntil
        ? toDatetimeLocalValue(existingSubstituteUntil)
        : ""
    );
    setStep("form");
  };

  const handleBack = () => {
    if (step === "form") {
      setStep("status");
      return;
    }
    clearReserveDraft();
    setScreen(Screen.MAIN_MENU);
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

    const startDate = getReservationStart();
    const endDate = getReservationEnd();

    if (allDayUse && reserveEnd && endDate <= startDate) {
      alert("終了日時は開始日時より後に設定してください。");
      return;
    }

    const substituteUntilDate = substituteUntil
      ? new Date(substituteUntil)
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
      (hasUserReservationOverlap(userProfile.email, activeReservations, startDate, endDate)
        ? "この時間帯には、すでにあなたの別の予約があります。"
        : null) ??
      (isVehicleBooked(vehicleNumber, activeReservations, startDate, endDate)
        ? "選択した車両はこの時間帯にすでに予約されています。"
        : null);

    if (bookingError) {
      alert(bookingError);
      return;
    }

    if (
      isPersonalUse &&
      selectedVehicle?.isPersonal &&
      selectedVehicle.personalOwnerEmail !== userProfile.email
    ) {
      alert("この車両は他のユーザーの個人保有車です。");
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
      setStep("status");
      void loadVehicleUsage();
    } catch (error: any) {
      alert("予約失敗: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "status") {
    return (
      <div className="flex flex-col h-full bg-bg-app">
        <div className="p-4 bg-white border-b flex items-center gap-3">
          <button onClick={handleBack} className="p-2">
            <ArrowLeft />
          </button>
          <h2 className="font-bold">社用車の利用状況</h2>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <ActiveReservationCard
            userEmail={userProfile?.email}
            enabled={!!userProfile}
            onCancelled={() => {
              onReservationCancelled();
              void loadVehicleUsage();
            }}
            compact
          />

          <p className="text-sm text-text-muted mb-4 mt-4">
            現在の社用車の利用状況を確認できます。予約する車両をタップしてください。
            <span className="block text-xs mt-1">
              ※ 開始は1ヶ月先まで、終了は開始から1ヶ月以内
            </span>
          </p>

          {isLoadingVehicles ? (
            <div className="flex items-center justify-center py-12 text-text-muted">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              読み込み中...
            </div>
          ) : vehicleLoadError ? (
            <p className="text-sm text-red-500">{vehicleLoadError}</p>
          ) : vehicleUsageList.length === 0 ? (
            <p className="text-sm text-text-muted">登録されている社用車がありません。</p>
          ) : (
            <div className="space-y-5">
              {vehicleUsageByArea.map(({ area, items }) => (
                <section key={area}>
                  <h3 className="text-xs font-bold text-text-muted mb-2">{area}</h3>
                  <div className="space-y-2">
                    {items.map((entry) => (
                      <button
                        key={entry.vehicleNumber}
                        type="button"
                        onClick={() => handleStartReserveForVehicle(entry)}
                        className="w-full text-left bg-white p-3 rounded-lg border border-border-muted hover:border-accent-blue hover:bg-blue-50/40 active:scale-[0.99] transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">
                              {entry.vehicleName || entry.vehicleNumber}
                            </p>
                            {entry.vehicleName && (
                              <p className="text-xs text-text-muted mt-0.5">
                                {entry.vehicleNumber}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                              entry.usageStatus === "substitute"
                                ? "bg-purple-100 text-purple-800"
                                : entry.inUse
                                ? "bg-amber-100 text-amber-800"
                                : entry.isReserved
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {vehicleStatusLabel(entry)}
                          </span>
                        </div>
                        <p className="text-sm mt-2">
                          <span className="text-text-muted">利用者：</span>
                          <span
                            className={
                              entry.isReserved ? "font-medium inline-block" : "text-text-muted inline-block"
                            }
                          >
                            <StaffNameText
                              email={entry.userEmail}
                              nameMap={nameMap}
                              showEmailWhenNamed={entry.isReserved}
                            />
                          </span>
                        </p>
                        {entry.isReserved && entry.reservationEndTime && (
                          <p className="text-sm mt-1">
                            <span className="text-text-muted">終了：</span>
                            <span className="font-medium">
                              {formatReservationEndTime(entry.reservationEndTime)}
                            </span>
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

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
            min={bookingMin}
            max={bookingStartMax}
            onChange={(e) => setReserveStart(e.target.value)}
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
              個人保有にすると、所有者以外の予約画面には表示されません。
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
                min={reserveStart || toDatetimeLocalValue(new Date())}
                onChange={(e) => setSubstituteUntil(e.target.value)}
                className="w-full h-11 px-3 mt-1 border-2 border-purple-200 bg-white rounded-lg"
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
            min={reserveStart || bookingMin}
            max={bookingEndMax}
            onChange={(e) => setReserveEnd(e.target.value)}
            className="w-full h-12 px-4 mt-1 border-2 border-border-muted rounded-lg"
          />
          {allDayUse && (
            <p className="text-xs text-text-muted mt-1">
              終日利用でも終了日時を指定できます。未入力の場合は開始日の23:59までです。
            </p>
          )}
        </div>

        {isSelectedVehicleBooked && (
          <p className="text-xs text-red-500">
            選択した車両はこの時間帯に予約できません。時間を変更するか、戻って別の車両を選んでください。
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
