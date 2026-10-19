"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

const REASON: Record<string, string> = {
  idle: "操作がなかったため、自動でログアウトしました。もう一度ログインしてください。",
  inactive: "この利用者は無効になっているか、登録されていないため、ログインできません。",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reason = REASON[params.get("reason") ?? ""];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      // 利用停止（無効）の利用者は、認証の段階で拒否される
      setError(/banned/i.test(error.message)
        ? REASON.inactive
        : "メールアドレスまたはパスワードが正しくありません。");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="login card" onSubmit={onSubmit}>
      <h2>出張報告システム</h2>
      {reason && <p className="err">{reason}</p>}
      <div className="field">
        <label htmlFor="email">メールアドレス</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">パスワード</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="err">{error}</p>}
      <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
        {busy ? "ログイン中…" : "ログイン"}
      </button>
      <p className="hint">パスワードを忘れた場合は、管理者に再設定を依頼してください。</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
