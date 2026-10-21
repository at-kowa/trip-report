// 今公開されている版（コミット番号）を返す。画面側が新しい版の公開を検知するのに使う
//   ログイン前の画面からも呼ぶため、ログインの確認はしない（返すのはコミット番号だけ）
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { commit: process.env.NEXT_PUBLIC_APP_COMMIT ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
