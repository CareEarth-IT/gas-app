import { useCallback, useEffect, useState, Fragment } from "react";
import {
  Car,
  Droplet,
  List,
  MapPin,
  ClipboardList,
  Gauge,
  LogOut,
  Loader2,
  RefreshCw,
  Calendar,
  Truck,
  Users,
  Trash2,
  Wine
} from "lucide-react";
import VehiclesTab from "./VehiclesTab";
import VehicleMileageTab from "./VehicleMileageTab";
import StaffTab from "./StaffTab";
import type { User } from "firebase/auth";

import { googleSignIn, logout, initAuth } from "../lib/firebase";
import {
  enrichDrivingLog,
  type DrivingLogLike,
  type ReservationLike
} from "../lib/drivingLogUtils";
import { completeExpiredReservations } from "../lib/reservations";
import { enrichRefuelingRecord } from "../lib/refuelingRecords";
import {
  approveEtcRecord,
  deleteAdminCollectionRecord,
  deleteAllAdminCollectionRecords,
  fetchAdminCollection
} from "../lib/records";
import { approveDrivingLog, fetchAccessRole, updateAlcoholCheck } from "../lib/drivingLogs";
import { fetchVehicles } from "../lib/vehicles";
import {
  fetchStaffLookupMaps,
  getStaffDisplayName,
  getStaffSealImageUrl
} from "../lib/staffNames";
import {
  FIXED_ALCOHOL_CHECK_FIELDS,
  getFixedAlcoholCheckFields,
  needsAlcoholCheckBackfill
} from "../../shared/alcoholCheckDefaults";
import { isAdminEmail } from "./adminConfig";
import {
  APPROVAL_LABELS,
  approvalRowClass,
  getApprovalStatus,
  getDrivingApprovalStatus
} from "../../shared/drivingApproval";
import { ReservationScheduleList } from "../components/ReservationScheduleList";
import { buildGoogleMapsUrl, formatTimestamp, cell } from "./format";

const APPROVAL_TABS = new Set<TabId>(["drivingLogs", "etcRecords"]);

type TabId =
  | "vehicles"
  | "vehicleMileage"
  | "staff"
  | "drivingLogs"
  | "alcoholChecks"
  | "reservations"
  | "refuelingRecords"
  | "etcRecords"
  | "gpsLogs";

type Row = Record<string, unknown> & { id: string };

const TABS: { id: TabId; label: string; icon: typeof Car }[] = [
  { id: "vehicles", label: "車両マスタ", icon: Truck },
  { id: "vehicleMileage", label: "走行距離", icon: Gauge },
  { id: "staff", label: "スタッフ・部署", icon: Users },
  { id: "drivingLogs", label: "運転記録", icon: Car },
  { id: "alcoholChecks", label: "酒気帯び確認記録表", icon: Wine },
  { id: "reservations", label: "車両予約", icon: Calendar },
  { id: "refuelingRecords", label: "給油", icon: Droplet },
  { id: "etcRecords", label: "ETC", icon: List },
  { id: "gpsLogs", label: "GPS", icon: MapPin }
];

const COLUMN_LABELS: Record<string, string> = {
  email: "メール",
  userName: "氏名",
  vehicleNumber: "車両番号",
  vehicleModel: "車種",
  usageArea: "利用エリア",
  startTime: "出発時間",
  endTime: "到着時間",
  reservationStartTime: "予約開始",
  reservationEndTime: "予約終了",
  reservationId: "予約ID",
  destination: "目的地",
  purpose: "利用目的",
  category: "カテゴリ",
  routeStart: "出発",
  routeEnd: "到着",
  status: "状態",
  usageStatus: "利用区分",
  substituteUntil: "代車終了予定",
  remarks: "備考",
  timestamp: "日時",
  type: "種別",
  latitude: "緯度",
  longitude: "経度",
  meterImageUrl: "メーター画像",
  receiptImageUrl: "レシート画像",
  alcoholCheckImageUrl: "酒気画像",
  startMeterImageUrl: "メーター画像",
  startMileageImageUrl: "走行距離画像",
  endMileageImageUrl: "終了走行距離画像",
  startMileageKm: "出発時距離(km)",
  endMileageKm: "終了時距離(km)",
  photoUrls: "写真",
  createdAt: "作成日時",
  reportTime: "報告日時",
  approvalStatus: "承認状態",
  approvedBy: "承認者",
  approvedAt: "承認日時"
};

/** 公開画面と同じ項目名（タブごとに上書き） */
const COLUMN_LABELS_BY_TAB: Partial<Record<TabId, Record<string, string>>> = {
  etcRecords: {
    otherReason: "その他の理由",
    routeStart: "①ICの乗り口",
    routeEnd: "①ICの降り口",
    photoUrls: "②利用目的、到着地がわかる写真"
  },
  drivingLogs: {
    receiptImageUrl: "領収書画像",
    remarks: "備考"
  },
  alcoholChecks: {
    startTime: "出発時間",
    endTime: "到着時間",
    alcoholCheckImageUrl: "酒気画像",
    alcoholBeforeConfirmationMethod: "確認方法（出発前）",
    alcoholBeforeDetectorUsed: "検知器（出発前）",
    alcoholBeforePresent: "酒気帯び（出発前）",
    alcoholAfterConfirmationMethod: "確認方法（到着後）",
    alcoholAfterDetectorUsed: "検知器（到着後）",
    alcoholAfterPresent: "酒気帯び（到着後）",
    sealImageUrl: "印鑑"
  }
};

function getColumnLabel(tab: TabId, col: string): string {
  return COLUMN_LABELS_BY_TAB[tab]?.[col] ?? COLUMN_LABELS[col] ?? col;
}

function getAdminErrorHint(error: string, kind: "load" | "action"): string {
  if (kind === "action") {
    if (error.includes("管理者権限が必要") || error.includes("上長")) {
      return "部署の役員として登録されたメールでログインしているか、管理画面のスタッフ区分で部署が設定されているか確認してください。";
    }
    return "しばらくしてから再度お試しください。解消しない場合は管理者にお問い合わせください。";
  }

  if (
    error.includes("認証情報が未設定") ||
    error.includes("認証トークン") ||
    error.includes("Could not load the default credentials")
  ) {
    return "Google ログインは成功していても、API が Firebase に接続できないとこのエラーになります。ローカルでは .env に VITE_API_BASE_URL（本番 Cloud Run）を設定するか、LOCAL_FIREBASE_ADC=true と gcloud auth application-default login を実行してください。設定後は npm run dev を再起動してください。";
  }

  if (error.includes("管理者権限が必要")) {
    return "車両マスタだけ見える場合、API が本番の古い設定のままです。`npm run deploy:cloudrun` で API を更新するか、.env の VITE_API_BASE_URL をコメントアウトして LOCAL_FIREBASE_ADC=true と gcloud auth application-default login でローカル API を使ってください。";
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") &&
    error === "データの取得に失敗しました"
  ) {
    return "ローカル開発では .env が未設定だとよく起きます。.env.example を .env にコピーし、VITE_API_BASE_URL で本番 API を指定するか、LOCAL_FIREBASE_ADC=true でローカル API を使って npm run dev を再起動してください。";
  }

  return "管理者メールでログインしているか、Firestore ルールを確認してください。";
}

const STATUS_LABELS: Record<string, string> = {
  active: "予約中",
  completed: "完了",
  cancelled: "キャンセル",
  driving: "運転中",
  reported: "報告済"
};

const DRIVING_LOG_STATUS_LABELS: Record<string, string> = {
  driving: "運転中",
  reported: "報告済"
};

function getRowApproval(tab: TabId, row: Row) {
  if (tab === "drivingLogs") return getDrivingApprovalStatus(row);
  if (tab === "etcRecords") return getApprovalStatus(row);
  return null;
}

function canApproveRow(tab: TabId, row: Row): boolean {
  const approval = getRowApproval(tab, row);
  if (approval !== "pending") return false;
  if (tab === "drivingLogs") return row.status === "reported";
  return tab === "etcRecords";
}

const ALCOHOL_FIXED_FIELDS = [
  "alcoholBeforeConfirmationMethod",
  "alcoholBeforeDetectorUsed",
  "alcoholBeforePresent",
  "alcoholAfterConfirmationMethod",
  "alcoholAfterDetectorUsed",
  "alcoholAfterPresent"
] as const;

type AlcoholFixedField = (typeof ALCOHOL_FIXED_FIELDS)[number];

function isAlcoholFixedField(col: string): col is AlcoholFixedField {
  return (ALCOHOL_FIXED_FIELDS as readonly string[]).includes(col);
}

function currentYearMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function yearMonthFromValue(value: unknown): string | null {
  if (!value) return null;
  let date: Date;
  const v = value as { toDate?: () => Date };
  if (typeof v.toDate === "function") {
    date = v.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else {
    return null;
  }
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) return null;
  return `${year}-${month}`;
}

function formatYearMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${y}/${m}`;
}

function formatCell(key: string, value: unknown): string {
  if (
    key.includes("Time") ||
    key === "substituteUntil" ||
    key === "timestamp" ||
    key === "createdAt" ||
    key === "reportTime" ||
    key === "approvedAt"
  ) {
    return formatTimestamp(value);
  }
  if (key.includes("ImageUrl") || key === "photoUrls") {
    if (Array.isArray(value)) return `${value.length}枚`;
    if (typeof value === "string" && value.startsWith("http")) return "あり";
    return cell(value);
  }
  if (key === "latitude" || key === "longitude") {
    return typeof value === "number" ? value.toFixed(6) : cell(value);
  }
  if (key === "status") {
    const raw = value == null || value === "" ? "active" : String(value);
    return STATUS_LABELS[raw] ?? cell(value);
  }
  if (key === "usageStatus") {
    const raw = String(value ?? "");
    if (raw === "substitute") return "代車";
    return cell(value);
  }
  if (key === "approvalStatus") {
    return APPROVAL_LABELS[getApprovalStatus({ approvalStatus: value })];
  }
  if (key === "drivingStatus") {
    return DRIVING_LOG_STATUS_LABELS[String(value)] ?? cell(value);
  }
  if (key === "userName") {
    const name = String(value ?? "").trim();
    return name || "—";
  }
  return cell(value);
}

function pickColumns(rows: Row[], tab: TabId): string[] {
  const priority: Record<TabId, string[]> = {
    vehicles: [],
    vehicleMileage: [],
    staff: [],
    drivingLogs: [
      "userName",
      "email",
      "vehicleNumber",
      "vehicleModel",
      "startTime",
      "endTime",
      "destination",
      "purpose",
      "startMileageKm",
      "endMileageKm",
      "remarks",
      "approvalStatus",
      "status",
      "approvedBy",
      "approvedAt",
      "startMileageImageUrl",
      "endMileageImageUrl",
      "receiptImageUrl"
    ],
    alcoholChecks: [
      "userName",
      "email",
      "vehicleNumber",
      "vehicleModel",
      "startTime",
      "alcoholBeforeConfirmationMethod",
      "alcoholBeforeDetectorUsed",
      "alcoholBeforePresent",
      "endTime",
      "alcoholAfterConfirmationMethod",
      "alcoholAfterDetectorUsed",
      "alcoholAfterPresent",
      "alcoholCheckImageUrl",
      "sealImageUrl"
    ],
    reservations: [
      "startTime",
      "endTime",
      "email",
      "vehicleNumber",
      "usageArea",
      "category",
      "purpose",
      "routeStart",
      "routeEnd",
      "usageStatus",
      "substituteUntil",
      "status"
    ],
    refuelingRecords: [
      "timestamp",
      "email",
      "vehicleNumber",
      "vehicleModel",
      "meterImageUrl",
      "receiptImageUrl"
    ],
    etcRecords: [
      "startTime",
      "endTime",
      "email",
      "vehicleNumber",
      "category",
      "otherReason",
      "routeStart",
      "routeEnd",
      "approvalStatus",
      "approvedBy",
      "approvedAt",
      "photoUrls"
    ],
    gpsLogs: [
      "timestamp",
      "email",
      "vehicleNumber",
      "type",
      "latitude",
      "longitude"
    ]
  };

  const keys = new Set<string>();
  priority[tab].forEach((k) => keys.add(k));
  rows.slice(0, 3).forEach((row) => {
    Object.keys(row).forEach((k) => {
      if (k !== "id") keys.add(k);
    });
  });

  const ordered = priority[tab].filter((k) => keys.has(k));
  const rest = [...keys].filter((k) => !ordered.includes(k));
  if (tab === "alcoholChecks") {
    return ordered;
  }
  const limit = tab === "drivingLogs" ? 14 : 10;
  return [...ordered, ...rest].slice(0, limit);
}

async function fetchCollection(
  name: Exclude<TabId, "vehicles" | "vehicleMileage" | "staff" | "alcoholChecks">
): Promise<Row[]> {
  return fetchAdminCollection(name, 200) as Promise<Row[]>;
}

export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("vehicles");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"load" | "action">("load");
  const [signingIn, setSigningIn] = useState(false);
  const [accessRole, setAccessRole] = useState<
    "admin" | "officer" | "none" | null
  >(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(
    null
  );
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expandedEtcId, setExpandedEtcId] = useState<string | null>(null);
  const [alcoholMonthFilter, setAlcoholMonthFilter] = useState(currentYearMonth);

  const isAdmin = accessRole === "admin";
  const isOfficer = accessRole === "officer";
  const canAccessPanel = isAdmin || isOfficer;
  const visibleTabs = isAdmin
    ? TABS
    : TABS.filter(
        (tab) =>
          tab.id === "drivingLogs" ||
          tab.id === "alcoholChecks" ||
          tab.id === "etcRecords" ||
          tab.id === "reservations"
      );

  useEffect(() => {
    const unsubPromise = initAuth(
      (u) => {
        setUser(u);
        setAuthReady(true);
      },
      () => {
        setUser(null);
        setAuthReady(true);
      }
    );
    return () => {
      void unsubPromise.then((unsub) => unsub?.());
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setAccessRole(null);
      return;
    }

    let cancelled = false;

    const rejectUnauthorized = async (email: string | null | undefined) => {
      setAccessDeniedMessage(
        `${email ?? "このアカウント"} には管理画面の権限がありません。管理者または部署の役員メールでログインしてください。`
      );
      setAccessRole("none");
      await logout();
    };

    // 管理者メールはフロントでも判定（API 未デプロイ時もログイン可能にする）
    if (isAdminEmail(user.email)) {
      setAccessDeniedMessage(null);
      setAccessRole("admin");
      return;
    }

    void fetchAccessRole()
      .then(async (result) => {
        if (cancelled) return;
        if (result.role === "officer") {
          setAccessDeniedMessage(null);
          setAccessRole("officer");
          setActiveTab("drivingLogs");
          return;
        }
        if (result.role === "admin") {
          setAccessDeniedMessage(null);
          setAccessRole("admin");
          return;
        }
        await rejectUnauthorized(user.email);
      })
      .catch(async () => {
        if (cancelled) return;
        await rejectUnauthorized(user.email);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleApproval = async (
    logId: string,
    action: "approve" | "reject"
  ) => {
    setApprovingId(logId);
    setError(null);
    try {
      if (activeTab === "drivingLogs") {
        await approveDrivingLog(logId, action);
      } else if (activeTab === "etcRecords") {
        await approveEtcRecord(logId, action);
      }
      await loadTab(activeTab);
    } catch (e: unknown) {
      setErrorKind("action");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (activeTab !== "drivingLogs") return;
    if (
      !confirm(
        "この運転記録を削除しますか？削除すると元に戻せません。"
      )
    ) {
      return;
    }
    setDeletingId(rowId);
    setError(null);
    try {
      await deleteAdminCollectionRecord("drivingLogs", rowId);
      await loadTab(activeTab);
    } catch (e: unknown) {
      setErrorKind("action");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllDrivingLogs = async () => {
    if (
      !confirm(
        `運転記録をすべて削除しますか？（${rows.length}件表示中）\nこの操作は元に戻せません。`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    setError(null);
    try {
      const deleted = await deleteAllAdminCollectionRecords("drivingLogs");
      await loadTab(activeTab);
      alert(`運転記録を ${deleted} 件削除しました。`);
    } catch (e: unknown) {
      setErrorKind("action");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkDeleting(false);
    }
  };

  const loadTab = useCallback(async (tab: TabId) => {
    setLoading(true);
    setError(null);
    try {
      if (
        tab === "drivingLogs" ||
        tab === "alcoholChecks" ||
        tab === "reservations"
      ) {
        await completeExpiredReservations({ admin: true });
      }

      if (tab === "drivingLogs" || tab === "alcoholChecks") {
        const [logs, reservations, staffMaps] = await Promise.all([
          fetchCollection("drivingLogs"),
          fetchCollection("reservations"),
          fetchStaffLookupMaps().catch(() => ({
            nameMap: new Map<string, string>(),
            sealMap: new Map<string, string>()
          }))
        ]);
        const enriched = logs.map((log) => {
          const withReservation = enrichDrivingLog(
            log as Row & DrivingLogLike,
            reservations as ReservationLike[]
          ) as Row;
          const email = String(withReservation.email ?? "").trim();
          const existingName = String(withReservation.userName ?? "").trim();
          const mappedName = getStaffDisplayName(email, staffMaps.nameMap);
          return {
            ...withReservation,
            email,
            userName: existingName || mappedName || "",
            sealImageUrl: getStaffSealImageUrl(email, staffMaps.sealMap) ?? ""
          } as Row;
        });
        if (tab === "alcoholChecks") {
          const fixed = getFixedAlcoholCheckFields();
          const alcoholRows = enriched.filter(
            (log) =>
              typeof log.alcoholCheckImageUrl === "string" &&
              log.alcoholCheckImageUrl.startsWith("http")
          );
          const toBackfill = alcoholRows.filter((log) =>
            needsAlcoholCheckBackfill(log)
          );
          setRows(alcoholRows.map((log) => ({ ...log, ...fixed }) as Row));
          if (toBackfill.length > 0) {
            void Promise.allSettled(
              toBackfill.map((log) => updateAlcoholCheck(log.id, fixed))
            );
          }
          return;
        }
        setRows(enriched);
        return;
      }

      if (tab === "refuelingRecords") {
        const [data, vehicles, drivingLogs] = await Promise.all([
          fetchCollection(tab),
          fetchVehicles(),
          fetchCollection("drivingLogs")
        ]);
        setRows(
          data.map((row) =>
            enrichRefuelingRecord(
              row,
              vehicles,
              drivingLogs as DrivingLogLike[]
            )
          )
        );
        return;
      }

      const data = await fetchCollection(tab);
      if (tab === "reservations") {
        setRows(data.filter((row) => row.status !== "cancelled"));
        return;
      }
      setRows(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorKind("load");
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !canAccessPanel) return;
    if (
      !isAdmin &&
      activeTab !== "drivingLogs" &&
      activeTab !== "alcoholChecks" &&
      activeTab !== "etcRecords" &&
      activeTab !== "reservations"
    ) {
      return;
    }
    if (
      isAdmin &&
      activeTab !== "vehicles" &&
      activeTab !== "vehicleMileage" &&
      activeTab !== "staff"
    ) {
      void loadTab(activeTab);
      return;
    }
    if (
      !isAdmin &&
      (activeTab === "drivingLogs" ||
        activeTab === "alcoholChecks" ||
        activeTab === "etcRecords" ||
        activeTab === "reservations")
    ) {
      void loadTab(activeTab);
    }
  }, [user, canAccessPanel, isAdmin, activeTab, loadTab]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setAccessDeniedMessage(null);
    try {
      await googleSignIn();
    } catch (e: unknown) {
      alert(
        "ログインに失敗しました: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setSigningIn(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <ClipboardList className="w-12 h-12 text-[#4a72b2] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">
            社用車管理 管理画面
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            ドライバーアプリから送信されたデータを確認します。
            <br />
            管理者または部署の役員のみ利用できます。
          </p>
          {accessDeniedMessage && (
            <p className="text-sm text-red-600 font-bold mb-4 whitespace-pre-wrap">
              {accessDeniedMessage}
            </p>
          )}
          <button
            onClick={() => void handleSignIn()}
            disabled={signingIn}
            className="w-full py-3 bg-[#4a72b2] text-white font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {signingIn && <Loader2 className="w-5 h-5 animate-spin" />}
            Google でログイン
          </button>
          <p className="text-xs text-slate-500 mt-4">
            @careearth.info でも、部署の役員または管理者に登録されていないアカウントは利用できません。
          </p>
        </div>
      </div>
    );
  }

  if (user && accessRole === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!canAccessPanel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const columns =
    activeTab === "vehicles" ? [] : pickColumns(rows, activeTab);

  const displayRows =
    activeTab === "alcoholChecks"
      ? rows.filter(
          (row) => yearMonthFromValue(row.startTime) === alcoholMonthFilter
        )
      : rows;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-[#4a72b2] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-lg font-bold">社用車管理 管理画面</h1>
          <p className="text-xs opacity-80">
            {user.email}
            {isOfficer ? "（上長）" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs bg-white/20 px-3 py-1.5 rounded font-bold hover:bg-white/30"
          >
            ドライバーアプリ
          </a>
          <button
            onClick={() => logout()}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30"
            title="ログアウト"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav className="w-52 bg-white border-r shrink-0 p-3 space-y-1">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                activeTab === id
                  ? "bg-[#4a72b2] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <main className="flex-1 flex flex-col min-w-0 p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorKind === "load"
                ? "データの取得に失敗しました"
                : "処理に失敗しました"}
              : {error}
              <p className="text-xs mt-2 text-red-600">
                {getAdminErrorHint(error, errorKind)}
              </p>
            </div>
          )}

          {isAdmin && activeTab === "vehicles" ? (
            <VehiclesTab onError={setError} />
          ) : isAdmin && activeTab === "vehicleMileage" ? (
            <VehicleMileageTab onError={setError} />
          ) : isAdmin && activeTab === "staff" ? (
            <StaffTab onError={setError} />
          ) : (
            <>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800">
              {visibleTabs.find((t) => t.id === activeTab)?.label ??
                TABS.find((t) => t.id === activeTab)?.label}
              <span className="text-sm font-normal text-slate-500 ml-2">
                {displayRows.length}件
                {activeTab === "alcoholChecks" &&
                  `（${formatYearMonthLabel(alcoholMonthFilter)}）`}
              </span>
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
            {activeTab === "alcoholChecks" && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <span className="font-bold whitespace-nowrap">対象月</span>
                <input
                  type="month"
                  value={alcoholMonthFilter}
                  onChange={(e) => setAlcoholMonthFilter(e.target.value)}
                  className="px-3 py-2 bg-white border rounded-lg text-sm font-bold"
                />
              </label>
            )}
            <button
              onClick={() => void loadTab(activeTab)}
              disabled={loading || bulkDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              更新
            </button>
            {isAdmin && activeTab === "drivingLogs" && rows.length > 0 && (
              <button
                onClick={() => void handleDeleteAllDrivingLogs()}
                disabled={loading || bulkDeleting || deletingId !== null}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {bulkDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                すべて削除
              </button>
            )}
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : displayRows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              {activeTab === "alcoholChecks"
                ? `${formatYearMonthLabel(alcoholMonthFilter)} の酒気帯び記録はありません`
                : "データがありません"}
            </div>
          ) : activeTab === "reservations" ? (
            <ReservationScheduleList
              reservations={rows as Array<ReservationLike & { id: string }>}
              loading={loading}
              onRefresh={() => void loadTab(activeTab)}
              showAreaFilter
              groupByArea
            />
          ) : (
            <div className="flex-1 overflow-auto bg-white rounded-xl border shadow-sm">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap"
                      >
                        {getColumnLabel(activeTab, col)}
                      </th>
                    ))}
                    {APPROVAL_TABS.has(activeTab) && (
                      <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                        承認操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => {
                    const approval = getRowApproval(activeTab, row);
                    const showApprove = canApproveRow(activeTab, row);
                    const rowClass = APPROVAL_TABS.has(activeTab)
                      ? row.status === "driving"
                        ? "border-b border-slate-100 hover:bg-slate-50"
                        : approvalRowClass(approval)
                      : `border-b border-slate-100 hover:bg-slate-50 ${
                          row.status === "completed" ? "opacity-60" : ""
                        }`;
                    return (
                    <Fragment key={row.id}>
                    <tr
                      className={`${rowClass} ${
                        activeTab === "etcRecords" ? "cursor-pointer" : ""
                      }`}
                      onClick={
                        activeTab === "etcRecords"
                          ? () =>
                              setExpandedEtcId((prev) =>
                                prev === row.id ? null : row.id
                              )
                          : undefined
                      }
                    >
                      {columns.map((col) => {
                        const val = row[col];
                        const isUrl =
                          typeof val === "string" && val.startsWith("http");
                        const mapsUrl =
                          col === "longitude" && activeTab === "gpsLogs"
                            ? buildGoogleMapsUrl(row.latitude, row.longitude)
                            : null;
                        return (
                          <td
                            key={col}
                            className={
                              activeTab === "alcoholChecks" &&
                              (isAlcoholFixedField(col) || col === "sealImageUrl")
                                ? "px-4 py-3 text-slate-800 whitespace-nowrap"
                                : "px-4 py-3 text-slate-800 max-w-xs truncate"
                            }
                          >
                            {activeTab === "alcoholChecks" &&
                            isAlcoholFixedField(col) ? (
                              FIXED_ALCOHOL_CHECK_FIELDS[col]
                            ) : activeTab === "alcoholChecks" &&
                              col === "sealImageUrl" ? (
                              isUrl ? (
                                <a
                                  href={String(val)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block"
                                  title="印鑑を表示"
                                >
                                  <img
                                    src={String(val)}
                                    alt="印鑑"
                                    className="h-10 w-10 object-contain"
                                  />
                                </a>
                              ) : (
                                <span className="text-slate-400 text-xs">
                                  未登録
                                </span>
                              )
                            ) : isUrl ? (
                              <a
                                href={val}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#4a72b2] font-bold hover:underline"
                              >
                                表示
                              </a>
                            ) : col === "photoUrls" &&
                              Array.isArray(val) &&
                              val.length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {(val as string[]).map((url, i) => (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#4a72b2] font-bold hover:underline"
                                  >
                                    {i + 1}
                                  </a>
                                ))}
                              </span>
                            ) : mapsUrl ? (
                              <span className="inline-flex items-center gap-2">
                                <span>{formatCell(col, val)}</span>
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#4a72b2] font-bold hover:underline whitespace-nowrap shrink-0"
                                >
                                  地図
                                </a>
                              </span>
                            ) : (
                              formatCell(col, val)
                            )}
                          </td>
                        );
                      })}
                      {APPROVAL_TABS.has(activeTab) && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                          {showApprove ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={approvingId === row.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleApproval(row.id, "approve");
                                }}
                                className="px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                承認
                              </button>
                              <button
                                type="button"
                                disabled={approvingId === row.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleApproval(row.id, "reject");
                                }}
                                className="px-3 py-1.5 text-xs font-bold rounded-md bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                差戻し
                              </button>
                            </div>
                          ) : approval === "approved" ? (
                            <span className="text-xs font-bold text-emerald-700">
                              承認済
                            </span>
                          ) : approval === "rejected" ? (
                            <span className="text-xs font-bold text-red-600">
                              差戻し済
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {isAdmin && activeTab === "drivingLogs" && (
                            <button
                              type="button"
                              disabled={
                                deletingId === row.id ||
                                bulkDeleting ||
                                approvingId === row.id
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteRow(row.id);
                              }}
                              className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="削除"
                            >
                              {deletingId === row.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {activeTab === "etcRecords" && expandedEtcId === row.id && (
                      <tr key={`${row.id}-detail`} className="bg-slate-50 border-b">
                        <td
                          colSpan={
                            columns.length + (APPROVAL_TABS.has(activeTab) ? 1 : 0)
                          }
                          className="px-4 py-3 text-sm text-slate-700"
                        >
                          <p className="font-bold text-slate-600 mb-1">
                            ①ICの乗り口、降り口（詳細）
                          </p>
                          <p>
                            {cell(row.routeStart)} → {cell(row.routeEnd)}
                          </p>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
