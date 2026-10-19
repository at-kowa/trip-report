// ログイン中の利用者と役割の取得
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { T } from "@/lib/db";

export type Role = "applicant" | "approver" | "admin" | "sysadmin";

export type Profile = {
  id: string;
  name: string;
  plant: string;
  dept: string;
  roles: Role[];
  is_active: boolean;
};

export const ROLE_LABEL: Record<Role, string> = {
  applicant: "申請者",
  approver: "承認者",
  admin: "管理者",
  sysadmin: "システム管理者",
};

// ログイン中の利用者を返す。未ログイン・無効・利用者として未登録ならログイン画面へ
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from(T.profiles)
    .select("id, name, plant, dept, roles, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!data || !data.is_active) redirect("/login?reason=inactive");
  return data as Profile;
}

export async function requireRole(role: Role): Promise<Profile> {
  const me = await requireProfile();
  if (!me.roles.includes(role)) redirect("/");
  return me;
}

// ログイン後の最初の画面：申請者は自分の報告書、承認のみの人は承認対応、それ以外はダッシュボード
export function homePath(me: Profile): string {
  if (me.roles.includes("applicant")) return "/my";
  if (me.roles.includes("approver")) return "/approvals";
  return "/dashboard";
}
