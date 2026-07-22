import type { NextFunction, Request, Response } from "express";

/** Cloud Scheduler などサーバー間ジョブ用シークレット */
export function requireJobSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.CRON_JOB_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: "CRON_JOB_SECRET が未設定です" });
    return;
  }

  const headerSecret = String(req.header("x-job-secret") ?? "").trim();
  const authHeader = String(req.header("authorization") ?? "").trim();
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const provided = headerSecret || bearer;
  if (!provided || provided !== secret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
