// パスワード再設定：仮パスワードを発行して設定し、管理者の画面に表示する（メールは送らない）
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi, tempPassword } from "@/lib/adminApi";
import { T } from "@/lib/db";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: target } = await admin.from(T.profiles).select("name, is_active").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "利用者が見つかりません" }, { status: 404 });
  if (!target.is_active) return NextResponse.json({ error: "無効の利用者のパスワードは再設定できません" }, { status: 400 });

  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ name: target.name, tempPassword: password });
}
