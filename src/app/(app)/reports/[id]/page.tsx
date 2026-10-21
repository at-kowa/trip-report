// 出張報告書（詳細・承認）
//   閲覧できるのは本人／（下書き以外）システム管理者・現在の承認者・過去に承認または差戻しした人（RLS で判定）
//   PDF出力はブラウザの印刷機能で行う（A4縦。社内の出張報告書の様式で印刷する。承認履歴・操作ボタンは印刷しない）
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ACTION_LABEL, dateTimeText, periodText, type ReportStatus } from "@/lib/report";
import { loadVisits } from "@/lib/reportServer";
import StatusTag from "@/components/StatusTag";
import RouteView from "@/components/RouteView";
import VisitContent from "@/components/VisitContent";
import PrintReport from "@/components/PrintReport";
import PhotoZoom from "@/components/PhotoZoom";
import { DecisionPanel, ReportActions } from "./ReportActions";
import { T, F } from "@/lib/db";

type Report = {
  id: string;
  owner_id: string;
  start_date: string | null;
  end_date: string | null;
  status: ReportStatus;
  current_step: number | null;
  submitted_at: string | null;
  plant: string | null;
  dept: string | null;
  report_route_steps: { step_no: number; approver_id: string }[];
  approval_history: { id: number; actor_id: string; action: string; step_no: number | null; comment: string | null; created_at: string }[];
};

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from(T.reports)
    .select(`id, owner_id, start_date, end_date, status, current_step, submitted_at, plant, dept, report_route_steps:${T.reportRouteSteps}(step_no, approver_id), approval_history:${T.approvalHistory}(id, actor_id, action, step_no, comment, created_at)`)
    .eq("id", id)
    .maybeSingle();
  const r = data as Report | null;
  if (!r) {
    return (
      <>
        <h2>出張報告書</h2>
        <div className="card">この報告書は表示できません。<Link href="/">トップへ戻る</Link></div>
      </>
    );
  }

  const steps = [...r.report_route_steps].sort((a, b) => a.step_no - b.step_no);
  const history = [...r.approval_history].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  const ids = [...new Set([r.owner_id, ...steps.map((s) => s.approver_id), ...history.map((h) => h.actor_id)])];
  const [{ data: people }, visits, { data: canEdit }] = await Promise.all([
    supabase.from(T.profiles).select("id, name").in("id", ids),
    loadVisits(supabase, id),
    supabase.rpc(F.canEditReport, { p_report_id: id }),
  ]);
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name as string]));
  const name = (uid: string) => nameOf.get(uid) ?? "（不明）";

  const isOwner = r.owner_id === me.id;
  const myTurn = r.status === "pending" && steps.some((s) => s.step_no === r.current_step && s.approver_id === me.id);
  const next = myTurn ? steps.find((s) => s.step_no === (r.current_step ?? 0) + 1) : undefined;

  // 印刷の承認欄：最後の提出より後の承認を、承認順ごとに拾う（差戻し後の再提出では最初からやり直すため）
  const lastSubmit = history.findLastIndex((h) => h.action === "submit");
  const approvedAt = new Map(history.slice(lastSubmit + 1).filter((h) => h.action === "approve" && h.step_no != null).map((h) => [h.step_no!, h.created_at]));
  const fileDate = (r.start_date ?? "").replaceAll("-", "");
  const firstCustomer = visits.find((v) => v.customer_name)?.customer_name ?? "";

  return (
    <>
      {/* 印刷時の既定のファイル名（例：20261005_出張報告書_架空商事） */}
      <title>{[fileDate, "出張報告書", firstCustomer].filter(Boolean).join("_")}</title>
      <PrintReport
        status={r.status}
        ownerName={name(r.owner_id)}
        startDate={r.start_date}
        endDate={r.end_date}
        submittedAt={r.status === "draft" ? null : r.submitted_at}
        steps={steps.map((s) => ({ step_no: s.step_no, name: name(s.approver_id), approvedAt: approvedAt.get(s.step_no) ?? null }))}
        visits={visits}
      />
      <div className="screen-only">
      <h2>出張報告書 <StatusTag status={r.status} owner={r.owner_id === me.id} /></h2>
      <div className="card">
        <div className="row" style={{ gap: 32 }}>
          <div className="field"><label>申請者</label><div>{name(r.owner_id)}</div></div>
          {r.plant && <div className="field"><label>所属（提出時）</label><div>{r.plant} {r.dept}</div></div>}
          <div className="field"><label>出張期間</label><div>{periodText(r.start_date, r.end_date)}</div></div>
          <div className="field no-print"><label>承認ルート</label>
            <RouteView status={r.status} currentStep={r.current_step} steps={steps.map((s) => ({ step_no: s.step_no, name: name(s.approver_id) }))} />
          </div>
        </div>
      </div>

      <PhotoZoom>
      {visits.map((v, i) => (
        <div className="visit" key={v.id}>
          <div className="visit-head">訪問先 {i + 1}：{v.customer_name || "（訪問先名未入力）"}</div>
          <div className="hint">訪問日 {v.visit_date ?? "未入力"}{v.contact_name ? `　担当者 ${v.contact_name}` : ""}</div>
          <VisitContent doc={v.content} />
        </div>
      ))}
      </PhotoZoom>
      {!visits.length && <div className="card hint">訪問先はまだ入力されていません</div>}

      <h3 className="no-print">承認履歴</h3>
      <div className="card no-print">
        {history.length ? (
          <ul className="timeline">
            {history.map((h) => (
              <li key={h.id} className={h.action === "reject" ? "ng" : ""}>
                <b>{ACTION_LABEL[h.action] ?? h.action}</b>　{name(h.actor_id)} <span className="when">{dateTimeText(h.created_at)}</span>
                {h.comment && <div className="cmt">{h.comment}</div>}
              </li>
            ))}
          </ul>
        ) : <span className="hint">まだ提出されていません</span>}
      </div>

      </div>

      {myTurn && <DecisionPanel reportId={id} isLast={!next} nextName={next ? name(next.approver_id) : null} />}
      <ReportActions
        reportId={id}
        canWithdraw={isOwner && r.status === "pending" && r.current_step === 1}
        canEdit={!!canEdit}
      />
    </>
  );
}
