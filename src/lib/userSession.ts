import { ApiError, apiDelete, apiGet, apiPost } from "./api";

export const SESSION_STALE_MS = 30 * 60 * 1000;
export const SESSION_HEARTBEAT_MS = 5 * 60 * 1000;
export const SESSION_POLL_MS = 30 * 1000;

export type UserSessionDoc = {
  email: string;
  sessionId: string;
  updatedAt?: unknown;
};

export const FORCE_SESSION_TAKEOVER_KEY = "forceSessionTakeover";

export class SessionBlockedError extends Error {
  constructor() {
    super(
      "すでに別の端末でログイン中です。先にそちらでログアウトしてから、再度お試しください。"
    );
    this.name = "SessionBlockedError";
  }
}

function sessionStorageKey(uid: string): string {
  return `appSessionId_${uid}`;
}

export function getLocalSessionId(uid: string): string | null {
  return localStorage.getItem(sessionStorageKey(uid));
}

export function getOrCreateLocalSessionId(uid: string): string {
  const existing = getLocalSessionId(uid);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(sessionStorageKey(uid), id);
  return id;
}

export function clearLocalSessionId(uid: string): void {
  localStorage.removeItem(sessionStorageKey(uid));
}

export async function assertCanLogin(
  _db: unknown,
  _uid: string,
  localSessionId: string
): Promise<void> {
  try {
    await apiPost("/sessions/claim", { sessionId: localSessionId });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === "session_blocked"
    ) {
      throw new SessionBlockedError();
    }
    throw error;
  }
}

export async function claimUserSession(
  _db: unknown,
  _uid: string,
  _email: string,
  sessionId: string,
  force = false
): Promise<void> {
  try {
    await apiPost("/sessions/claim", { sessionId, ...(force ? { force: true } : {}) });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === "session_blocked"
    ) {
      throw new SessionBlockedError();
    }
    throw error;
  }
}

export async function touchUserSession(
  _db: unknown,
  _uid: string,
  sessionId: string
): Promise<void> {
  await apiPost("/sessions/heartbeat", { sessionId });
}

export async function clearUserSession(
  _db: unknown,
  _uid: string,
  sessionId: string
): Promise<void> {
  await apiDelete(`/sessions?sessionId=${encodeURIComponent(sessionId)}`);
}

export function watchUserSession(
  _db: unknown,
  _uid: string,
  localSessionId: string,
  onInvalidated: () => void
): () => void {
  let cancelled = false;

  const poll = async () => {
    if (cancelled) return;
    try {
      const result = await apiGet<{ valid: boolean }>(
        `/sessions/status?sessionId=${encodeURIComponent(localSessionId)}`
      );
      if (!result.valid) {
        onInvalidated();
      }
    } catch (error) {
      console.warn("セッション確認に失敗しました", error);
    }
  };

  void poll();
  const timer = setInterval(() => {
    void poll();
  }, SESSION_POLL_MS);

  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

export async function getRemoteSession(
  _db: unknown,
  _uid: string
): Promise<UserSessionDoc | null> {
  return null;
}
