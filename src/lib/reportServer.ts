// 報告書の画面の組み立てで使う取得処理（サーバ側）
import "server-only";
import type { JSONContent } from "@tiptap/react";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_DOC, withPhotoSrc } from "@/lib/reportContent";
import { T, F, PHOTO_BUCKET } from "@/lib/db";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// 入力候補：自分が過去1年に入力した訪問先名・担当者名
export async function loadSuggestions(supabase: Supabase) {
  const { data } = await supabase.rpc(F.suggestVisitNames);
  const rows = (data ?? []) as { kind: string; value: string }[];
  return {
    customers: rows.filter((r) => r.kind === "customer").map((r) => r.value),
    contacts: rows.filter((r) => r.kind === "contact").map((r) => r.value),
  };
}

// 報告書の写真の表示用 URL（期限付き。1時間）
export async function loadPhotoUrls(supabase: Supabase, reportId: string): Promise<Map<string, string>> {
  const { data: photos } = await supabase.from(T.photos).select("id, storage_path").eq("report_id", reportId);
  if (!photos?.length) return new Map();
  const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(photos.map((p) => p.storage_path), 3600);
  const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  return new Map(photos.flatMap((p) => (urlByPath.has(p.storage_path) ? [[p.id, urlByPath.get(p.storage_path)!]] : [])));
}

export type VisitRow = {
  id: string;
  sort_order: number;
  visit_date: string | null;
  customer_name: string;
  contact_name: string;
  content: JSONContent;
};

// 訪問先（表示順、写真に表示用の URL を付けたもの）
export async function loadVisits(supabase: Supabase, reportId: string): Promise<VisitRow[]> {
  const [{ data }, urls] = await Promise.all([
    supabase.from(T.visits).select("id, sort_order, visit_date, customer_name, contact_name, content")
      .eq("report_id", reportId).order("sort_order"),
    loadPhotoUrls(supabase, reportId),
  ]);
  return ((data ?? []) as VisitRow[]).map((v) => ({
    ...v,
    content: v.content?.type === "doc" ? withPhotoSrc(v.content, (id) => urls.get(id)) : EMPTY_DOC,
  }));
}

// 最後の差戻しコメント
export async function loadLastReject(supabase: Supabase, reportId: string) {
  const { data } = await supabase.from(T.approvalHistory).select("actor_id, comment")
    .eq("report_id", reportId).eq("action", "reject").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const { data: p } = await supabase.from(T.profiles).select("name").eq("id", data.actor_id).maybeSingle();
  return { name: p?.name ?? "（不明）", comment: data.comment ?? "" };
}

// 入力画面の PDF確認で使う承認欄の並び
//   申請中は報告書に写した承認ルート、下書き・差戻しは今の承認ルート（提出のときに写される）
export async function loadPreviewSteps(supabase: Supabase, ownerId: string, reportId: string | null, status: string) {
  const { data } = status === "pending" && reportId
    ? await supabase.from(T.reportRouteSteps).select("step_no, approver_id").eq("report_id", reportId)
    : await supabase.from(T.approvalRoutes).select("step_no, approver_id").eq("applicant_id", ownerId);
  const rows = ((data ?? []) as { step_no: number; approver_id: string }[]).sort((a, b) => a.step_no - b.step_no);
  if (!rows.length) return [];
  const { data: people } = await supabase.from(T.profiles).select("id, name").in("id", rows.map((r) => r.approver_id));
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name as string]));
  return rows.map((r) => ({ step_no: r.step_no, name: nameOf.get(r.approver_id) ?? "（不明）" }));
}
