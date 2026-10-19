"use client";

// 詳細画面の操作：承認・差戻し（現在の承認者のみ）、戻る・取り下げ・編集・PDF出力
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { F } from "@/lib/db";

export function DecisionPanel({ reportId, isLast, nextName }: { reportId: string; isLast: boolean; nextName: string | null }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(ok: boolean) {
    if (!ok && !comment.trim()) return setError("差戻しの場合はコメントを入力してください。");
    const msg = ok
      ? (isLast ? "最終承認します。よろしいですか？（承認後は取り消せません）" : `承認して ${nextName ?? "次の承認者"} に回します。よろしいですか？（承認後は取り消せません）`)
      : "差戻します。よろしいですか？";
    if (!confirm(msg)) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = ok
      ? await supabase.rpc(F.approveReport, { p_report_id: reportId, p_comment: comment })
      : await supabase.rpc(F.rejectReport, { p_report_id: reportId, p_comment: comment });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/approvals");
    router.refresh();
  }

  return (
    <div className="card no-print">
      <h3 style={{ marginTop: 0 }}>承認・差戻し</h3>
      <div className="field"><label>コメント（差戻し時は必須）</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} /></div>
      {error && <p className="err">{error}</p>}
      <div className="actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn ok" disabled={busy} onClick={() => decide(true)}>承認する</button>
        <button type="button" className="btn ng" disabled={busy} onClick={() => decide(false)}>差戻す</button>
      </div>
    </div>
  );
}

export function ReportActions({ reportId, canWithdraw, canEdit }: { reportId: string; canWithdraw: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function withdraw() {
    if (!confirm("申請を取り下げて下書きに戻しますか？")) return;
    setBusy(true);
    const { error } = await createClient().rpc(F.withdrawReport, { p_report_id: reportId });
    setBusy(false);
    if (error) return setError(error.message);
    setError("");
    router.refresh();
  }

  return (
    <>
      {error && <div className="errbox no-print">{error}</div>}
      <div className="actions">
        <button type="button" className="btn" onClick={() => router.back()}>戻る</button>
        <span className="spacer" />
        {canWithdraw && <button type="button" className="btn ng" disabled={busy} onClick={withdraw}>申請を取り下げる</button>}
        {canEdit && <Link href={`/reports/${reportId}/edit`} className="btn">編集する</Link>}
        <button type="button" className="btn primary" onClick={() => print()}>PDF出力</button>
      </div>
    </>
  );
}
