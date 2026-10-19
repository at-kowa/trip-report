// 管理者権限の接続（認証ユーザーの作成・利用停止・パスワード再設定に使う）
// RLS を通らないため、サーバ側の管理者向け処理だけで使う。ブラウザ側から読み込むとビルドエラーになる
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SCHEMA } from "@/lib/db";

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません（.env.local を確認してください）");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: SCHEMA },
  });
}
