import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import type { Department, EmploymentType, StaffProfile } from "../../shared/staffTypes";

export type DepartmentRecord = Department & { id: string };
export type StaffProfileRecord = StaffProfile & { id: string };

export async function fetchDepartments(): Promise<DepartmentRecord[]> {
  return apiGet("/admin/departments");
}

export async function saveDepartment(
  id: string | null,
  data: Omit<Department, "id">
): Promise<{ id: string }> {
  if (id) {
    await apiPut(`/admin/departments/${id}`, data);
    return { id };
  }
  return apiPost("/admin/departments", data);
}

export async function deleteDepartment(id: string): Promise<void> {
  await apiDelete(`/admin/departments/${id}`);
}

export async function fetchStaffProfiles(): Promise<StaffProfileRecord[]> {
  return apiGet("/admin/staff-profiles");
}

export async function saveStaffProfile(
  data: Omit<StaffProfile, "id">
): Promise<void> {
  const email = data.email.trim().toLowerCase();
  await apiPut(`/admin/staff-profiles/${encodeURIComponent(email)}`, data);
}

export async function deleteStaffProfile(email: string): Promise<void> {
  await apiDelete(
    `/admin/staff-profiles/${encodeURIComponent(email.trim().toLowerCase())}`
  );
}

export type { EmploymentType };
