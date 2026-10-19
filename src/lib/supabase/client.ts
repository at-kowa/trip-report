// ブラウザ側で使う接続（ログイン中の利用者の権限で動く。データは RLS で守られる）
import { createBrowserClient } from "@supabase/ssr";
import { SCHEMA } from "@/lib/db";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: SCHEMA } },
  );
}
