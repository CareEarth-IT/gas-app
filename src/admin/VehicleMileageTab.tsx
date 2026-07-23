import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Search } from "lucide-react";

import { fetchRecentDrivingLogs } from "../lib/drivingLogs";
import {
  buildMonthColumns,
  formatKm,
  formatMaintenanceDate,
  getOilChangeStatus,
  kmSinceLastOilChange,
  latestOdometerKm,
  monthlyDrivenKm,
  normalizeVehicleNumber,
  OIL_CHANGE_INTERVAL_KM,
  type DrivingLogMileage,
  type MonthColumn
} from "../lib/vehicleMileage";
import {
  createMaintenanceRecord,
  fetchMaintenanceRecords,
  updateMaintenanceRecord,
  type MaintenanceType,
  type VehicleMaintenanceRecord
} from "../lib/vehicleMaintenance";
import { fetchVehicles } from "../lib/vehicles";
import type { Vehicle } from "../types/vehicle";

type Props = {
  onError: (msg: string | null) => void;
  canEdit?: boolean;
};

type EditingCell = {
  vehicleNumber: string;
  type: MaintenanceType;
  columnKey: string;
  recordId?: string;
  dateValue: string;
};

function maintenanceInMonth(
  records: VehicleMaintenanceRecord[],
  vehicleNumber: string,
  type: MaintenanceType,
  column: MonthColumn
): VehicleMaintenanceRecord[] {
  const normalized = normalizeVehicleNumber(vehicleNumber);

  return records.filter((record) => {
    if (normalizeVehicleNumber(record.vehicleNumber) !== normalized) return false;
    if (record.type !== type) return false;

    const date = record.performedAt;
    return (
      date.getFullYear() === column.year && date.getMonth() + 1 === column.month
    );
  });
}

function latestOilChange(
  records: VehicleMaintenanceRecord[],
  vehicleNumber: string
): VehicleMaintenanceRecord | undefined {
  const normalized = normalizeVehicleNumber(vehicleNumber);

  return records.find(
    (record) =>
      record.type === "oil" &&
      normalizeVehicleNumber(record.vehicleNumber) === normalized
  );
}

function defaultDateForColumn(column: MonthColumn): string {
  const now = new Date();
  if (column.isCurrent) {
    return now.toISOString().slice(0, 10);
  }
  return `${column.year}-${String(column.month).padStart(2, "0")}-01`;
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type MaintenanceDateCellProps = {
  vehicle: Vehicle;
  type: MaintenanceType;
  column: MonthColumn;
  items: VehicleMaintenanceRecord[];
  warningLabel?: string;
  editingCell: EditingCell | null;
  saving: boolean;
  onStartEdit: (cell: EditingCell) => void;
  onChangeDate: (dateValue: string) => void;
  onSave: () => void;
  onCancel: () => void;
  canEdit?: boolean;
};

function MaintenanceDateCell({
  vehicle,
  type,
  column,
  items,
  warningLabel,
  editingCell,
  saving,
  onStartEdit,
  onChangeDate,
  onSave,
  onCancel,
  canEdit = true
}: MaintenanceDateCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing =
    editingCell?.vehicleNumber === vehicle.vehicleNumber &&
    editingCell.type === type &&
    editingCell.columnKey === column.key;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const startEdit = () => {
    if (!canEdit) return;
    const existing = items[0];
    onStartEdit({
      vehicleNumber: vehicle.vehicleNumber,
      type,
      columnKey: column.key,
      recordId: existing?.id,
      dateValue: existing
        ? toDateInputValue(existing.performedAt)
        : defaultDateForColumn(column)
    });
  };

  if (isEditing && editingCell) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={editingCell.dateValue}
        disabled={saving}
        onChange={(event) => onChangeDate(event.target.value)}
        onBlur={() => void onSave()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void onSave();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        className="w-full max-w-[9rem] mx-auto h-9 px-2 border-2 border-[#4a72b2] rounded text-center text-sm"
      />
    );
  }

  if (items.length > 0) {
    return (
      <div
        role="button"
        tabIndex={0}
        onDoubleClick={startEdit}
        className="cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5"
        title="ダブルクリックで編集"
      >
        {items.map((item) => (
          <div key={item.id}>{formatMaintenanceDate(item.performedAt)}</div>
        ))}
      </div>
    );
  }

  if (warningLabel) {
    return (
      <span
        role="button"
        tabIndex={0}
        onDoubleClick={startEdit}
        className="text-amber-700 text-xs font-bold cursor-pointer hover:underline"
        title="ダブルクリックで交換日を入力"
      >
        {warningLabel}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onDoubleClick={startEdit}
      className="text-slate-400 cursor-pointer hover:text-[#4a72b2] hover:underline"
      title="ダブルクリックで交換日を入力"
    >
      —
    </span>
  );
}

export default function VehicleMileageTab({ onError, canEdit = true }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<DrivingLogMileage[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<
    VehicleMaintenanceRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const monthColumns = useMemo(() => buildMonthColumns(), []);

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vehicles;

    return vehicles.filter((vehicle) => {
      const haystack = [
        vehicle.vehicleName,
        vehicle.vehicleNumber,
        vehicle.chassisNumber,
        vehicle.usageArea,
        vehicle.modelType
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [vehicles, searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [vehicleList, maintenanceList, logs] = await Promise.all([
        fetchVehicles(),
        fetchMaintenanceRecords(),
        fetchRecentDrivingLogs(500)
      ]);

      setVehicles(vehicleList);
      setMaintenanceRecords(maintenanceList);
      setLogs(logs as DrivingLogMileage[]);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      setVehicles([]);
      setLogs([]);
      setMaintenanceRecords([]);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveCell = async () => {
    if (!editingCell?.dateValue) {
      setEditingCell(null);
      return;
    }

    const vehicle = vehicles.find(
      (item) => item.vehicleNumber === editingCell.vehicleNumber
    );
    if (!vehicle) return;

    const performedAt = new Date(`${editingCell.dateValue}T12:00:00`);
    if (Number.isNaN(performedAt.getTime())) {
      alert("日付を正しく入力してください。");
      return;
    }

    const mileageKm =
      latestOdometerKm(logs, vehicle.vehicleNumber) ?? 0;

    setSaving(true);
    try {
      if (editingCell.recordId) {
        await updateMaintenanceRecord(editingCell.recordId, {
          performedAt,
          mileageKm
        });
      } else {
        await createMaintenanceRecord({
          vehicleNumber: vehicle.vehicleNumber,
          type: editingCell.type,
          performedAt,
          mileageKm
        });
      }
      setEditingCell(null);
      await load();
    } catch (error) {
      alert(
        "保存に失敗しました: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-800">走行距離・メンテナンス</h2>
          <p className="text-xs text-slate-500 mt-1">
            7月〜12月の走行距離を確認できます。オイル交換日の「—」を
            ダブルクリックして入力してください（オイル交換目安:{" "}
            {OIL_CHANGE_INTERVAL_KM.toLocaleString("ja-JP")} km）
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading || saving}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          更新
        </button>
      </div>

      {vehicles.length > 0 && (
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="車名・車両番号・車台番号・利用エリアで検索"
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm bg-white"
          />
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          車両が登録されていません
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          検索条件に一致する車両がありません
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-6 pb-6">
          {filteredVehicles.map((vehicle) => {
            const odometer = latestOdometerKm(logs, vehicle.vehicleNumber);
            const lastOil = latestOilChange(maintenanceRecords, vehicle.vehicleNumber);
            const kmSinceOil = kmSinceLastOilChange(
              odometer,
              lastOil?.mileageKm ?? null
            );
            const oilStatus = getOilChangeStatus(kmSinceOil);

            return (
              <section
                key={vehicle.id ?? vehicle.vehicleNumber}
                className="bg-white rounded-xl border shadow-sm overflow-hidden"
              >
                <div className="px-4 py-3 border-b bg-slate-50">
                  <h3 className="font-bold text-slate-800">
                    {vehicle.vehicleName}
                  </h3>
                  <p className="text-xs text-slate-500">{vehicle.vehicleNumber}</p>
                  {odometer != null && (
                    <p className="text-xs text-slate-600 mt-1">
                      現在の走行距離: {formatKm(odometer)}
                    </p>
                  )}
                  {lastOil && (
                    <p className="text-xs text-slate-600">
                      前回オイル交換:{" "}
                      {lastOil.performedAt.toLocaleDateString("ja-JP")}（
                      {formatKm(lastOil.mileageKm)}）
                    </p>
                  )}
                </div>

                {oilStatus === "warning" && kmSinceOil != null && (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    オイル交換してください（前回交換から {formatKm(kmSinceOil)}）
                  </div>
                )}

                {oilStatus === "overdue" && kmSinceOil != null && (
                  <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    オイル交換が必要です（前回交換から {formatKm(kmSinceOil)} / 目安{" "}
                    {OIL_CHANGE_INTERVAL_KM.toLocaleString("ja-JP")} km）
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b bg-white">
                        <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 w-28">
                          項目
                        </th>
                        {monthColumns.map((column) => (
                          <th
                            key={column.key}
                            className="px-3 py-2 text-center text-xs font-bold text-slate-600"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="px-4 py-3 font-bold text-slate-700">
                          走行距離
                        </td>
                        {monthColumns.map((column) => {
                          const km = monthlyDrivenKm(
                            logs,
                            vehicle.vehicleNumber,
                            column.year,
                            column.month
                          );

                          return (
                            <td
                              key={column.key}
                              className="px-3 py-3 text-center text-slate-800"
                            >
                              {km > 0 ? formatKm(km) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="bg-amber-50/40">
                        <td className="px-4 py-3 font-bold text-slate-700">
                          オイル交換日
                        </td>
                        {monthColumns.map((column) => {
                          const items = maintenanceInMonth(
                            maintenanceRecords,
                            vehicle.vehicleNumber,
                            "oil",
                            column
                          );

                          return (
                            <td
                              key={column.key}
                              className="px-3 py-3 text-center text-slate-800"
                            >
                              <MaintenanceDateCell
                                vehicle={vehicle}
                                type="oil"
                                column={column}
                                items={items}
                                warningLabel={
                                  items.length === 0 &&
                                  column.isCurrent &&
                                  oilStatus === "warning"
                                    ? "そろそろ交換"
                                    : undefined
                                }
                                editingCell={editingCell}
                                saving={saving}
                                onStartEdit={setEditingCell}
                                onChangeDate={(dateValue) =>
                                  setEditingCell((current) =>
                                    current ? { ...current, dateValue } : current
                                  )
                                }
                                onSave={handleSaveCell}
                                onCancel={() => setEditingCell(null)}
                                canEdit={canEdit}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
