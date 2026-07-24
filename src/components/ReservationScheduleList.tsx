import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { StaffNameText } from "./StaffNameText";
import { useStaffDisplayNames } from "../hooks/useStaffDisplayNames";
import { toDate, type ReservationLike } from "../lib/drivingLogUtils";
import { groupByUsageArea } from "../lib/vehicleUsageStatus";
import { USAGE_AREAS } from "../types/vehicle";

export type ReservationScheduleItem = ReservationLike & { id: string };

const STATUS_LABELS: Record<string, string> = {
  active: "予約中",
  completed: "完了",
  cancelled: "キャンセル"
};

const USAGE_STATUS_LABELS: Record<string, string> = {
  substitute: "代車"
};

function formatDateTime(value: unknown): string {
  const date = toDate(value as Parameters<typeof toDate>[0]);
  if (!date) return "—";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}/${m}/${d} ${h}:${min}`;
}

function displayCell(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function statusLabel(row: ReservationScheduleItem): string {
  const usageStatusLabel =
    row.usageStatus && USAGE_STATUS_LABELS[String(row.usageStatus)];
  if (usageStatusLabel) return usageStatusLabel;
  return STATUS_LABELS[row.status ?? "active"] ?? displayCell(row.status);
}

function sortByStartTime(items: ReservationScheduleItem[]): ReservationScheduleItem[] {
  return [...items].sort((a, b) => {
    const aTime = toDate(a.startTime)?.getTime() ?? 0;
    const bTime = toDate(b.startTime)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

type Props = {
  reservations: ReservationScheduleItem[];
  loading?: boolean;
  onRefresh?: () => void;
  currentUserEmail?: string | null;
  showAreaFilter?: boolean;
  groupByArea?: boolean;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 w-20 text-xs font-bold text-text-muted">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-all">{value}</span>
    </div>
  );
}

function ReservationCard({
  row,
  isMine,
  nameMap
}: {
  row: ReservationScheduleItem;
  isMine: boolean;
  nameMap: Map<string, string>;
}) {
  const label = statusLabel(row);
  const isSubstitute = row.usageStatus === "substitute";

  return (
    <article
      className={`rounded-lg border p-3 space-y-2 ${
        isMine
          ? "border-accent-blue/40 bg-blue-50/60"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm text-slate-800 truncate">
            {displayCell(row.vehicleModel || row.vehicleNumber)}
          </p>
          {row.vehicleModel && row.vehicleNumber && (
            <p className="text-xs text-text-muted truncate">{row.vehicleNumber}</p>
          )}
        </div>
        <span
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
            isSubstitute
              ? "bg-purple-100 text-purple-800"
              : row.status === "active" || !row.status
                ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {label}
        </span>
      </div>

      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <DetailRow label="開始" value={formatDateTime(row.startTime)} />
        <DetailRow label="終了" value={formatDateTime(row.endTime)} />
        {row.usageStatus === "substitute" && row.substituteUntil && (
          <DetailRow
            label="代車終了予定"
            value={formatDateTime(row.substituteUntil)}
          />
        )}
        <div className="flex gap-2 text-sm">
          <span className="shrink-0 w-20 text-xs font-bold text-text-muted">
            予約者
          </span>
          <StaffNameText email={row.email} nameMap={nameMap} className="min-w-0 flex-1" />
        </div>
        <DetailRow label="エリア" value={displayCell(row.usageArea)} />
        <DetailRow label="カテゴリ" value={displayCell(row.category)} />
        {row.purpose && row.purpose !== "—" && (
          <DetailRow label="利用目的" value={displayCell(row.purpose)} />
        )}
        <DetailRow
          label="利用区間"
          value={`${displayCell(row.routeStart)} → ${displayCell(row.routeEnd)}`}
        />
      </div>
    </article>
  );
}

function ReservationCardList({
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
    <div className="p-3 space-y-3">
      {rows.map((row) => {
        const isMine =
          normalizedEmail !== "" &&
          row.email?.trim().toLowerCase() === normalizedEmail;

        return (
          <div key={row.id}>
            <ReservationCard
              row={row}
              isMine={isMine}
              nameMap={nameMap}
            />
          </div>
        );
      })}
    </div>
  );
}

export function ReservationScheduleList({
  reservations,
  loading = false,
  onRefresh,
  currentUserEmail,
  showAreaFilter = true,
  groupByArea = true
}: Props) {
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const { nameMap } = useStaffDisplayNames(true);

  const areaOptions = useMemo(() => {
    const areas = new Set<string>();
    reservations.forEach((row) => {
      if (row.usageArea?.trim()) areas.add(row.usageArea.trim());
    });
    return [
      ...USAGE_AREAS.filter((area) => areas.has(area)),
      ...[...areas].filter(
        (area) => !USAGE_AREAS.includes(area as (typeof USAGE_AREAS)[number])
      )
    ];
  }, [reservations]);

  const filteredRows = useMemo(() => {
    const sorted = sortByStartTime(reservations);
    if (areaFilter === "all") return sorted;
    return sorted.filter((row) => row.usageArea === areaFilter);
  }, [reservations, areaFilter]);

  const groupedRows = useMemo(() => {
    if (!groupByArea) return null;
    return groupByUsageArea(
      filteredRows.map((row) => ({
        ...row,
        usageArea: row.usageArea?.trim() || "未設定"
      })),
      USAGE_AREAS
    );
  }, [filteredRows, groupByArea]);

  return (
    <section className="mb-6 bg-white rounded-lg border border-border-muted shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-800">
          予約一覧（{filteredRows.length}件）
        </h3>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-blue disabled:opacity-50"
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

      {showAreaFilter && areaOptions.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100 bg-white">
          <label className="text-xs font-bold text-text-muted mr-2">
            利用エリア
          </label>
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="text-sm border border-border-muted rounded-md px-2 py-1.5"
          >
            <option value="all">すべて</option>
            {areaOptions.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && filteredRows.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          読み込み中...
        </div>
      ) : filteredRows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-muted">
          予約中の社用車はありません。
        </p>
      ) : groupByArea && groupedRows ? (
        <div className="divide-y divide-slate-100">
          {groupedRows.map(({ area, items }) => (
            <section key={area}>
              <h4 className="px-4 py-2 text-xs font-bold text-text-muted bg-slate-50/80">
                {area}（{items.length}件）
              </h4>
              <ReservationCardList
                rows={items as ReservationScheduleItem[]}
                currentUserEmail={currentUserEmail}
                nameMap={nameMap}
              />
            </section>
          ))}
        </div>
      ) : (
        <ReservationCardList
          rows={filteredRows}
          currentUserEmail={currentUserEmail}
          nameMap={nameMap}
        />
      )}
    </section>
  );
}
