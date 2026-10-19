// 利用者・承認ルート（管理者のみ）
import Link from "next/link";
import { ROLE_LABEL, requireRole, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CsvImport from "./CsvImport";
import ResetPasswordButton from "./ResetPasswordButton";
import { T } from "@/lib/db";

type UserRow = { id: string; name: string; email: string; plant: string; dept: string; roles: Role[]; is_active: boolean };
type RouteRow = { applicant_id: string; step_no: number; approver_id: string };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("admin");
  const tab = (await searchParams).tab === "routes" ? "routes" : "users";

  // メールアドレスは一般の利用者には見せないため、管理者向けにサーバ側で取得する
  const admin = createAdminClient();
  const { data: users } = await admin.from(T.profiles)
    .select("id, name, email, plant, dept, roles, is_active")
    .order("plant").order("dept").order("name");
  const list = (users ?? []) as UserRow[];
  const byId = new Map(list.map((u) => [u.id, u]));

  let routes: [UserRow, UserRow[]][] = [];
  if (tab === "routes") {
    const { data } = await admin.from(T.approvalRoutes).select("applicant_id, step_no, approver_id").order("step_no");
    const grouped = new Map<string, UserRow[]>();
    ((data ?? []) as RouteRow[]).forEach((r) => {
      const a = byId.get(r.approver_id);
      if (a) grouped.set(r.applicant_id, [...(grouped.get(r.applicant_id) ?? []), a]);
    });
    routes = [...grouped].map(([k, v]) => [byId.get(k)!, v] as [UserRow, UserRow[]]).filter(([u]) => u);
  }

  return (
    <>
      <h2>利用者・承認ルート</h2>
      <div className="tabs">
        <Link href="/admin/users" className={tab === "users" ? "on" : ""}>利用者</Link>
        <Link href="/admin/users?tab=routes" className={tab === "routes" ? "on" : ""}>承認ルート</Link>
      </div>

      {tab === "users" ? (
        <table className="list">
          <thead>
            <tr><th>氏名</th><th>メールアドレス</th><th>工場</th><th>部署</th><th>役割</th><th>状態</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} style={u.is_active ? undefined : { color: "var(--gray)" }}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.plant}</td><td>{u.dept}</td>
                <td>{u.roles.map((r) => ROLE_LABEL[r]).join("・")}</td>
                <td>{u.is_active ? <span className="st approved">有効</span> : <span className="st draft">無効</span>}</td>
                <td>{u.is_active && <ResetPasswordButton id={u.id} name={u.name} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="list">
          <thead><tr><th>営業担当者</th><th>承認ルート</th></tr></thead>
          <tbody>
            {routes.length ? routes.map(([u, steps]) => (
              <tr key={u.id}><td>{u.name}</td><td>{steps.map((s) => s.name).join(" → ")}</td></tr>
            )) : <tr><td colSpan={2} className="hint">承認ルートはまだ登録されていません</td></tr>}
          </tbody>
        </table>
      )}

      <CsvImport kind={tab} />
    </>
  );
}
