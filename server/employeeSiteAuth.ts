import type { NextFunction, Request, Response } from "express";

import type { EmploymentType } from "../shared/staffTypes.ts";

export function requireEmployeeSiteSync(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.EMPLOYEE_SITE_SYNC_SECRET?.trim();
  if (!secret) {
    res.status(503).json({
      error: "Employee site sync is not configured on drive API"
    });
    return;
  }

  const headerSecret = String(req.header("x-employee-site-secret") ?? "").trim();
  const authHeader = String(req.header("authorization") ?? "").trim();
  const bearer =
    authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const provided = headerSecret || bearer;
  if (!provided || provided !== secret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

export type EmployeeSiteStaffInput = {
  email?: string;
  name?: string;
  employmentType?: EmploymentType | string;
  departmentId?: string;
  departmentName?: string;
};

export function normalizeEmployeeSiteStaffPayload(
  body: unknown
): EmployeeSiteStaffInput[] {
  if (!body || typeof body !== "object") return [];

  const record = body as Record<string, unknown>;
  if (Array.isArray(record.staff)) {
    return record.staff.filter(
      (item): item is EmployeeSiteStaffInput =>
        !!item && typeof item === "object"
    );
  }

  if (typeof record.email === "string") {
    return [record as EmployeeSiteStaffInput];
  }

  return [];
}
