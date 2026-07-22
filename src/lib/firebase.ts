import { User } from 'firebase/auth';
import { resolveApiBaseUrl } from '../../shared/apiConfig';

let firebaseConfig: Record<string, unknown> = {};

function withApiBaseUrlFallback(
  config: Record<string, unknown>
): Record<string, unknown> {
  if (typeof window === 'undefined') return config;
  const apiBaseUrl = resolveApiBaseUrl(
    window.location.hostname,
    typeof config.apiBaseUrl === 'string' ? config.apiBaseUrl : undefined
  );
  return apiBaseUrl ? { ...config, apiBaseUrl } : config;
}

export const getFirebaseConfig = async () => {
  if (Object.keys(firebaseConfig).length > 0) return firebaseConfig;
  try {
    const response = await fetch('/firebase-applet-config.json', {
      cache: 'no-store'
    });
    if (response.ok) {
      firebaseConfig = withApiBaseUrlFallback(await response.json());
      console.log("Firebase config loaded successfully");
    } else {
      console.warn("Firebase config fetch failed with status:", response.status);
    }
  } catch (e) {
    console.error("Firebase config fetch error:", e);
    console.warn("Firebase config not found or invalid. Please set up Firebase in AI Studio.");
  }
  if (Object.keys(firebaseConfig).length === 0 && typeof window !== 'undefined') {
    firebaseConfig = withApiBaseUrlFallback({});
  }
  return firebaseConfig;
};

// Lazy initialization
let app: any;
let db: any;
let auth: any;

function toFirebaseWebConfig(
  config: Record<string, unknown>
): Record<string, string> {
  const fields = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
    "measurementId"
  ] as const;

  const webConfig: Record<string, string> = {};
  for (const field of fields) {
    const value = config[field];
    if (typeof value === "string" && value.length > 0) {
      webConfig[field] = value;
    }
  }
  return webConfig;
}

const getApp = async () => {
  if (!app) {
    const { initializeApp } = await import('firebase/app');
    const raw = await getFirebaseConfig();
    const config = toFirebaseWebConfig(raw);
    if (Object.keys(config).length === 0) {
      console.error("Firebase initialized with empty config! Auth will fail.");
    }
    app = initializeApp(config);
  }
  return app;
};

export const getDb = async () => {
  if (!db) {
    const { getFirestore } = await import('firebase/firestore');
    const config = (await getFirebaseConfig()) as any;
    const appInstance = await getApp();
    
    if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)' && config.firestoreDatabaseId !== '') {
      console.log(`Initializing Firestore with database ID: ${config.firestoreDatabaseId}`);
      db = getFirestore(appInstance, config.firestoreDatabaseId);
    } else {
      db = getFirestore(appInstance);
    }
  }
  return db;
};

export const getAuthInstance = async () => {
  if (!auth) {
    const { getAuth: fbGetAuth } = await import('firebase/auth');
    auth = fbGetAuth(await getApp());
  }
  return auth;
};

const providerPromise = import('firebase/auth').then(({ GoogleAuthProvider }) => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
});

let isSigningIn = false;

export const initAuth = async (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  const firebaseAuth = await getAuthInstance();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      onAuthSuccess?.(user as User);
    } else {
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async () => {
  try {
    isSigningIn = true;
    const firebaseAuth = await getAuthInstance();
    const provider = await providerPromise;
    const { signInWithPopup, browserPopupRedirectResolver } = await import('firebase/auth');
    const result = await signInWithPopup(firebaseAuth, provider, browserPopupRedirectResolver);
    return result.user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  const firebaseAuth = await getAuthInstance();
  await firebaseAuth.signOut();
};

/** Firebase Auth の復元完了まで待つ（Firestore ルールの isSignedIn 用） */
export const waitForAuthReady = (): Promise<User | null> => {
  return new Promise(async (resolve) => {
    const firebaseAuth = await getAuthInstance();
    const { onAuthStateChanged } = await import('firebase/auth');
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      unsub();
      resolve(user);
    });
  });
};

// ==========================================
// 追加: メール・パスワード認証関連の関数 (Lazy Load対応)
// ==========================================

export const manualSignIn = async (email: string, password: string) => {
  const firebaseAuth = await getAuthInstance();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return userCredential.user;
};

export const manualSignUp = async (email: string, password: string) => {
  const firebaseAuth = await getAuthInstance();
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  return userCredential.user;
};

export const forgotPassword = async (email: string) => {
  const firebaseAuth = await getAuthInstance();
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(firebaseAuth, email);
};
