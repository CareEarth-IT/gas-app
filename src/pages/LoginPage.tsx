import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { manualSignIn, forgotPassword } from "../lib/firebase";
import { FORCE_SESSION_TAKEOVER_KEY } from "../lib/userSession";
import { Screen } from "../types/enums";

const SESSION_BLOCKED_MESSAGE =
  "すでに別の端末でログイン中です。先にそちらでログアウトしてから、再度お試しください。";

type LoginPageProps = {
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  sessionBlockMessage: string | null;
  onClearSessionBlockMessage: () => void;
};

export default function LoginPage({
  setScreen,
  sessionBlockMessage,
  onClearSessionBlockMessage
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    if (!sessionBlockMessage) return;
    setAuthError(sessionBlockMessage);
    setIsAuthLoading(false);
    onClearSessionBlockMessage();
  }, [sessionBlockMessage, onClearSessionBlockMessage]);

  const handleSignIn = async (forceTakeover = false) => {
    setIsAuthLoading(true);
    setAuthError("");

    try {
      if (forceTakeover) {
        sessionStorage.setItem(FORCE_SESSION_TAKEOVER_KEY, "1");
      }
      await manualSignIn(email, password);
    } catch (error: unknown) {
      sessionStorage.removeItem(FORCE_SESSION_TAKEOVER_KEY);
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : undefined;

      if (code === "auth/too-many-requests") {
        setAuthError(
          "ログイン試行が多すぎます。しばらくしてから再度お試しください。"
        );
      } else if (code === "auth/network-request-failed") {
        setAuthError("ネットワークエラーです。接続を確認してください。");
      } else if (code === "auth/invalid-email") {
        setAuthError("ログインIDの形式が正しくありません。");
      } else {
        setAuthError("メールアドレスまたはパスワードが違います。");
      }
      setIsAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert(
        "パスワードをリセットするには、メールアドレスを入力してください。"
      );
      return;
    }

    try {
      await forgotPassword(email);
      alert("パスワードリセット用のメールを送信しました。");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      alert("メール送信に失敗しました: " + message);
    }
  };

  return (
    <div className="flex flex-col h-full p-8 bg-bg-app">
      <div className="m-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-text-main mb-6">
          初回認証
        </h1>

        <div className="space-y-6 bg-white p-6 rounded-lg border border-border-muted">
          <div className="grid grid-cols-4 items-center">
            <label
              htmlFor="email-input"
              className="col-span-1 text-sm font-semibold text-text-main"
            >
              ID
            </label>

            <div className="col-span-3">
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3 border-2 bg-slate-100 border-border-muted rounded-md outline-none focus:border-accent-blue-light"
              />

              <p className="text-[10px] text-text-muted mt-1">
                社員はメールアドレス / アルバイト:カスタムユーザーID
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center">
            <label
              htmlFor="password-input"
              className="col-span-1 text-sm font-semibold text-text-main"
            >
              Pass
            </label>

            <div className="col-span-3">
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3 border-2 bg-slate-100 border-border-muted rounded-md outline-none focus:border-accent-blue-light"
              />
            </div>
          </div>
        </div>

        {authError && (
          <p className="text-red-500 text-xs mt-4 text-center">{authError}</p>
        )}

        {authError === SESSION_BLOCKED_MESSAGE && (
          <button
            type="button"
            onClick={() => void handleSignIn(true)}
            disabled={isAuthLoading || !email || !password}
            className="w-full mt-3 py-3 bg-slate-700 text-white rounded-lg font-bold text-sm shadow disabled:opacity-40"
          >
            この端末でログイン（他端末をログアウト）
          </button>
        )}

        <div className="pt-8 space-y-4">
          <button
            onClick={() => void handleSignIn()}
            disabled={isAuthLoading || !email || !password}
            className="w-full py-3 bg-accent-blue-light text-white rounded-lg font-bold text-lg shadow-lg disabled:opacity-40 flex items-center justify-center"
          >
            {isAuthLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "Login"
            )}
          </button>

          <div className="text-center mt-6">
            <button
              onClick={() => {
                setAuthError("");
                setScreen(Screen.SIGN_UP);
              }}
              className="text-sm text-accent-blue-light font-bold hover:underline"
            >
              新規登録はこちら
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={() => void handleForgotPassword()}
              className="text-xs text-text-muted hover:underline"
            >
              パスワードを忘れた場合
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
