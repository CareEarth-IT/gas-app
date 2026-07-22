/** Cloud Run（Firebase Hosting の /api rewrite は Authorization を壊すため直接呼ぶ） */
export const CLOUD_RUN_API_BASE_URL =
  "https://gas-app-231655548437.asia-northeast1.run.app";

export const HOST_API_BASE_URLS: Record<string, string> = {
  "drive.careearth.net": CLOUD_RUN_API_BASE_URL,
  "ce-gr-drive-2605st.web.app": CLOUD_RUN_API_BASE_URL,
  "ce-gr-drive-2605st.firebaseapp.com": CLOUD_RUN_API_BASE_URL
};

export function resolveApiBaseUrl(
  hostname: string,
  configApiBaseUrl?: string
): string {
  const fromConfig = configApiBaseUrl?.trim().replace(/\/$/, "");
  if (fromConfig) return fromConfig;
  return HOST_API_BASE_URLS[hostname] ?? "";
}
