import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

export async function createRefuelingRecord(
  data: Record<string, unknown>
): Promise<string> {
  const result = await apiPost<{ id: string }>("/refueling-records", data);
  return result.id;
}

export async function createEtcRecord(
  data: Record<string, unknown>
): Promise<{ id: string; approvalStatus: string }> {
  return apiPost<{ id: string; approvalStatus: string }>("/etc-records", data);
}

export async function approveEtcRecord(
  logId: string,
  action: "approve" | "reject"
): Promise<void> {
  await apiPatch(`/etc-records/${logId}/approval`, { action });
}

export async function createGpsLog(
  data: Record<string, unknown>
): Promise<string> {
  const result = await apiPost<{ id: string }>("/gps-logs", data);
  return result.id;
}

export async function fetchAdminCollection(
  name: string,
  limit = 200
): Promise<Array<Record<string, unknown> & { id: string }>> {
  return apiGet(`/admin/collections/${name}?limit=${limit}`);
}

export async function deleteAdminCollectionRecord(
  name: string,
  id: string
): Promise<void> {
  await apiDelete(`/admin/collections/${name}/${id}`);
}

export async function deleteAllAdminCollectionRecords(
  name: string
): Promise<number> {
  const result = await apiDelete<{ deleted: number }>(
    `/admin/collections/${name}`
  );
  return result.deleted;
}
