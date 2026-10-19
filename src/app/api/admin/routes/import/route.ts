// 承認ルート CSV の取り込み
//   チェックと登録はデータベースの admin_import_routes 関数で行う（管理者かどうかも関数の中で確認する）
//   CSV に載っている申請者の承認ルートだけを置き換え、誤りが1件でもあれば何も取り込まない
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/adminApi";
import { F } from "@/lib/db";

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) return auth;

  const { cells } = (await req.json()) as { cells: string[][] };
  const rows = (cells ?? []).map(([applicant_email = "", step_no = "", approver_email = ""]) => ({
    applicant_email: applicant_email.toLowerCase(),
    step_no: Number(step_no),
    approver_email: approver_email.toLowerCase(),
  }));
  if (!rows.length) return NextResponse.json({ error: "CSV に取り込む行がありません" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(F.adminImportRoutes, { p_rows: rows });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ count: data });
}
