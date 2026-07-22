import { useEffect } from "react";

import {
  hasQrModeQuery,
  replaceScreenUrl,
  screenFromPath
} from "../lib/screenRoutes";
import { Screen } from "../types";

type Options = {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  /** 認証・初期化完了後に true */
  enabled: boolean;
};

/**
 * 画面状態と URL パスを同期する。
 * - 画面変更 → history.replaceState でパス更新
 * - ブラウザ戻る/進む → パスから画面復元
 */
export function useScreenUrlSync({ screen, setScreen, enabled }: Options): void {
  useEffect(() => {
    if (!enabled || hasQrModeQuery()) return;
    replaceScreenUrl(screen);
  }, [screen, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onPopState = () => {
      if (hasQrModeQuery()) return;
      const fromPath = screenFromPath(window.location.pathname);
      if (fromPath != null && fromPath !== screen) {
        setScreen(fromPath);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled, screen, setScreen]);
}
