// 承認対応
//   承認待ち：自分の順番が来ている報告書のみ。提出から7日以上たったものは行の色と経過日数で強調する
//   対応済み：過去に自分が承認・差戻しした報告書（今また自分の順番が来ているものは承認待ちに出す）
//   一括承認は設けない（1件ずつ詳細画面で内容を確認して承認する）
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ACTION_LABEL, dateTimeText, periodText, type ReportStatus } from "@/lib/report";
import { T } from "@/lib/db";
import StatusTag from "@/components/StatusTag";
import RowLink from "@/components/RowLink";

const STALE_DAYS = 7;   // 提出からこの日数を過ぎた承認待ちを強調表示

type Row = {
  id: string;
  owner_id: string;
  start_date: string | null;
  end_date: string | null;
  status: ReportStatus;
  current_step: number | null;
  submitted_at: string | null;
  visits: { customer_name: string; sort_order: number }[];
  report_route_steps: { step_no: number; approver_id: string }[];
  mine?: { action: string; created_at: string };   // 対応済み：自分の最後の承認・差戻し
};

const COLUMNS = `id, owner_id, start_date, end_date, status, current_step, submitted_at, visits:${T.visits}(customer_name, sort_order), report_route_steps:${T.reportRouteSteps}(step_no, approver_id)`;

function daysSince(ts: string) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

export default async function Approvals({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "done" ? "done" : "wait";
  const me = await requireRole("approver");
  const supabase = await createClient();

  const isMyTurn = (r: Row) =>
    r.status === "pending" && r.report_route_steps.some((s) => s.step_no === r.current_step && s.approver_id === me.id);

  // 承認待ち（件数はタブにも出すので、どちらのタブでも取得する）
  const { data: pendingData, error: pErr } = await supabase.from(T.reports).select(COLUMNS)
    .eq("status", "pending").order("submitted_at", { ascending: true });
  const waiting = ((pendingData ?? []) as unknown as Row[]).filter(isMyTurn);

  // 対応済み：自分の承認・差戻しの履歴から報告書を引く
  let done: Row[] = [];
  let dErr = null;
  if (tab === "done") {
    const { data: hist, error } = await supabase.from(T.approvalHistory).select("report_id, action, created_at")
      .eq("actor_id", me.id).in("action", ["approve", "reject"]).order("created_at", { ascending: false });
    dErr = error;
    const latest = new Map<string, { action: string; created_at: string }>();
    for (const h of hist ?? []) if (!latest.has(h.report_id)) latest.set(h.report_id, h);
    if (latest.size) {
      const { data, error: rErr } = await supabase.from(T.reports).select(COLUMNS).in("id", [...latest.keys()]);
      dErr = dErr ?? rErr;
      done = ((data ?? []) as unknown as Row[]).filter((r) => !isMyTurn(r))
        .map((r) => ({ ...r, mine: latest.get(r.id) }))
        .sort((a, b) => (b.mine?.created_at ?? "").localeCompare(a.mine?.created_at ?? ""));
    }
  }

  const rows = tab === "wait" ? waiting : done;
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const { data: people } = ownerIds.length
    ? await supabase.from(T.profiles).select("id, name").in("id", ownerIds)
    : { data: [] as { id: string; name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name as string]));
  const error = pErr ?? dErr;

  return (
    <>
      <h2>
        承認対応
        {/* 承認者として閲覧できる報告書（承認待ち・処理済み）を、訪問先1件を1行にして書き出す */}
        <a href="/api/reports/export?scope=approver" className="btn" download>CSV出力</a>
      </h2>
      <div className="tabs">
        <Link href="/approvals" className={tab === "wait" ? "on" : ""}>
          承認待ち{waiting.length > 0 && <span className="badge">{waiting.length}</span>}
        </Link>
        <Link href="/approvals?tab=done" className={tab === "done" ? "on" : ""}>対応済み</Link>
      </div>
      {error && <div className="errbox">報告書を読み込めませんでした：{error.message}</div>}
      <table className="list">
        <thead>
          <tr>
            <th style={{ width: 160 }}>申請者</th><th style={{ width: 200 }}>出張期間</th><th>訪問先</th><th style={{ width: 90 }}>状況</th>
            <th style={{ width: 190 }}>{tab === "wait" ? "提出日時" : "自分の対応"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((r) => {
            const days = tab === "wait" && r.submitted_at ? daysSince(r.submitted_at) : 0;
            const stale = days >= STALE_DAYS;
            return (
              <RowLink key={r.id} href={`/reports/${r.id}`} className={stale ? "stale" : ""}>
                <td>{nameOf.get(r.owner_id) ?? "（不明）"}</td>
                <td>{periodText(r.start_date, r.end_date)}</td>
                <td>{[...r.visits].sort((a, b) => a.sort_order - b.sort_order).map((v, i) => <div key={i}>{v.customer_name}</div>)}</td>
                <td><StatusTag status={r.status} /></td>
                <td>
                  {r.mine
                    ? `${ACTION_LABEL[r.mine.action]}（${dateTimeText(r.mine.created_at)}）`
                    : <>
                        {r.submitted_at && dateTimeText(r.submitted_at)}
                        {stale && <><br /><span className="stale-tag">提出から{days}日経過</span></>}
                      </>}
                </td>
              </RowLink>
            );
          }) : (
            <tr><td colSpan={5} className="hint">{tab === "wait" ? "承認待ちの報告書はありません" : "対応済みの報告書はありません"}</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
