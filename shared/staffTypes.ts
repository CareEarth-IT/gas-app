import type { DepartmentOfficer } from "./departmentOfficers.ts";

/** 社員 / アルバイト */
export type EmploymentType = "employee" | "part_time";

export type { DepartmentOfficer };

export type Department = {
  id?: string;
  name: string;
  /** 所属部署の役員（氏名・メール） */
  officers: DepartmentOfficer[];
  /** 酒気帯び確認記録表などに表示する印鑑画像 URL */
  sealImageUrl?: string;
  /** @deprecated officers を使用。既存データ読み取り用 */
  officerEmails?: string[];
};

export type StaffProfile = {
  id?: string;
  /** Firebase Auth のログイン ID（メールまたはカスタム ID） */
  email: string;
  name?: string;
  employmentType: EmploymentType;
  /** departments コレクションのドキュメント ID（主所属・後方互換） */
  departmentId?: string;
  /** 複数所属がある場合の部署 ID 一覧 */
  departmentIds?: string[];
  /** true のとき運転報告は上長承認なし（自動承認） */
  skipDrivingApproval?: boolean;
  /** true のとき ETC 利用は上長承認なし（自動承認） */
  skipEtcApproval?: boolean;
};

const EMPLOYEE_EMAIL_SUFFIX = "@careearth.info";

/** staffProfiles 未登録時の推定（社員ドメイン → 社員、それ以外 → アルバイト） */
export function inferEmploymentType(email: string): EmploymentType {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith(EMPLOYEE_EMAIL_SUFFIX)) {
    return "employee";
  }
  return "part_time";
}
