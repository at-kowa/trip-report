"use client";

// パスワード再設定：仮パスワードを発行して表示する（管理者が本人に伝える）
export default function ResetPasswordButton({ id, name }: { id: string; name: string }) {
  async function reset() {
    if (!confirm(`${name} のパスワードを再設定しますか？今のパスワードは使えなくなります。`)) return;
    const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) { alert(body.error ?? "再設定できませんでした"); return; }
    alert(`${body.name} の仮パスワードを発行しました：\n\n${body.tempPassword}\n\n本人に伝えてください。この画面を閉じると再表示できません。`);
  }
  return <button className="btn small" onClick={reset}>パスワード再設定</button>;
}
