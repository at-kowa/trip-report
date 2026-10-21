// 出張報告書の編集
//   本人で、下書き・差戻し、または申請中で最初の承認者がまだ承認していないときだけ編集できる
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReportStatus } from "@/lib/report";
import { loadLastReject, loadPreviewSteps, loadSuggestions, loadVisits } from "@/lib/reportServer";
import ReportForm from "../../ReportForm";
import { T, F } from "@/lib/db";

export default async function EditReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireRole("applicant");
  const supabase = await createClient();

  const [{ data: report }, { data: canEdit }] = await Promise.all([
    supabase.from(T.reports).select("id, status, start_date, end_date, submitted_at").eq("id", id).maybeSingle(),
    supabase.rpc(F.canEditReport, { p_report_id: id }),
  ]);
  if (!report || !canEdit) {
    return (
      <>
        <h2>出張報告書 編集</h2>
        <div className="card">この報告書は編集できません。<Link href="/my">自分の報告書へ戻る</Link></div>
      </>
    );
  }

  const [visits, rejectComment, suggestions, previewSteps] = await Promise.all([
    loadVisits(supabase, id),
    report.status === "rejected" ? loadLastReject(supabase, id) : null,
    loadSuggestions(supabase),
    loadPreviewSteps(supabase, me.id, id, report.status),
  ]);

  return (
    <ReportForm
      report={{
        id,
        isNew: false,
        status: report.status as ReportStatus,
        start_date: report.start_date ?? "",
        end_date: report.end_date ?? "",
        submitted_at: report.submitted_at,
        visits: visits.map((v) => ({
          id: v.id, visit_date: v.visit_date ?? "", customer_name: v.customer_name, contact_name: v.contact_name, content: v.content,
        })),
      }}
      applicantName={me.name}
      rejectComment={rejectComment}
      suggestions={suggestions}
      previewSteps={previewSteps}
    />
  );
}
