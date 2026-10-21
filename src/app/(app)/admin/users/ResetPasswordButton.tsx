"use client";

// パスワード再設定：管理者が任意のパスワードを入力して設定する（空欄なら仮パスワードを自動で作成）
// 設定したパスワードはダイアログに表示し、コピーボタンを付ける（管理者が本人に伝える）
import { useEffect, useRef, useState } from "react";
import { checkPassword, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password";

export default function ResetPasswordButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  function start() {
    setInput("");
    setError(null);
    setResult(null);
    setCopied(false);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (input) {
      const err = checkPassword(input);
      if (err) { setError(err); return; }
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: input }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) { setError(body.error ?? "再設定できませんでした"); return; }
    setResult(body.tempPassword);
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
    } catch {
      alert("コピーできませんでした。パスワードを選択してコピーしてください。");
    }
  }

  function close() {
    dialog.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button className="btn small" onClick={start}>パスワード再設定</button>
      {open && (
        <dialog ref={dialog} onClose={() => setOpen(false)} style={{ padding: 0, border: "none", borderRadius: 8, maxWidth: "90vw" }}>
          <div className="card" style={{ margin: 0, minWidth: 360 }}>
            {result === null ? (
              <form onSubmit={submit}>
                <b>{name} のパスワードを再設定します</b>
                <p className="hint">新しいパスワードを入力してください。空欄のまま「設定する」を押すと、仮パスワードを自動で作成します。設定すると今のパスワードは使えなくなります。</p>
                <input
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`${PASSWORD_MIN}～${PASSWORD_MAX}文字の半角英数字・記号`}
                  style={{ fontFamily: "Consolas, monospace", fontSize: 18, width: "100%", margin: "8px 0" }}
                />
                {error && <div className="errbox">{error}</div>}
                <div className="actions">
                  <span className="spacer" />
                  <button type="button" className="btn" onClick={close}>やめる</button>
                  <button type="submit" className="btn primary" disabled={busy}>{busy ? "設定中…" : "設定する"}</button>
                </div>
              </form>
            ) : (
              <>
                <b>{name} のパスワードを設定しました</b>
                <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
                  <input
                    readOnly
                    value={result}
                    onFocus={(e) => e.target.select()}
                    style={{ fontFamily: "Consolas, monospace", fontSize: 18, flex: 1 }}
                  />
                  <button className="btn small primary" onClick={copy}>{copied ? "コピーしました" : "コピー"}</button>
                </div>
                <p className="hint">本人に伝えてください。このダイアログを閉じると再表示できません。</p>
                <div className="actions">
                  <span className="spacer" />
                  <button className="btn" onClick={close}>閉じる</button>
                </div>
              </>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
