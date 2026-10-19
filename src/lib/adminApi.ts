// 管理者向け API の共通処理
import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { T } from "@/lib/db";

// 呼び出した人が有効な管理者かを確認する。管理者でなければエラーの応答を返す
export async function requireAdminApi(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  const { data: me } = await supabase.from(T.profiles).select("roles, is_active").eq("id", user.id).maybeSingle();
  if (!me || !me.is_active || !(me.roles as string[]).includes("admin")) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  return { userId: user.id };
}

// 仮パスワード（英数字12文字。紛らわしい文字 0 O 1 l I は使わない）
export function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(randomBytes(12), (b) => chars[b % chars.length]).join("");
}

// 利用停止の期間（実質無期限）
export const BAN_FOREVER = "876000h";
