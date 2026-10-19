// サーバ側（画面の組み立て・API）で使う接続。ログイン中の利用者の権限で動く
import { createServerClient } from "@supabase/ssr";
import { SCHEMA } from "@/lib/db";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: SCHEMA },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // 画面の組み立て中は cookie を書けない。ログイン状態の更新は proxy.ts が行う
          }
        },
      },
    },
  );
}
