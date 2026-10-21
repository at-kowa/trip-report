// 自分の出張報告書（一覧）
//   自分が作成した報告書だけを、出張開始日の新しい順に表示する（期間未入力の下書きは先頭）
//   承認済みの報告書も表示し続ける。原則として全件を表示する
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { periodText, type ReportStatus } from "@/lib/report";
import StatusTag from "@/components/StatusTag";
import RouteView from "@/components/RouteView";
import RowLink from "@/components/RowLink";
import { T } from "@/lib/db";

type Row = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: ReportStatus;
  current_step: number | null;
  visits: { customer_name: string; sort_order: number }[];
  report_route_steps: { step_no: number; approver_id: string }[];
};

export default async function MyReports() {
  const me = await requireRole("applicant");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from(T.reports)
    .select(`id, start_date, end_date, status, current_step, visits:${T.visits}(customer_name, sort_order), report_route_steps:${T.reportRouteSteps}(step_no, approver_id)`)
    .eq("owner_id", me.id)
    .order("start_date", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  const reports = (data ?? []) as Row[];

  // 承認者の氏名
  const ids = [...new Set(reports.flatMap((r) => r.report_route_steps.map((s) => s.approver_id)))];
  const { data: people } = ids.length
    ? await supabase.from(T.profiles).select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name]));

  const rejected = reports.filter((r) => r.status === "rejected").length;

  return (
    <>
      <h2>
        自分の出張報告書
        <Link href="/reports/new" className="btn primary">＋ 新規作成</Link>
        <a href="/api/reports/export?scope=my" className="btn" download>CSV出力</a>
      </h2>
      {error && <div className="errbox">報告書を読み込めませんでした：{error.message}</div>}
      {rejected > 0 && (
        <div className="errbox">差戻しされた報告書が {rejected} 件あります。内容を修正して再提出してください。</div>
      )}
      <table className="list">
        <thead>
          <tr><th style={{ width: 200 }}>出張期間</th><th>訪問先</th><th style={{ width: 90 }}>状況</th><th>承認ルート</th></tr>
        </thead>
        <tbody>
          {reports.length ? reports.map((r) => (
            <RowLink key={r.id} href={`/reports/${r.id}`}>
              <td>{periodText(r.start_date, r.end_date)}</td>
              <td>
                {[...r.visits].sort((a, b) => a.sort_order - b.sort_order).map((v, i) => (
                  <div key={i}>{v.customer_name || <span className="hint">（訪問先名未入力）</span>}</div>
                ))}
              </td>
              <td><StatusTag status={r.status} owner /></td>
              <td>
                <RouteView
                  status={r.status}
                  currentStep={r.current_step}
                  steps={[...r.report_route_steps].sort((a, b) => a.step_no - b.step_no)
                    .map((s) => ({ step_no: s.step_no, name: nameOf.get(s.approver_id) ?? "（不明）" }))}
                />
              </td>
            </RowLink>
          )) : (
            <tr><td colSpan={4} className="hint">出張報告書はまだありません</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
