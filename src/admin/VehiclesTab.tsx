import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw
} from "lucide-react";

import {
  createVehicle,
  deleteVehicle,
  fetchVehicles,
  updateVehicle
} from "../lib/vehicles";
import {
  buildDriveStartUrl,
  driveStartQrImageUrl
} from "../lib/qrDriveStart";
import type { Vehicle, VehicleFormData } from "../types/vehicle";
import { FUEL_TYPES, USAGE_AREAS } from "../types/vehicle";

const EMPTY_FORM: VehicleFormData = {
  vehicleNumber: "",
  chassisNumber: "",
  vehicleName: "",
  modelType: "",
  fuelType: "ガソリン",
  usageArea: "大阪",
  isPersonal: false,
  personalOwnerEmail: ""
};

type Props = {
  onError: (msg: string | null) => void;
  canEdit?: boolean;
};

export default function VehiclesTab({ onError, canEdit = true }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleFormData>(EMPTY_FORM);
  const [qrVehicle, setQrVehicle] = useState<Vehicle | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await fetchVehicles();
      setVehicles(data);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : String(e));
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditingId(vehicle.id ?? null);
    setForm({
      vehicleNumber: vehicle.vehicleNumber,
      chassisNumber: vehicle.chassisNumber,
      vehicleName: vehicle.vehicleName,
      modelType: vehicle.modelType,
      fuelType: vehicle.fuelType,
      usageArea: vehicle.usageArea,
      isPersonal: vehicle.isPersonal,
      personalOwnerEmail: vehicle.personalOwnerEmail
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!form.vehicleName.trim()) {
      alert("車名は必須です。");
      return;
    }
    if (!form.usageArea.trim()) {
      alert("利用エリアは必須です。");
      return;
    }
    if (form.isPersonal && !form.personalOwnerEmail.trim()) {
      alert("個人保有の場合は登録メールアドレスを入力してください。");
      return;
    }

    setSaving(true);
    try {
      const payload: VehicleFormData = {
        vehicleNumber: form.vehicleNumber.trim(),
        chassisNumber: form.chassisNumber.trim(),
        vehicleName: form.vehicleName.trim(),
        modelType: form.modelType.trim(),
        fuelType: form.fuelType,
        usageArea: form.usageArea,
        isPersonal: form.isPersonal,
        personalOwnerEmail: form.isPersonal
          ? form.personalOwnerEmail.trim()
          : ""
      };

      if (editingId) {
        await updateVehicle(editingId, payload);
      } else {
        await createVehicle(payload);
      }

      closeForm();
      await load();
    } catch (e: unknown) {
      alert(
        "保存に失敗しました: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (!vehicle.id) return;
    if (
      !confirm(
        `「${vehicle.vehicleName}」（${vehicle.vehicleNumber || vehicle.chassisNumber}）を削除しますか？`
      )
    ) {
      return;
    }

    try {
      await deleteVehicle(vehicle.id);
      await load();
    } catch (e: unknown) {
      alert(
        "削除に失敗しました: " +
          (e instanceof Error ? e.message : String(e))
      );
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">
          車両マスタ
          <span className="text-sm font-normal text-slate-500 ml-2">
            {vehicles.length}件
          </span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            更新
          </button>
          {canEdit && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#4a72b2] text-white rounded-lg text-sm font-bold hover:bg-[#3d6199]"
            >
              <Plus className="w-4 h-4" />
              新規登録
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
          <p>登録されている車両がありません</p>
          {canEdit && (
            <button
              onClick={openCreate}
              className="px-6 py-3 bg-[#4a72b2] text-white rounded-lg font-bold hover:bg-[#3d6199]"
            >
              新規登録
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white rounded-xl border shadow-sm">
          <table className="w-full text-sm text-left min-w-[900px]">
            <thead className="bg-slate-50 border-b sticky top-0">
              <tr>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                  車両番号
                </th>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                  車台番号
                </th>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                  車名
                </th>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                  型式
                </th>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                  燃料
                </th>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                  利用エリア
                </th>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                  個人保有
                </th>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                  登録メール
                </th>
                <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap w-36">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                    {v.vehicleNumber || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                    {v.chassisNumber || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {v.vehicleName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.modelType || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.fuelType}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.usageArea || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {v.isPersonal ? "○" : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {v.isPersonal ? v.personalOwnerEmail || "—" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {v.vehicleNumber.trim() ? (
                        <button
                          onClick={() => setQrVehicle(v)}
                          className="px-2 py-1.5 text-xs font-bold text-[#4a72b2] hover:bg-blue-50 rounded-lg whitespace-nowrap"
                          title="運転開始用QR"
                          type="button"
                        >
                          QR
                        </button>
                      ) : null}
                      {canEdit && (
                        <>
                          <button
                            onClick={() => openEdit(v)}
                            className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg"
                            title="編集"
                            type="button"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleDelete(v)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="削除"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {qrVehicle && qrVehicle.vehicleNumber.trim() && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
            <h3 className="text-lg font-bold text-slate-800">運転開始用QR</h3>
            <p className="text-sm text-slate-600">
              {qrVehicle.vehicleName}
              <br />
              <span className="font-mono text-xs">
                {qrVehicle.vehicleNumber}
              </span>
            </p>
            <img
              src={driveStartQrImageUrl(
                qrVehicle.vehicleNumber,
                qrVehicle.vehicleName
              )}
              alt="運転開始用QRコード"
              className="mx-auto w-44 h-44 border rounded-lg bg-white"
            />
            <p className="text-xs text-slate-500 break-all">
              {buildDriveStartUrl(
                qrVehicle.vehicleNumber,
                qrVehicle.vehicleName
              )}
            </p>
            <p className="text-xs text-slate-500">
              読み取るとアルコールチェック画面へ進みます。印刷して車両に貼ってください。
            </p>
            <button
              type="button"
              onClick={() => setQrVehicle(null)}
              className="w-full py-2 border rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? "車両を編集" : "車両を新規登録"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <Field label="車両番号">
                <input
                  type="text"
                  value={form.vehicleNumber}
                  onChange={(e) =>
                    setForm({ ...form, vehicleNumber: e.target.value })
                  }
                  placeholder="例: 大阪 349 す 19（わからない場合は空欄可）"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </Field>
              <Field label="車台番号">
                <input
                  type="text"
                  value={form.chassisNumber}
                  onChange={(e) =>
                    setForm({ ...form, chassisNumber: e.target.value })
                  }
                  placeholder="例: ZWA10-2328210（わからない場合は空欄可）"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </Field>
              <Field label="車名" required>
                <input
                  type="text"
                  value={form.vehicleName}
                  onChange={(e) =>
                    setForm({ ...form, vehicleName: e.target.value })
                  }
                  placeholder="例: レクサス"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </Field>
              <Field label="型式">
                <input
                  type="text"
                  value={form.modelType}
                  onChange={(e) =>
                    setForm({ ...form, modelType: e.target.value })
                  }
                  placeholder="例: DAA-ZWA10"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </Field>
              <Field label="燃料の種類">
                <select
                  value={form.fuelType}
                  onChange={(e) =>
                    setForm({ ...form, fuelType: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  {FUEL_TYPES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="利用エリア" required>
                <select
                  value={form.usageArea}
                  onChange={(e) =>
                    setForm({ ...form, usageArea: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  {USAGE_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="個人保有">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPersonal}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        isPersonal: e.target.checked,
                        personalOwnerEmail: e.target.checked
                          ? form.personalOwnerEmail
                          : ""
                      })
                    }
                    className="w-4 h-4 accent-[#4a72b2]"
                  />
                  <span className="text-sm text-slate-700">
                    個人保有車として登録する
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  チェックすると、登録メールのユーザー以外の予約画面には表示されません。
                </p>
              </Field>
              {form.isPersonal && (
                <Field label="登録メールアドレス" required>
                  <input
                    type="email"
                    value={form.personalOwnerEmail}
                    onChange={(e) =>
                      setForm({ ...form, personalOwnerEmail: e.target.value })
                    }
                    placeholder="例: user@example.com"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </Field>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={closeForm}
                disabled={saving}
                className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="px-6 py-2 bg-[#4a72b2] text-white rounded-lg text-sm font-bold hover:bg-[#3d6199] disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "更新" : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
