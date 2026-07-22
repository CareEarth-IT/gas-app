import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Users } from "lucide-react";

import {
  deleteDepartment,
  deleteStaffProfile,
  fetchDepartments,
  fetchStaffProfiles,
  saveDepartment,
  saveStaffProfile,
  type DepartmentRecord,
  type StaffProfileRecord
} from "../lib/staffAdmin";
import type { DepartmentOfficer } from "../../shared/staffTypes";
import { collectStaffDepartmentIds } from "../../shared/departmentScope";
import { uploadToSakura } from "../lib/sakuraUpload";
import { clearStaffNameMapCache } from "../lib/staffNames";

type StaffTabProps = {
  onError: (message: string | null) => void;
};

const EMPTY_OFFICER: DepartmentOfficer = { name: "", email: "" };

const EMPTY_DEPT: Omit<DepartmentRecord, "id"> = {
  name: "",
  officers: [],
  sealImageUrl: ""
};

function officersForForm(officers: DepartmentOfficer[]): DepartmentOfficer[] {
  if (officers.length === 0) return [{ ...EMPTY_OFFICER }];
  return officers.map((officer) => ({
    name: officer.name ?? "",
    email: officer.email
  }));
}

const EMPTY_STAFF: Omit<StaffProfileRecord, "id"> = {
  email: "",
  name: "",
  employmentType: "employee",
  departmentId: "",
  departmentIds: [],
  skipDrivingApproval: false,
  skipEtcApproval: false
};

function staffDepartmentIds(row: StaffProfileRecord): string[] {
  return collectStaffDepartmentIds(row);
}

function formatDepartmentNames(
  departmentIds: string[],
  departments: DepartmentRecord[]
): string {
  const names = departmentIds
    .map((id) => departments.find((dept) => dept.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join("、") : "—";
}

export default function StaffTab({ onError }: StaffTabProps) {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [staff, setStaff] = useState<StaffProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deptFormOpen, setDeptFormOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState(EMPTY_DEPT);

  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [editingStaffEmail, setEditingStaffEmail] = useState<string | null>(
    null
  );
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [deptList, staffList] = await Promise.all([
        fetchDepartments(),
        fetchStaffProfiles()
      ]);
      setDepartments(deptList);
      setStaff(staffList);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNewDept = () => {
    setEditingDeptId(null);
    setDeptForm({
      name: "",
      officers: [{ ...EMPTY_OFFICER }],
      sealImageUrl: ""
    });
    setDeptFormOpen(true);
  };

  const openEditDept = (dept: DepartmentRecord) => {
    setEditingDeptId(dept.id ?? null);
    setDeptForm({
      name: dept.name,
      officers: officersForForm(dept.officers ?? []),
      sealImageUrl: dept.sealImageUrl ?? ""
    });
    setDeptFormOpen(true);
  };

  const submitDept = async () => {
    if (!deptForm.name.trim()) {
      alert("部署名を入力してください。");
      return;
    }
    const officers = deptForm.officers
      .map((officer) => ({
        name: officer.name?.trim() || undefined,
        email: officer.email.trim().toLowerCase()
      }))
      .filter((officer) => officer.email);
    setSaving(true);
    try {
      await saveDepartment(editingDeptId, {
        name: deptForm.name.trim(),
        officers,
        sealImageUrl: deptForm.sealImageUrl?.trim() || ""
      });
      clearStaffNameMapCache();
      setDeptFormOpen(false);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSealFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください。");
      return;
    }
    setSaving(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
        reader.readAsDataURL(file);
      });
      const url = await uploadToSakura(dataUrl);
      setDeptForm((f) => ({ ...f, sealImageUrl: url }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeDept = async (id: string) => {
    if (!confirm("この部署を削除しますか？")) return;
    try {
      await deleteDepartment(id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const openNewStaff = () => {
    setEditingStaffEmail(null);
    setStaffForm(EMPTY_STAFF);
    setStaffFormOpen(true);
  };

  const openEditStaff = (row: StaffProfileRecord) => {
    const departmentIds = staffDepartmentIds(row);
    setEditingStaffEmail(row.email);
    setStaffForm({
      email: row.email,
      name: row.name ?? "",
      employmentType: row.employmentType,
      departmentId: departmentIds[0] ?? "",
      departmentIds,
      skipDrivingApproval: row.skipDrivingApproval === true,
      skipEtcApproval: row.skipEtcApproval === true
    });
    setStaffFormOpen(true);
  };

  const toggleStaffDepartment = (departmentId: string) => {
    setStaffForm((form) => {
      const current = new Set(form.departmentIds ?? []);
      if (current.has(departmentId)) {
        current.delete(departmentId);
      } else {
        current.add(departmentId);
      }
      const departmentIds = [...current];
      return {
        ...form,
        departmentIds,
        departmentId: departmentIds[0] ?? ""
      };
    });
  };

  const submitStaff = async () => {
    if (!staffForm.email.trim()) {
      alert("ログインID（メール）を入力してください。");
      return;
    }
    const departmentIds = (staffForm.departmentIds ?? []).filter(Boolean);
    if (departmentIds.length === 0) {
      alert("所属部署を1つ以上選択してください。");
      return;
    }
    setSaving(true);
    try {
      await saveStaffProfile({
        email: staffForm.email.trim().toLowerCase(),
        name: staffForm.name.trim() || undefined,
        employmentType: staffForm.employmentType,
        departmentId: departmentIds[0],
        departmentIds,
        skipDrivingApproval: staffForm.skipDrivingApproval === true,
        skipEtcApproval: staffForm.skipEtcApproval === true
      });
      clearStaffNameMapCache();
      setStaffFormOpen(false);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const removeStaff = async (email: string) => {
    if (!confirm(`${email} のスタッフ設定を削除しますか？`)) return;
    try {
      await deleteStaffProfile(email);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
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
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5" />
            部署・役員
          </h2>
          <button
            onClick={openNewDept}
            className="flex items-center gap-1 px-3 py-2 bg-[#4a72b2] text-white text-sm font-bold rounded-lg"
          >
            <Plus className="w-4 h-4" />
            部署を追加
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          アルバイトが利用報告を1日以上提出しない場合、ここで設定した役員メールへアラートが送信されます。
          同一部署名の役員や、複数部署に所属するスタッフの場合も、登録した役員のいずれか1名が承認すれば完了します。
        </p>

        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  部署名
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  印鑑
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  氏名
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  メール
                </th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-slate-500 text-center">
                    部署が未登録です
                  </td>
                </tr>
              ) : (
                departments.map((dept) => {
                  const officers = (dept.officers ?? []).filter(
                    (officer) => officer.email?.trim()
                  );
                  const displayOfficers =
                    officers.length > 0 ? officers : [{ email: "", name: undefined }];
                  const sealUrl = dept.sealImageUrl?.trim() ?? "";
                  return (
                    <tr key={dept.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3 font-medium">{dept.name}</td>
                      <td className="px-4 py-3">
                        {sealUrl.startsWith("http") ? (
                          <img
                            src={sealUrl}
                            alt={`${dept.name}の印鑑`}
                            className="h-10 w-10 object-contain"
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="space-y-1">
                          {displayOfficers.map((officer, index) => (
                            <div key={`${officer.email}-${index}`}>
                              {officer.name?.trim() || "—"}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="space-y-1">
                          {displayOfficers.map((officer, index) => (
                            <div key={`${officer.email}-${index}`}>
                              {officer.email || "—"}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEditDept(dept)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                            title="編集"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => dept.id && void removeDept(dept.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">スタッフ区分</h2>
          <button
            onClick={openNewStaff}
            className="flex items-center gap-1 px-3 py-2 bg-[#4a72b2] text-white text-sm font-bold rounded-lg"
          >
            <Plus className="w-4 h-4" />
            スタッフを登録
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          未登録の場合は @careearth.info → 社員、それ以外 → アルバイトとして自動判定します。
          承認メール送信には、社員・アルバイトいずれも所属部署の登録が必要です。
        </p>

        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  ログインID
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  氏名
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  区分
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  部署
                </th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">
                  承認省略
                </th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-slate-500 text-center">
                    スタッフが未登録です（自動判定のみ）
                  </td>
                </tr>
              ) : (
                staff.map((row) => (
                  <tr key={row.email} className="border-b border-slate-100">
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3">{row.name || "—"}</td>
                    <td className="px-4 py-3">
                      {row.employmentType === "employee" ? "社員" : "アルバイト"}
                    </td>
                    <td className="px-4 py-3">
                      {formatDepartmentNames(staffDepartmentIds(row), departments)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 text-xs">
                      {[
                        row.skipDrivingApproval ? "運転" : null,
                        row.skipEtcApproval ? "ETC" : null
                      ]
                        .filter(Boolean)
                        .join("・") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEditStaff(row)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void removeStaff(row.email)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {deptFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-lg mb-4">
              {editingDeptId ? "部署を編集" : "部署を追加"}
            </h3>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              部署名
            </label>
            <input
              value={deptForm.name}
              onChange={(e) =>
                setDeptForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />
            <label className="block text-xs font-bold text-slate-600 mb-1">
              印鑑画像（酒気帯び確認記録表用）
            </label>
            <p className="text-xs text-slate-500 mb-2">
              この部署に所属するスタッフの酒気帯び記録に表示されます。
            </p>
            <div className="flex items-center gap-3 mb-4">
              {deptForm.sealImageUrl?.startsWith("http") ? (
                <img
                  src={deptForm.sealImageUrl}
                  alt="印鑑プレビュー"
                  className="h-14 w-14 object-contain border rounded bg-white"
                />
              ) : (
                <div className="h-14 w-14 border rounded bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                  未設定
                </div>
              )}
              <div className="flex flex-col gap-1">
                <input
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void handleSealFile(file);
                  }}
                  className="text-sm"
                />
                {deptForm.sealImageUrl?.startsWith("http") && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeptForm((f) => ({ ...f, sealImageUrl: "" }))
                    }
                    className="text-xs font-bold text-red-600 hover:underline text-left"
                  >
                    印鑑を削除
                  </button>
                )}
              </div>
            </div>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              役員
            </label>
            <p className="text-xs text-slate-500 mb-2">
              複数の役員を登録できます。いずれか1名が承認すれば承認完了です。
            </p>
            <div className="space-y-3 mb-3">
              {deptForm.officers.map((officer, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      value={officer.name ?? ""}
                      onChange={(e) =>
                        setDeptForm((f) => ({
                          ...f,
                          officers: f.officers.map((row, i) =>
                            i === index ? { ...row, name: e.target.value } : row
                          )
                        }))
                      }
                      placeholder="氏名"
                      className="w-full border rounded-lg px-3 py-2"
                    />
                    <input
                      type="email"
                      value={officer.email}
                      onChange={(e) =>
                        setDeptForm((f) => ({
                          ...f,
                          officers: f.officers.map((row, i) =>
                            i === index ? { ...row, email: e.target.value } : row
                          )
                        }))
                      }
                      placeholder="メール"
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDeptForm((f) => ({
                        ...f,
                        officers:
                          f.officers.length <= 1
                            ? [{ ...EMPTY_OFFICER }]
                            : f.officers.filter((_, i) => i !== index)
                      }))
                    }
                    className="px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setDeptForm((f) => ({
                  ...f,
                  officers: [...f.officers, { ...EMPTY_OFFICER }]
                }))
              }
              className="mb-4 text-sm font-bold text-[#4a72b2] hover:underline"
            >
              + 役員を追加
            </button>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeptFormOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600"
              >
                キャンセル
              </button>
              <button
                onClick={() => void submitDept()}
                disabled={saving}
                className="px-4 py-2 bg-[#4a72b2] text-white text-sm font-bold rounded-lg disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {staffFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-lg mb-4">
              {editingStaffEmail ? "スタッフを編集" : "スタッフを登録"}
            </h3>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              ログインID（メール / カスタムID）
            </label>
            <input
              value={staffForm.email}
              onChange={(e) =>
                setStaffForm((f) => ({ ...f, email: e.target.value }))
              }
              disabled={!!editingStaffEmail}
              className="w-full border rounded-lg px-3 py-2 mb-4 disabled:bg-slate-100"
            />
            <label className="block text-xs font-bold text-slate-600 mb-1">
              氏名（任意）
            </label>
            <input
              value={staffForm.name}
              onChange={(e) =>
                setStaffForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />
            <label className="block text-xs font-bold text-slate-600 mb-1">
              区分
            </label>
            <select
              value={staffForm.employmentType}
              onChange={(e) =>
                setStaffForm((f) => ({
                  ...f,
                  employmentType: e.target.value as "employee" | "part_time"
                }))
              }
              className="w-full border rounded-lg px-3 py-2 mb-4"
            >
              <option value="employee">社員</option>
              <option value="part_time">アルバイト</option>
            </select>
            <label className="block text-xs font-bold text-slate-600 mb-2">
              所属部署（複数選択可）
            </label>
            <div className="border rounded-lg px-3 py-2 mb-2 max-h-40 overflow-y-auto space-y-2">
              {departments.length === 0 ? (
                <p className="text-sm text-slate-500">部署が未登録です</p>
              ) : (
                departments.map((dept) => (
                  <label
                    key={dept.id}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={(staffForm.departmentIds ?? []).includes(dept.id)}
                      onChange={() => toggleStaffDepartment(dept.id)}
                    />
                    {dept.name}
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              申請者のログインID（メール）と同じアドレスでスタッフを登録し、所属部署を選んでください。同一部署名の役員や複数部署の役員のいずれか1名が承認すれば完了します。
            </p>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={staffForm.skipDrivingApproval === true}
                  onChange={(e) =>
                    setStaffForm((f) => ({
                      ...f,
                      skipDrivingApproval: e.target.checked
                    }))
                  }
                />
                運転報告の上長承認を省略（自動承認）
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={staffForm.skipEtcApproval === true}
                  onChange={(e) =>
                    setStaffForm((f) => ({
                      ...f,
                      skipEtcApproval: e.target.checked
                    }))
                  }
                />
                ETC 利用の上長承認を省略（自動承認）
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setStaffFormOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600"
              >
                キャンセル
              </button>
              <button
                onClick={() => void submitStaff()}
                disabled={saving}
                className="px-4 py-2 bg-[#4a72b2] text-white text-sm font-bold rounded-lg disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
