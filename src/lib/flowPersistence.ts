import { EtcStep, Screen } from "../types";

const FLOW_META_KEY = "flowDraftMeta";
const DB_NAME = "gas-app-flow";
const IMAGE_STORE = "images";
const IMAGE_KEY = "draft";

const RESTORABLE_SCREENS = new Set<Screen>([
  Screen.REFUEL_METER,
  Screen.REFUEL_RECEIPT,
  Screen.REFUEL_CONFIRM,
  Screen.ETC_START,
  Screen.ETC_IN_USE,
  Screen.ETC_ARRIVED,
  Screen.RESERVE,
  Screen.RESERVE_SCHEDULE
]);

export type ReserveDraft = {
  step: "status" | "form";
  usageArea: string;
  isPersonalUse: boolean;
  isSubstituteUse: boolean;
  substituteUntil: string;
  reserveStart: string;
  reserveEnd: string;
  allDayUse: boolean;
  reserveCategory: string;
  reservePurpose: string;
  reserveRouteStart: string;
  reserveRouteEnd: string;
};

export type FlowMeta = {
  version: 1;
  screen: Screen | null;
  etcStep: EtcStep;
  etcCategory: string;
  etcOtherReason: string;
  etcDestination: string;
  etcRouteStart: string;
  etcRouteEnd: string;
  reserve: ReserveDraft | null;
};

export type FlowImages = {
  meterImage: string | null;
  receiptImage: string | null;
  etcPhotos: string[];
};

const DEFAULT_RESERVE_DRAFT: ReserveDraft = {
  step: "status",
  usageArea: "大阪",
  isPersonalUse: false,
  isSubstituteUse: false,
  substituteUntil: "",
  reserveStart: "",
  reserveEnd: "",
  allDayUse: false,
  reserveCategory: "スタッフ送迎",
  reservePurpose: "",
  reserveRouteStart: "",
  reserveRouteEnd: ""
};

export function isRestorableFlowScreen(screen: Screen): boolean {
  return RESTORABLE_SCREENS.has(screen);
}

export function isRefuelFlowScreen(screen: Screen): boolean {
  return (
    screen === Screen.REFUEL_METER ||
    screen === Screen.REFUEL_RECEIPT ||
    screen === Screen.REFUEL_CONFIRM
  );
}

export function isEtcFlowScreen(screen: Screen): boolean {
  return (
    screen === Screen.ETC_START ||
    screen === Screen.ETC_IN_USE ||
    screen === Screen.ETC_ARRIVED
  );
}

function defaultFlowMeta(): FlowMeta {
  return {
    version: 1,
    screen: null,
    etcStep: EtcStep.START,
    etcCategory: "商談",
    etcOtherReason: "",
    etcDestination: "",
    etcRouteStart: "",
    etcRouteEnd: "",
    reserve: null
  };
}

function parseScreen(value: unknown): Screen | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (!Object.values(Screen).includes(value)) return null;
  const screen = value as Screen;
  return isRestorableFlowScreen(screen) ? screen : null;
}

function parseEtcStep(value: unknown): EtcStep {
  if (value === EtcStep.IN_USE || value === EtcStep.ARRIVED) return value;
  return EtcStep.START;
}

function parseReserveDraft(value: unknown): ReserveDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<ReserveDraft>;
  return {
    step: draft.step === "form" ? "form" : "status",
    usageArea:
      typeof draft.usageArea === "string" && draft.usageArea.trim()
        ? draft.usageArea
        : DEFAULT_RESERVE_DRAFT.usageArea,
    isPersonalUse: draft.isPersonalUse === true,
    isSubstituteUse: draft.isSubstituteUse === true,
    substituteUntil:
      typeof draft.substituteUntil === "string" ? draft.substituteUntil : "",
    reserveStart:
      typeof draft.reserveStart === "string" ? draft.reserveStart : "",
    reserveEnd: typeof draft.reserveEnd === "string" ? draft.reserveEnd : "",
    allDayUse: draft.allDayUse === true,
    reserveCategory:
      typeof draft.reserveCategory === "string" && draft.reserveCategory.trim()
        ? draft.reserveCategory
        : DEFAULT_RESERVE_DRAFT.reserveCategory,
    reservePurpose:
      typeof draft.reservePurpose === "string" ? draft.reservePurpose : "",
    reserveRouteStart:
      typeof draft.reserveRouteStart === "string" ? draft.reserveRouteStart : "",
    reserveRouteEnd:
      typeof draft.reserveRouteEnd === "string" ? draft.reserveRouteEnd : ""
  };
}

export function restoreFlowMeta(): FlowMeta {
  try {
    const raw = localStorage.getItem(FLOW_META_KEY);
    if (!raw) return defaultFlowMeta();
    const parsed = JSON.parse(raw) as Partial<FlowMeta>;
    return {
      version: 1,
      screen: parseScreen(parsed.screen),
      etcStep: parseEtcStep(parsed.etcStep),
      etcCategory:
        typeof parsed.etcCategory === "string" && parsed.etcCategory.trim()
          ? parsed.etcCategory
          : "商談",
      etcOtherReason:
        typeof parsed.etcOtherReason === "string" ? parsed.etcOtherReason : "",
      etcDestination:
        typeof parsed.etcDestination === "string" ? parsed.etcDestination : "",
      etcRouteStart:
        typeof parsed.etcRouteStart === "string" ? parsed.etcRouteStart : "",
      etcRouteEnd:
        typeof parsed.etcRouteEnd === "string" ? parsed.etcRouteEnd : "",
      reserve: parseReserveDraft(parsed.reserve)
    };
  } catch {
    return defaultFlowMeta();
  }
}

export function getRestoredFlowScreen(): Screen | null {
  return restoreFlowMeta().screen;
}

export function saveFlowMeta(meta: FlowMeta): void {
  try {
    localStorage.setItem(FLOW_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.warn("フロー状態の保存に失敗しました", error);
  }
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

export async function restoreFlowImages(): Promise<FlowImages> {
  const empty: FlowImages = {
    meterImage: null,
    receiptImage: null,
    etcPhotos: []
  };

  try {
    const db = await openImageDb();
    return await new Promise<FlowImages>((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, "readonly");
      const request = tx.objectStore(IMAGE_STORE).get(IMAGE_KEY);
      request.onsuccess = () => {
        const value = request.result as Partial<FlowImages> | undefined;
        resolve({
          meterImage:
            typeof value?.meterImage === "string" ? value.meterImage : null,
          receiptImage:
            typeof value?.receiptImage === "string" ? value.receiptImage : null,
          etcPhotos: Array.isArray(value?.etcPhotos)
            ? value.etcPhotos.filter((item) => typeof item === "string")
            : []
        });
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("フロー画像の復元に失敗しました", error);
    return empty;
  }
}

export async function saveFlowImages(images: FlowImages): Promise<void> {
  try {
    const db = await openImageDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, "readwrite");
      const request = tx.objectStore(IMAGE_STORE).put(images, IMAGE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("フロー画像の保存に失敗しました", error);
  }
}

export async function clearFlowImages(): Promise<void> {
  try {
    const db = await openImageDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, "readwrite");
      const request = tx.objectStore(IMAGE_STORE).delete(IMAGE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("フロー画像の削除に失敗しました", error);
  }
}

export function clearFlowMeta(): void {
  localStorage.removeItem(FLOW_META_KEY);
}

export async function clearRefuelDraft(): Promise<void> {
  const meta = restoreFlowMeta();
  const images = await restoreFlowImages();
  saveFlowMeta({
    ...meta,
    screen:
      meta.screen && isRefuelFlowScreen(meta.screen) ? null : meta.screen
  });
  await saveFlowImages({
    meterImage: null,
    receiptImage: null,
    etcPhotos: images.etcPhotos
  });
}

export async function clearEtcDraft(): Promise<void> {
  const meta = restoreFlowMeta();
  const images = await restoreFlowImages();
  saveFlowMeta({
    ...meta,
    screen: meta.screen && isEtcFlowScreen(meta.screen) ? null : meta.screen,
    etcStep: EtcStep.START,
    etcCategory: "商談",
    etcOtherReason: "",
    etcDestination: "",
    etcRouteStart: "",
    etcRouteEnd: ""
  });
  await saveFlowImages({
    meterImage: images.meterImage,
    receiptImage: images.receiptImage,
    etcPhotos: []
  });
}

export function clearReserveDraft(): void {
  const meta = restoreFlowMeta();
  saveFlowMeta({
    ...meta,
    screen: meta.screen === Screen.RESERVE ? null : meta.screen,
    reserve: null
  });
}

export async function clearAllFlowDrafts(): Promise<void> {
  clearFlowMeta();
  await clearFlowImages();
}

export async function clearFlowForScreen(screen: Screen): Promise<void> {
  if (isRefuelFlowScreen(screen)) {
    await clearRefuelDraft();
    return;
  }
  if (isEtcFlowScreen(screen)) {
    await clearEtcDraft();
    return;
  }
  if (screen === Screen.RESERVE) {
    clearReserveDraft();
    return;
  }
  if (screen === Screen.RESERVE_SCHEDULE) {
    const meta = restoreFlowMeta();
    if (meta.screen === Screen.RESERVE_SCHEDULE) {
      saveFlowMeta({ ...meta, screen: null });
    }
  }
}
