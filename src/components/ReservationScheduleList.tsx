import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { useStaffDisplayNames } from "../hooks/useStaffDisplayNames";
import { getStaffDisplayName } from "../lib/staffNames";
import { toDate, type ReservationLike } from "../lib/drivingLogUtils";
import {
  buildVehicleUsageList,
  type VehicleUsageEntry
} from "../lib/vehicleUsageStatus";
import { getMaxStartBookingDate } from "../lib/reservationBooking";
import { USAGE_AREAS, type Vehicle } from "../types/vehicle";

export type ReservationScheduleItem = ReservationLike & { id: string };

function formatDate(value: unknown): string {
  const date = toDate(value as Parameters<typeof toDate>[0]);
  if (!date) return "—";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

function formatTime(value: unknown): string {
  const date = toDate(value as Parameters<typeof toDate>[0]);
  if (!date) return "—";
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatShortDate(value: unknown): string {
  const date = toDate(value as Parameters<typeof toDate>[0]);
  if (!date) return "—";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 終了予定: 開始日と同日なら時刻のみ、別日なら月/日＋時刻（例: 8/5 9:00） */
function formatEndTime(startValue: unknown, endValue: unknown): string {
  const start = toDate(startValue as Parameters<typeof toDate>[0]);
  const end = toDate(endValue as Parameters<typeof toDate>[0]);
  if (!end) return "—";

  const time = formatTime(end);
  if (!start || sameCalendarDay(start, end)) return time;

  return `${formatShortDate(end)} ${time}`;
}

function displayCell(value: unknown): string {
  if (value == null || value === "") return "";
  return String(value);
}

function remarksText(row: ReservationScheduleItem): string {
  const purpose = row.purpose?.trim();
  const remarks = row.remarks?.trim();
  if (remarks) return remarks;
  if (purpose) return purpose;
  const routeStart = row.routeStart?.trim();
  const routeEnd = row.routeEnd?.trim();
  if (routeStart || routeEnd) {
    return `${routeStart || "—"} → ${routeEnd || "—"}`;
  }
  return "";
}

/** スプレッドシートの「内容」列に近い色分け */
function categoryClass(category: string): string {
  const normalized = category.trim();
  const map: Record<string, string> = {
    訪問: "bg-emerald-400 text-white",
    アポ: "bg-yellow-300 text-slate-900",
    給料渡し: "bg-sky-400 text-white",
    送迎: "bg-red-400 text-white",
    スタッフ送迎: "bg-red-400 text-white",
    商談: "bg-yellow-300 text-slate-900",
    クレーム対応: "bg-orange-400 text-white",
    その他: "bg-slate-300 text-slate-800"
  };
  return map[normalized] ?? "bg-slate-200 text-slate-800";
}

function sortByStartTime(items: ReservationScheduleItem[]): ReservationScheduleItem[] {
  return [...items].sort((a, b) => {
    const aTime = toDate(a.startTime)?.getTime() ?? 0;
    const bTime = toDate(b.startTime)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

function buildAreaOptions(
  reservations: ReservationScheduleItem[],
  vehicles?: Vehicle[]
): string[] {
  const extras = new Set<string>();
  reservations.forEach((row) => {
    if (row.usageArea?.trim()) extras.add(row.usageArea.trim());
  });
  vehicles?.forEach((vehicle) => {
    if (vehicle.usageArea?.trim()) extras.add(vehicle.usageArea.trim());
  });
  return [
    ...USAGE_AREAS,
    ...[...extras].filter(
      (area) => !USAGE_AREAS.includes(area as (typeof USAGE_AREAS)[number])
    )
  ];
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function reservationOverlapsDate(
  row: ReservationScheduleItem,
  dateKey: string
): boolean {
  if (dateKey === "all") return true;
  if (row.status === "completed") return false;
  if (row.status && row.status !== "active") return false;

  const start = toDate(row.startTime);
  const end = toDate(row.endTime);
  if (!start || !end) return false;

  const [y, m, d] = dateKey.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEndExclusive = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  // 予約区間 [start, end) と日付 [dayStart, dayEndExclusive) の重なり
  return start < dayEndExclusive && end > dayStart;
}

function reservationsForVehicleOnDate(
  vehicleNumber: string,
  reservations: ReservationScheduleItem[],
  dateKey: string
): ReservationScheduleItem[] {
  return reservations.filter(
    (row) =>
      row.vehicleNumber === vehicleNumber &&
      reservationOverlapsDate(row, dateKey)
  );
}

function isVehicleAvailableOnDate(
  vehicleNumber: string,
  reservations: ReservationScheduleItem[],
  dateKey: string
): boolean {
  if (dateKey === "all") return true;
  return reservationsForVehicleOnDate(vehicleNumber, reservations, dateKey).length === 0;
}

function buildAvailableRowsForDate(
  vehicles: Vehicle[],
  reservations: ReservationScheduleItem[],
  dateKey: string
): Array<
  VehicleUsageEntry & {
    isSubstitute: boolean;
    isPersonal: boolean;
    substituteUntil: string;
  }
> {
  return vehicles
    .filter((vehicle) =>
      isVehicleAvailableOnDate(vehicle.vehicleNumber, reservations, dateKey)
    )
    .map((vehicle) => ({
      vehicleNumber: vehicle.vehicleNumber,
      vehicleName: vehicle.vehicleName,
      usageArea: vehicle.usageArea,
      userEmail: null,
      inUse: false,
      isReserved: false,
      reservationEndTime: null,
      isSubstitute: vehicle.isSubstitute === true,
      isPersonal: vehicle.isPersonal === true,
      substituteUntil: vehicle.substituteUntil ?? ""
    }));
}

function buildVehicleTypeOptions(
  reservations: ReservationScheduleItem[],
  vehicles?: Vehicle[]
): string[] {
  const names = new Set<string>();

  vehicles?.forEach((vehicle) => {
    if (vehicle.vehicleName.trim()) names.add(vehicle.vehicleName.trim());
  });
  reservations.forEach((row) => {
    const name = row.vehicleModel?.trim() || row.vehicleNumber?.trim();
    if (name) names.add(name);
  });

  return [...names].sort((a, b) => a.localeCompare(b, "ja"));
}

function matchesReservationVehicle(
  row: ReservationScheduleItem,
  vehicleFilter: string
): boolean {
  if (vehicleFilter === "all") return true;
  const label = row.vehicleModel?.trim() || row.vehicleNumber?.trim() || "";
  return label === vehicleFilter;
}

function sortAvailableEntries(
  entries: Array<VehicleUsageEntry & { isSubstitute: boolean }>
): Array<VehicleUsageEntry & { isSubstitute: boolean }> {
  return [...entries].sort((a, b) => {
    const aIdx = USAGE_AREAS.indexOf(a.usageArea as (typeof USAGE_AREAS)[number]);
    const bIdx = USAGE_AREAS.indexOf(b.usageArea as (typeof USAGE_AREAS)[number]);
    const aOrder = aIdx >= 0 ? aIdx : 999;
    const bOrder = bIdx >= 0 ? bIdx : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.vehicleName.localeCompare(b.vehicleName, "ja");
  });
}

function availableStatusLabel(entry: VehicleUsageEntry & { isSubstitute: boolean }): string {
  if (entry.isSubstitute) return "代車";
  if (entry.isReserved) return "予約済み";
  return "空き";
}

function availableStatusClass(entry: VehicleUsageEntry & { isSubstitute: boolean }): string {
  if (entry.isSubstitute) return "bg-purple-100 text-purple-800";
  if (entry.isReserved) return "bg-blue-100 text-blue-800";
  return "bg-emerald-100 text-emerald-800";
}

type BaseProps = {
  loading?: boolean;
  onRefresh?: () => void;
  showAreaFilter?: boolean;
  /** 親の flex レイアウト内で縦方向いっぱいに広げる */
  fillHeight?: boolean;
  /** @deprecated 表形式表示のため未使用（互換のため残す） */
  groupByArea?: boolean;
};

type ReservationsProps = BaseProps & {
  variant?: "reservations";
  reservations: ReservationScheduleItem[];
  currentUserEmail?: string | null;
};

type AvailableProps = BaseProps & {
  variant: "available";
  reservations: ReservationScheduleItem[];
  vehicles: Vehicle[];
};

type VehicleStatusProps = BaseProps & {
  variant: "vehicleStatus";
  /** 空き状況判定用（有効な予約） */
  activeReservations: ReservationScheduleItem[];
  /** 予約一覧タブ用（本日〜1ヶ月） */
  scheduleReservations: ReservationScheduleItem[];
  vehicles: Vehicle[];
  currentUserEmail?: string | null;
  onSelectAvailableVehicle?: (vehicle: {
    vehicleNumber: string;
    vehicleName: string;
    usageArea: string;
    isSubstitute: boolean;
    isPersonal: boolean;
    substituteUntil: string;
  }) => void;
};

type Props = ReservationsProps | AvailableProps | VehicleStatusProps;

type VehicleStatusTab = "available" | "reserved";

const STICKY_TABLE_HEAD_CELL =
  "sticky top-0 z-10 bg-slate-50 px-1 py-1.5 md:px-2 md:py-2 text-left text-[10px] md:text-xs font-bold text-slate-700 leading-tight whitespace-normal md:whitespace-nowrap border-b border-slate-300";

const TABLE_BODY_CELL =
  "px-1 py-1 md:px-2 md:py-1.5 text-[10px] md:text-sm leading-tight border-r border-slate-200 align-top";

const TABLE_BODY_CELL_WRAP = `${TABLE_BODY_CELL} whitespace-normal break-words`;

function ReservationTable({
  rows,
  currentUserEmail,
  nameMap
}: {
  rows: ReservationScheduleItem[];
  currentUserEmail?: string | null;
  nameMap: Map<string, string>;
}) {
  const normalizedEmail = currentUserEmail?.trim().toLowerCase() ?? "";

  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-[10px] md:text-sm">
      <colgroup>
        <col className="w-[12%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
        <col className="w-[18%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
      </colgroup>
      <thead>
        <tr>
          <th className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200`}>
            日付
          </th>
          <th className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200`}>
            開始時間
          </th>
          <th className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200`}>
            終了予定
          </th>
          <th className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200`}>
            車種
          </th>
          <th
            className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200 md:min-w-[5.5rem]`}
          >
            内容
          </th>
          <th className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200`}>
            利用者
          </th>
          <th className={STICKY_TABLE_HEAD_CELL}>目的地</th>
        </tr>
      </thead>
        <tbody>
          {rows.map((row) => {
            const isMine =
              normalizedEmail !== "" &&
              row.email?.trim().toLowerCase() === normalizedEmail;
            const category = displayCell(row.category) || "—";
            const userLabel =
              getStaffDisplayName(row.email, nameMap) ||
              row.email?.split("@")[0] ||
              "—";
            const vehicleLabel =
              displayCell(row.vehicleModel) ||
              displayCell(row.vehicleNumber) ||
              "—";
            const note = remarksText(row);

            return (
              <tr
                key={row.id}
                className={`border-b border-slate-200 ${
                  isMine ? "bg-blue-50/70" : "bg-white hover:bg-slate-50/80"
                }`}
              >
                <td className={`${TABLE_BODY_CELL} bg-cyan-100/90 text-slate-800`}>
                  {formatShortDate(row.startTime)}
                </td>
                <td className={TABLE_BODY_CELL}>{formatTime(row.startTime)}</td>
                <td className={TABLE_BODY_CELL_WRAP}>
                  {formatEndTime(row.startTime, row.endTime)}
                </td>
                <td className={`${TABLE_BODY_CELL_WRAP} font-medium`}>
                  {vehicleLabel}
                  {row.usageStatus === "substitute" && (
                    <span className="ml-0.5 text-[9px] font-bold text-purple-700 md:ml-1 md:text-[10px]">
                      代
                    </span>
                  )}
                </td>
                <td className="p-0 border-r border-slate-200 align-top">
                  <span
                    className={`block px-0.5 py-1 md:px-2 md:py-1.5 text-[9px] md:text-xs font-bold text-center leading-tight whitespace-normal break-words ${categoryClass(category)}`}
                  >
                    {category}
                  </span>
                </td>
                <td className={TABLE_BODY_CELL_WRAP}>{userLabel}</td>
                <td className={`${TABLE_BODY_CELL_WRAP} text-slate-700`}>
                  {note || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
  );
}

function AvailableVehicleTable({
  rows,
  onSelect
}: {
  rows: Array<
    VehicleUsageEntry & {
      isSubstitute: boolean;
      isPersonal: boolean;
      substituteUntil: string;
    }
  >;
  onSelect?: (row: (typeof rows)[number]) => void;
}) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-[10px] md:text-sm">
      <colgroup>
        <col className="w-[14%]" />
        <col className="w-[22%]" />
        <col className="w-[40%]" />
        <col className="w-[24%]" />
      </colgroup>
      <thead>
        <tr>
          <th className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200`}>
            利用エリア
          </th>
          <th className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200`}>
            車種
          </th>
          <th className={`${STICKY_TABLE_HEAD_CELL} border-r border-slate-200`}>
            ナンバー
          </th>
          <th className={STICKY_TABLE_HEAD_CELL}>状態</th>
        </tr>
      </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.vehicleNumber}
              onClick={onSelect ? () => onSelect(row) : undefined}
              className={`border-b border-slate-200 bg-white ${
                onSelect
                  ? "cursor-pointer hover:bg-blue-50/60 active:bg-blue-50"
                  : "hover:bg-slate-50/80"
              }`}
            >
              <td className={`${TABLE_BODY_CELL} bg-cyan-100/90 text-slate-800`}>
                {row.usageArea || "—"}
              </td>
              <td className={`${TABLE_BODY_CELL_WRAP} font-medium`}>
                {row.vehicleName || "—"}
                {row.isSubstitute && (
                  <span className="ml-0.5 text-[9px] font-bold text-purple-700 md:ml-1 md:text-[10px]">
                    代
                  </span>
                )}
              </td>
              <td className={`${TABLE_BODY_CELL_WRAP} text-[9px] md:text-sm`}>
                {row.vehicleNumber || "—"}
              </td>
              <td className="p-0 align-top">
                <span
                  className={`block px-0.5 py-1 md:px-2 md:py-1.5 text-[9px] md:text-xs font-bold text-center leading-tight whitespace-normal ${availableStatusClass(row)}`}
                >
                  {availableStatusLabel(row)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
  );
}

export function ReservationScheduleList(props: Props) {
  const {
    loading = false,
    onRefresh,
    showAreaFilter = true,
    fillHeight = false
  } = props;
  const variant = props.variant ?? "reservations";
  const isVehicleStatus = variant === "vehicleStatus";
  const isAvailableOnly = variant === "available";

  const reservations =
    variant === "vehicleStatus"
      ? props.scheduleReservations
      : props.reservations;
  const activeReservations =
    variant === "vehicleStatus" ? props.activeReservations : props.reservations;
  const currentUserEmail =
    variant === "reservations" || variant === "vehicleStatus"
      ? props.currentUserEmail
      : undefined;
  const vehicles =
    variant === "available" || variant === "vehicleStatus"
      ? props.vehicles
      : undefined;
  const onSelectAvailableVehicle =
    variant === "vehicleStatus" ? props.onSelectAvailableVehicle : undefined;
  const scheduleForDateFilter =
    variant === "vehicleStatus" ? props.scheduleReservations : reservations;

  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [statusTab, setStatusTab] = useState<VehicleStatusTab>("available");
  const { nameMap } = useStaffDisplayNames(true);

  const areaOptions = useMemo(
    () => buildAreaOptions(reservations, vehicles),
    [reservations, vehicles]
  );

  const vehicleTypeOptions = useMemo(
    () => buildVehicleTypeOptions(reservations, vehicles),
    [reservations, vehicles]
  );

  const datePickerMin = toDateKey(new Date());
  const datePickerMax = toDateKey(getMaxStartBookingDate());

  const filteredRows = useMemo(() => {
    const sorted = sortByStartTime(reservations);
    return sorted.filter((row) => {
      if (areaFilter !== "all" && row.usageArea !== areaFilter) return false;
      if (!reservationOverlapsDate(row, dateFilter)) return false;
      if (!matchesReservationVehicle(row, vehicleFilter)) return false;
      return true;
    });
  }, [reservations, areaFilter, dateFilter, vehicleFilter]);

  const availableRows = useMemo(() => {
    if ((!isAvailableOnly && !isVehicleStatus) || !vehicles) return [];

    const usageList =
      dateFilter === "all"
        ? buildVehicleUsageList(
            vehicles.map((vehicle) => ({
              vehicleNumber: vehicle.vehicleNumber,
              vehicleName: vehicle.vehicleName,
              usageArea: vehicle.usageArea
            })),
            activeReservations
          )
            .filter((entry) => !entry.inUse && !entry.isReserved)
            .map((entry) => {
              const vehicle = vehicles.find(
                (item) => item.vehicleNumber === entry.vehicleNumber
              );
              return {
                ...entry,
                isSubstitute: vehicle?.isSubstitute === true,
                isPersonal: vehicle?.isPersonal === true,
                substituteUntil: vehicle?.substituteUntil ?? ""
              };
            })
        : buildAvailableRowsForDate(
            vehicles,
            scheduleForDateFilter,
            dateFilter
          );

    return sortAvailableEntries(
      usageList.filter((entry) => {
        if (areaFilter !== "all" && entry.usageArea !== areaFilter) return false;
        if (vehicleFilter !== "all" && entry.vehicleName !== vehicleFilter) {
          return false;
        }
        return true;
      })
    );
  }, [
    isAvailableOnly,
    isVehicleStatus,
    vehicles,
    activeReservations,
    scheduleForDateFilter,
    areaFilter,
    dateFilter,
    vehicleFilter
  ]);

  const activeStatusTab = isVehicleStatus ? statusTab : isAvailableOnly ? "available" : "reserved";
  const displayCount =
    activeStatusTab === "available" ? availableRows.length : filteredRows.length;
  const listTitle =
    variant === "reservations"
      ? `予約一覧（${displayCount}件）`
      : activeStatusTab === "available"
        ? `今使える車種（${displayCount}件）`
        : `予約中の車種（${displayCount}件）`;

  return (
    <section
      className={`flex flex-col min-h-0 overflow-hidden bg-white ${
        fillHeight
          ? "flex-1 rounded-none border-0 shadow-none"
          : "mb-6 rounded-lg border border-border-muted shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-2 py-2 md:gap-3 md:px-4 md:py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3 min-w-0">
          {isVehicleStatus && (
            <div className="flex shrink-0 rounded-md border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setStatusTab("available")}
                className={`px-2.5 py-1 text-xs font-bold rounded ${
                  statusTab === "available"
                    ? "bg-accent-blue text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                空き
              </button>
              <button
                type="button"
                onClick={() => setStatusTab("reserved")}
                className={`px-2.5 py-1 text-xs font-bold rounded ${
                  statusTab === "reserved"
                    ? "bg-accent-blue text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                予約中
              </button>
            </div>
          )}
          <h3 className="text-xs md:text-sm font-bold text-slate-800 truncate">{listTitle}</h3>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-accent-blue disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            更新
          </button>
        )}
      </div>

      {showAreaFilter && (
        <div className="px-2 py-2 md:px-4 md:py-3 border-b border-slate-100 bg-white grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
          <div className="flex items-center gap-1.5 min-w-0 sm:min-w-[10rem]">
            <label className="text-[10px] md:text-xs font-bold text-text-muted whitespace-nowrap shrink-0">
              利用エリア
            </label>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="flex-1 min-w-0 text-xs md:text-sm border border-border-muted rounded-md px-1.5 py-1 md:px-2 md:py-1.5"
            >
              <option value="all">すべて</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 sm:min-w-[11rem]">
            <label
              htmlFor="schedule-date-filter"
              className="text-[10px] md:text-xs font-bold text-text-muted whitespace-nowrap shrink-0"
            >
              日付
            </label>
            <input
              id="schedule-date-filter"
              type="date"
              value={dateFilter === "all" ? "" : dateFilter}
              min={datePickerMin}
              max={datePickerMax}
              onChange={(e) => setDateFilter(e.target.value || "all")}
              className="flex-1 min-w-0 text-xs md:text-sm border border-border-muted rounded-md px-1.5 py-1 md:px-2 md:py-1.5"
            />
            {dateFilter !== "all" && (
              <button
                type="button"
                onClick={() => setDateFilter("all")}
                className="text-[10px] md:text-xs font-bold text-accent-blue whitespace-nowrap shrink-0"
              >
                すべて
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2 lg:col-span-1 sm:min-w-[10rem]">
            <label className="text-[10px] md:text-xs font-bold text-text-muted whitespace-nowrap shrink-0">
              車種
            </label>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="flex-1 min-w-0 text-xs md:text-sm border border-border-muted rounded-md px-1.5 py-1 md:px-2 md:py-1.5"
            >
              <option value="all">すべて</option>
              {vehicleTypeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && displayCount === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          読み込み中...
        </div>
      ) : displayCount === 0 ? (
        <p className="px-4 py-6 text-sm text-text-muted flex-1">
          {activeStatusTab === "available"
            ? "現在利用可能な社用車はありません。"
            : "予約中の社用車はありません。"}
        </p>
      ) : (
        <div
          className={
            fillHeight
              ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
              : "overflow-y-auto overflow-x-hidden overscroll-contain max-h-[min(70vh,36rem)]"
          }
        >
          {activeStatusTab === "available" ? (
            <AvailableVehicleTable
              rows={availableRows}
              onSelect={onSelectAvailableVehicle}
            />
          ) : (
            <ReservationTable
              rows={filteredRows}
              currentUserEmail={currentUserEmail}
              nameMap={nameMap}
            />
          )}
        </div>
      )}
    </section>
  );
}
