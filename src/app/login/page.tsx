// ログイン画面。テスト時（環境変数 SHOW_TEST_USERS=1）だけ、テスト用の利用者一覧を下に表示する
import { ROLE_LABEL, type Role } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { T } from "@/lib/db";
import LoginForm, { type TestUser } from "./LoginForm";
import AppVersion from "@/components/AppVersion";
import UpdateNotice from "@/components/UpdateNotice";

export const dynamic = "force-dynamic";

async function loadTestUsers(): Promise<TestUser[] | null> {
  if (process.env.SHOW_TEST_USERS !== "1") return null;
  const { data } = await createAdminClient().from(T.profiles)
    .select("email, name, roles, is_active")
    .order("is_active", { ascending: false }).order("plant").order("dept").order("name");
  // 念のため、テスト用ドメイン（example.com）の利用者だけを表示する
  return ((data ?? []) as { email: string; name: string; roles: Role[]; is_active: boolean }[])
    .filter((u) => u.email.toLowerCase().endsWith("@example.com"))
    .map((u) => ({ email: u.email, name: u.name, roles: u.roles.map((r) => ROLE_LABEL[r]).join("・"), is_active: u.is_active }));
}

export default async function LoginPage() {
  return (
    <>
      <UpdateNotice />
      <LoginForm testUsers={await loadTestUsers()} />
      <AppVersion />
    </>
  );
}
