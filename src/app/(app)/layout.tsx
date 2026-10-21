// ログイン後の画面の共通部分（メニュー・件数バッジ・自動ログアウト）
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppVersion from "@/components/AppVersion";
import IdleLogout from "@/components/IdleLogout";
import LogoutButton from "@/components/LogoutButton";
import NavLinks, { type NavItem } from "@/components/NavLinks";
import UpdateNotice from "@/components/UpdateNotice";
import { F } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data: counts } = await supabase.rpc(F.myCounts).single<{ pending_count: number; rejected_count: number }>();

  const items: NavItem[] = [];
  if (me.roles.includes("applicant")) items.push({ href: "/my", label: "自分の報告書", count: counts?.rejected_count });
  if (me.roles.includes("approver")) items.push({ href: "/approvals", label: "承認対応", count: counts?.pending_count });
  items.push({ href: "/dashboard", label: "ダッシュボード" });
  if (me.roles.includes("sysadmin")) items.push({ href: "/all", label: "全報告書" });
  if (me.roles.includes("admin")) items.push({ href: "/admin/users", label: "利用者・承認ルート" });

  return (
    <>
      <header className="app-header">
        <span className="app">出張報告システム</span>
        <NavLinks items={items} />
        <span className="me">
          {me.name}
          <LogoutButton />
        </span>
      </header>
      <IdleLogout />
      <UpdateNotice />
      <main>{children}</main>
      <AppVersion />
    </>
  );
}
