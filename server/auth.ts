import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";

import { isAdminEmail } from "./adminConfig.ts";
import { getAdminAuth } from "./firebaseAdmin.ts";

export type AuthenticatedRequest = Request & {
  user: DecodedIdToken;
};

function readSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== "__session" || rest.length === 0) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return rest.join("=");
    }
  }

  return null;
}

function readBodyIdToken(req: Request): string | null {
  if (req.method === "GET" || req.method === "HEAD") return null;
  const body = req.body as { idToken?: unknown } | undefined;
  if (body && typeof body.idToken === "string") {
    const trimmed = body.idToken.trim();
    return trimmed || null;
  }
  return null;
}

/** Hosting → Cloud Run では Authorization がサービス用トークンに置き換わることがある */
function collectIdTokenCandidates(req: Request): string[] {
  const tokens: string[] = [];
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    if (!tokens.includes(trimmed)) tokens.push(trimmed);
  };

  const headerCandidates = [
    req.headers["x-firebase-authorization"],
    req.headers.authorization,
    req.headers["x-forwarded-authorization"]
  ];

  for (const raw of headerCandidates) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value?.startsWith("Bearer ")) {
      add(value.slice(7));
    }
  }

  add(readBodyIdToken(req));

  const queryToken = req.query.idToken;
  if (typeof queryToken === "string") {
    add(queryToken);
  } else if (Array.isArray(queryToken)) {
    for (const item of queryToken) {
      if (typeof item === "string") add(item);
    }
  }

  add(readSessionCookie(req));

  return tokens;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const candidates = collectIdTokenCandidates(req);
  if (candidates.length === 0) {
    res.status(401).json({ error: "認証が必要です" });
    return;
  }

  let lastMessage = "認証トークンが無効です";
  let lastCode: string | undefined;

  for (const token of candidates) {
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      (req as AuthenticatedRequest).user = decoded;
      next();
      return;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
      lastCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : undefined;
    }
  }

  console.error("Token verification failed:", {
    message: lastMessage,
    code: lastCode,
    candidateCount: candidates.length,
    hasQueryIdToken: typeof req.query.idToken === "string",
    revision: process.env.K_REVISION ?? "local"
  });

  const missingCredentials =
    /Could not load the default credentials|credential/i.test(lastMessage);
  const isDev = process.env.NODE_ENV !== "production";

  res.status(401).json({
    error: isDev && missingCredentials
      ? "サーバー側の Firebase 認証情報が未設定です。.env に LOCAL_FIREBASE_ADC=true と gcloud auth application-default login、または VITE_API_BASE_URL で本番 API を指定してください。"
      : "認証トークンが無効です",
    ...(lastCode ? { code: lastCode } : {}),
    ...(isDev ? { details: lastMessage } : {})
  });
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = (req as AuthenticatedRequest).user;
  if (!isAdminEmail(user.email)) {
    res.status(403).json({ error: "管理者権限が必要です" });
    return;
  }
  next();
}
