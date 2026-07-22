import { resolveApiBaseUrl } from "../../shared/apiConfig";
import { getAuthInstance, getFirebaseConfig } from "./firebase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let cachedApiRoot: string | null = null;

/** 本番は Cloud Run を直接呼ぶ（Hosting 経由だと認証ヘッダーが壊れるため） */
async function resolveApiRoot(): Promise<string> {
  if (cachedApiRoot !== null) return cachedApiRoot;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      const remoteApi = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "");
      if (remoteApi) {
        cachedApiRoot = remoteApi;
        return cachedApiRoot;
      }
      cachedApiRoot = "";
      return cachedApiRoot;
    }
  }

  const config = (await getFirebaseConfig()) as { apiBaseUrl?: string };
  const host =
    typeof window !== "undefined" ? window.location.hostname : "";
  cachedApiRoot = resolveApiBaseUrl(host, config.apiBaseUrl);
  if (!cachedApiRoot && host) {
    console.warn(
      "apiBaseUrl が未設定のため Hosting 経由 (/api) になります。401 の原因になります:",
      host
    );
  }
  return cachedApiRoot;
}

async function getIdToken(forceRefresh = false): Promise<string> {
  const auth = await getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError("ログインが必要です", 401);
  }
  return user.getIdToken(forceRefresh);
}

function buildRequestUrl(
  apiRoot: string,
  path: string,
  token: string,
  method: string | undefined
): string {
  const base = apiRoot || window.location.origin;
  const url = new URL(`/api${path}`, base);
  if (!method || method === "GET" || method === "HEAD") {
    url.searchParams.set("idToken", token);
  }
  return url.toString();
}

function attachTokenToBody(
  body: BodyInit | null | undefined,
  token: string
): BodyInit | undefined {
  if (body == null) return undefined;
  if (typeof body !== "string") return body;

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return JSON.stringify({ ...parsed, idToken: token });
  } catch {
    return body;
  }
}

async function sendRequest(
  path: string,
  options: RequestInit,
  forceRefresh: boolean
): Promise<Response> {
  const token = await getIdToken(forceRefresh);
  const apiRoot = await resolveApiRoot();
  const method = options.method?.toUpperCase();

  const headers = new Headers(options.headers);
  const bearer = `Bearer ${token}`;
  headers.set("Authorization", bearer);
  headers.set("X-Firebase-Authorization", bearer);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = buildRequestUrl(apiRoot, path, token, method);
  const body =
    method && method !== "GET" && method !== "HEAD"
      ? attachTokenToBody(options.body, token)
      : options.body;

  return fetch(url, {
    ...options,
    headers,
    body
  });
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let response = await sendRequest(path, options, false);
  if (response.status === 401) {
    response = await sendRequest(path, options, true);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    const payload = data as { error?: string; code?: string };
    const message = payload.code
      ? `${payload.error ?? "API error"} (${payload.code})`
      : payload.error ?? `API error (${response.status})`;
    throw new ApiError(message, response.status, payload.code);
  }

  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "DELETE",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}
