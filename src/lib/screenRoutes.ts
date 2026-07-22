import { Screen } from "../types";

/** 画面 → URL パス（階層） */
const SCREEN_PATH_ENTRIES: ReadonlyArray<readonly [Screen, string]> = [
  [Screen.SIGN_IN, "/login"],
  [Screen.SIGN_UP, "/signup"],
  [Screen.MAIN_MENU, "/menu"],
  [Screen.DRIVING_START_ALCOHOL, "/drive/alcohol"],
  [Screen.DRIVING_START_FUEL, "/drive/fuel"],
  [Screen.DRIVING_START_MILEAGE, "/drive/mileage"],
  [Screen.REFUEL_METER, "/refuel/meter"],
  [Screen.REFUEL_RECEIPT, "/refuel/receipt"],
  [Screen.REFUEL_CONFIRM, "/refuel/confirm"],
  [Screen.REFUEL_COMPLETE, "/refuel/complete"],
  [Screen.ETC_START, "/etc"],
  [Screen.ETC_IN_USE, "/etc/in-use"],
  [Screen.ETC_ARRIVED, "/etc/arrived"],
  [Screen.RESERVE, "/reserve"],
  [Screen.RESERVE_SCHEDULE, "/reserve/schedule"],
  [Screen.DRIVING_LOG, "/driving-log"],
  [Screen.MILEAGE_CONFIRM, "/mileage-confirm"]
];

/** 車両予約フォーム（利用状況一覧 `/reserve` の1階層下） */
export const RESERVE_FORM_PATH = "/reserve/form";

export const SCREEN_PATHS: Record<Screen, string> = Object.fromEntries(
  SCREEN_PATH_ENTRIES
) as Record<Screen, string>;

const PATH_TO_SCREEN = new Map<string, Screen>(
  SCREEN_PATH_ENTRIES.map(([screen, path]) => [path, screen])
);

/** `/menu/` のような末尾スラッシュを正規化 */
export function normalizeAppPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

export function pathForScreen(screen: Screen): string {
  return SCREEN_PATHS[screen] ?? "/menu";
}

export function screenFromPath(pathname: string): Screen | null {
  const path = normalizeAppPath(pathname);
  if (path === "/" || path === "/index.html") return null;
  if (path === "/admin" || path.startsWith("/admin/")) return null;

  const exact = PATH_TO_SCREEN.get(path);
  if (exact != null) return exact;

  // `/reserve/form` など予約配下（`/reserve/schedule` は exact で先に解決）
  if (path === RESERVE_FORM_PATH || path.startsWith("/reserve/")) {
    return Screen.RESERVE;
  }

  return null;
}

/** QR の mode クエリがある間は URL 画面同期を保留 */
export function hasQrModeQuery(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("mode");
}

export function replaceScreenUrl(screen: Screen): void {
  if (typeof window === "undefined") return;
  if (hasQrModeQuery()) return;

  const nextPath = pathForScreen(screen);
  const url = new URL(window.location.href);
  const current = normalizeAppPath(url.pathname);

  // `/reserve/form` など画面内の下位パスは維持する
  if (current === nextPath || current.startsWith(`${nextPath}/`)) return;

  url.pathname = nextPath;
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({ screen }, "", next);
}

export function replacePathname(pathname: string): void {
  if (typeof window === "undefined") return;
  if (hasQrModeQuery()) return;

  const nextPath = normalizeAppPath(pathname);
  const url = new URL(window.location.href);
  if (normalizeAppPath(url.pathname) === nextPath) return;

  url.pathname = nextPath;
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}
