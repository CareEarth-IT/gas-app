import type { NextFunction, Request, Response } from "express";

const ALLOWED_ORIGINS = new Set([
  "https://drive.careearth.net",
  "https://ce-gr-drive-2605st.web.app",
  "https://ce-gr-drive-2605st.firebaseapp.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-Firebase-Authorization"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  }

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}
