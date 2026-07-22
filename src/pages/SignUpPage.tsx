import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { manualSignUp } from '../lib/firebase';
import { Screen } from '../types/enums';

type SignUpPageProps = {
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
};

export default function SignUpPage({ setScreen }: SignUpPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] =
    useState('');

  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] =
    useState(false);

  const handleSignUp = async () => {
    if (password !== passwordConfirm) {
      setAuthError(
        'パスワードが一致しません。'
      );
      return;
    }

    setIsAuthLoading(true);
    setAuthError('');

    try {
      await manualSignUp(email, password);

      alert("登録が完了しました。メインメニューに移動します。");
    } catch (error: any) {
      if (
        error.code ===
        'auth/email-already-in-use'
      ) {
        setAuthError(
          'このメールアドレスは既に使用されています。'
        );
      } else if (
        error.code === 'auth/weak-password'
      ) {
        setAuthError(
          'パスワードは6文字以上で入力してください。'
        );
      } else {
        setAuthError(
          '登録に失敗しました。'
        );
      }

      console.error(error);
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-8 bg-bg-app">
      <div className="m-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-main mb-6">
          新規ユーザー登録
        </h1>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-text-muted">
              メールアドレス
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="w-full h-12 px-4 mt-1 border-2 border-border-muted rounded-lg outline-none focus:border-accent-blue-light"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-text-muted">
              パスワード
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="w-full h-12 px-4 mt-1 border-2 border-border-muted rounded-lg outline-none focus:border-accent-blue-light"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-text-muted">
              パスワード (確認用)
            </label>

            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) =>
                setPasswordConfirm(
                  e.target.value
                )
              }
              className="w-full h-12 px-4 mt-1 border-2 border-border-muted rounded-lg outline-none focus:border-accent-blue-light"
            />
          </div>
        </div>

        {authError && (
          <p className="text-red-500 text-xs mt-4 text-center">
            {authError}
          </p>
        )}

        <div className="pt-8 space-y-4">
          <button
            onClick={handleSignUp}
            disabled={
              isAuthLoading ||
              !email ||
              !password ||
              !passwordConfirm
            }
            className="w-full py-3 bg-accent-blue text-white rounded-lg font-bold text-lg shadow-lg disabled:opacity-40 flex items-center justify-center"
          >
            {isAuthLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              '登録する'
            )}
          </button>

          <div className="text-center">
            <button
              onClick={() => {
                setAuthError('');
                setScreen(Screen.SIGN_IN);
              }}
              className="text-xs text-text-muted hover:underline"
            >
              ログイン画面に戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}