import { useEffect, useRef } from "react";

import {
  getLocalSessionId,
  SESSION_HEARTBEAT_MS,
  touchUserSession,
  watchUserSession
} from "../lib/userSession";

type Options = {
  uid: string | null;
  onForcedLogout: () => void;
};

/** ログイン中セッションの監視とハートビート */
export function useUserSession({ uid, onForcedLogout }: Options) {
  const onForcedLogoutRef = useRef(onForcedLogout);
  onForcedLogoutRef.current = onForcedLogout;

  useEffect(() => {
    if (!uid) return;

    const localSessionId = getLocalSessionId(uid);
    if (!localSessionId) return;

    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    const unsub = watchUserSession(null, uid, localSessionId, () => {
      onForcedLogoutRef.current();
    });

    void touchUserSession(null, uid, localSessionId);

    heartbeatTimer = setInterval(() => {
      void touchUserSession(null, uid, localSessionId);
    }, SESSION_HEARTBEAT_MS);

    return () => {
      unsub();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [uid]);
}
