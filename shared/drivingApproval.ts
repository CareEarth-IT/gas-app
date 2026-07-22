export type ApprovalStatus = "pending" | "approved" | "rejected";

/** @deprecated ApprovalStatus と同じ */
export type DrivingApprovalStatus = ApprovalStatus;

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  pending: "承認待ち",
  approved: "承認済",
  rejected: "差戻し"
};

/** @deprecated APPROVAL_LABELS と同じ */
export const DRIVING_APPROVAL_LABELS = APPROVAL_LABELS;

export function getApprovalStatus(record: {
  approvalStatus?: unknown;
}): ApprovalStatus {
  const raw = record.approvalStatus;
  if (raw === "approved" || raw === "rejected" || raw === "pending") {
    return raw;
  }
  return "pending";
}

export function isApproved(record: { approvalStatus?: unknown }): boolean {
  return getApprovalStatus(record) === "approved";
}

export function getDrivingApprovalStatus(log: {
  status?: string;
  approvalStatus?: unknown;
}): ApprovalStatus | null {
  if (log.status !== "reported") return null;
  return getApprovalStatus(log);
}

/** 上長承認済みとして認められる運転報告か */
export function isDrivingLogRecognized(log: {
  status?: string;
  approvalStatus?: unknown;
}): boolean {
  return log.status === "reported" && isApproved(log);
}

/** 上長承認済みとして認められる ETC 記録か */
export function isEtcRecordRecognized(record: {
  approvalStatus?: unknown;
}): boolean {
  return isApproved(record);
}

export function approvalRowClass(
  approval: ApprovalStatus | null
): string {
  if (!approval) {
    return "border-b border-slate-100 hover:bg-slate-50";
  }
  if (approval === "pending") {
    return "border-b border-amber-200 bg-amber-50 hover:bg-amber-100";
  }
  if (approval === "rejected") {
    return "border-b border-red-200 bg-red-50 hover:bg-red-100";
  }
  return "border-b border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50";
}
