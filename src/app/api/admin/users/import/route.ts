// 利用者 CSV の取り込み
//   既存の利用者（メールアドレスで判定）は更新し、新しい利用者は仮パスワードで認証ユーザーを作成する
//   CSV に載っていない利用者は変更しない。誤りが1件でもあれば何も取り込まない
//   状態が「無効」の利用者は、認証ユーザーを利用停止にする（ログインできなくなる）
import { NextResponse } from "next/server";
import { checkUserRows } from "@/lib/csv";
import { createAdminClient } from "@/lib/supabase/admin";
import { BAN_FOREVER, requireAdminApi, tempPassword } from "@/lib/adminApi";
import { T } from "@/lib/db";

type Result = { line: number; email: string; name: string; action: "作成" | "更新"; tempPassword?: string };

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) return auth;

  const { cells } = (await req.json()) as { cells: string[][] };
  const rows = checkUserRows(cells ?? []);
  if (!rows.length) return NextResponse.json({ error: "CSV に取り込む行がありません" }, { status: 400 });

  // 自分自身を無効にしたり、管理者から外したりすると管理できなくなるため止める
  const admin = createAdminClient();
  const { data: meRow } = await admin.from(T.profiles).select("email").eq("id", auth.userId).single();
  const self = rows.find((r) => r.email === meRow?.email);
  if (self && (!self.active || !self.roles.includes("admin"))) {
    self.errors.push("ログイン中の管理者自身を、無効にしたり管理者から外したりすることはできません");
  }
  if (rows.some((r) => r.errors.length)) {
    return NextResponse.json({ error: "CSV に誤りがあります", rows }, { status: 400 });
  }

  // 既存の認証ユーザーをメールアドレスで引けるようにする
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return NextResponse.json({ error: `利用者一覧を取得できませんでした：${error.message}` }, { status: 500 });
    data.users.forEach((u) => u.email && existing.set(u.email.toLowerCase(), u.id));
    if (data.users.length < 1000) break;
  }
  const { data: profiles } = await admin.from(T.profiles).select("id, is_active");
  const wasActive = new Map((profiles ?? []).map((p) => [p.id as string, p.is_active as boolean]));

  const results: Result[] = [];
  for (const r of rows) {
    let id = existing.get(r.email);
    let password: string | undefined;
    try {
      if (!id) {
        password = tempPassword();
        const { data, error } = await admin.auth.admin.createUser({ email: r.email, password, email_confirm: true });
        if (error || !data.user) throw new Error(error?.message ?? "認証ユーザーを作成できませんでした");
        id = data.user.id;
      }
      const { error: pErr } = await admin.from(T.profiles).upsert({
        id, email: r.email, name: r.name, plant: r.plant, dept: r.dept, roles: r.roles, is_active: r.active,
      });
      if (pErr) throw new Error(pErr.message);

      // 無効にした人は利用停止、有効に戻した人は利用停止を解除する
      if (!r.active) await admin.auth.admin.updateUserById(id, { ban_duration: BAN_FOREVER });
      else if (wasActive.get(id) === false) await admin.auth.admin.updateUserById(id, { ban_duration: "none" });

      results.push({ line: r.line, email: r.email, name: r.name, action: password ? "作成" : "更新", tempPassword: password });
    } catch (e) {
      // 途中で失敗した場合は、そこまでに処理した行と失敗した行を返す（認証ユーザーの作成は取り消せないため）
      return NextResponse.json({
        error: `${r.line} 行目（${r.email}）で失敗しました：${(e as Error).message}。それより前の行は取り込み済みです。`,
        results,
      }, { status: 500 });
    }
  }
  return NextResponse.json({ results });
}
