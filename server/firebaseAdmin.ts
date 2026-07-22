import fs from "fs";
import path from "path";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type Credential
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type FirebaseAppletConfig = {
  projectId?: string;
  firestoreDatabaseId?: string;
};

function loadFirebaseConfig(): FirebaseAppletConfig {
  const candidates = [
    path.join(process.cwd(), "public", "firebase-applet-config.json"),
    path.join(process.cwd(), "dist", "firebase-applet-config.json"),
  ];

  for (const configPath of candidates) {
    if (!fs.existsSync(configPath)) continue;
    return JSON.parse(fs.readFileSync(configPath, "utf-8")) as FirebaseAppletConfig;
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
  };
}

const firebaseConfig = loadFirebaseConfig();
const projectId =
  firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || "ce-gr-drive-2605st";
const firestoreDatabaseId =
  firebaseConfig.firestoreDatabaseId ||
  process.env.FIRESTORE_DATABASE_ID ||
  "ai-studio-cbd9157d-bd2d-4aec-ab4a-3da5bfff1e8e";

let adminApp: App | undefined;
let adminDb: Firestore | undefined;
let credentialSource: string | undefined;

function resolveAdminCredential(): Credential | undefined {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    credentialSource = "FIREBASE_SERVICE_ACCOUNT_JSON";
    return cert(JSON.parse(inlineJson) as Record<string, string>);
  }

  const keyPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (keyPath && fs.existsSync(keyPath)) {
    credentialSource = path.basename(keyPath);
    return cert(
      JSON.parse(fs.readFileSync(keyPath, "utf-8")) as Record<string, string>
    );
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credentialSource = "GOOGLE_APPLICATION_CREDENTIALS (ADC)";
    return applicationDefault();
  }

  if (process.env.LOCAL_FIREBASE_ADC === "true") {
    credentialSource =
      "gcloud Application Default Credentials (LOCAL_FIREBASE_ADC)";
    return applicationDefault();
  }

  if (process.env.K_SERVICE || process.env.FUNCTION_TARGET) {
    credentialSource = "Cloud Run / Functions (metadata ADC)";
    return applicationDefault();
  }

  return undefined;
}

export function getAdminCredentialStatus(): {
  configured: boolean;
  source?: string;
  hint?: string;
} {
  if (!credentialSource) {
    resolveAdminCredential();
  }
  if (credentialSource) {
    return { configured: true, source: credentialSource };
  }
  return {
    configured: false,
    hint:
      "秘密鍵 JSON が使えない場合: .env に LOCAL_FIREBASE_ADC=true を設定し、gcloud auth application-default login を実行。または VITE_API_BASE_URL で本番 API を直接利用。"
  };
}

export function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else {
      const credential = resolveAdminCredential();
      adminApp = initializeApp(
        credential ? { projectId, credential } : { projectId }
      );
      if (!credential && process.env.NODE_ENV !== "production") {
        console.warn(
          "[firebase-admin] 認証情報が未設定です。管理 API のトークン検証に失敗します。\n" +
            "  方法A: .env に LOCAL_FIREBASE_ADC=true → gcloud auth application-default login\n" +
            "  方法B: .env に VITE_API_BASE_URL=本番Cloud Run URL（フロントのみローカル）\n" +
            "  方法C: GOOGLE_APPLICATION_CREDENTIALS=サービスアカウントJSONのパス"
        );
      }
    }
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    const app = getAdminApp();
    adminDb =
      firestoreDatabaseId && firestoreDatabaseId !== "(default)"
        ? getFirestore(app, firestoreDatabaseId)
        : getFirestore(app);
  }
  return adminDb;
}

export async function checkFirebaseConnection(): Promise<{
  connected: boolean;
  projectId: string;
  firestoreDatabaseId: string;
  error?: string;
}> {
  try {
    const db = getAdminDb();
    await db.collection("vehicles").limit(1).get();
    return {
      connected: true,
      projectId,
      firestoreDatabaseId,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Firebase Admin connection check failed:", message);
    return {
      connected: false,
      projectId,
      firestoreDatabaseId,
      error: message,
    };
  }
}
