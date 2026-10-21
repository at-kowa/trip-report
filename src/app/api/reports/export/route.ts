// 出張報告書の CSV出力（訪問先1件を1行にする）
//   全員が、自分が閲覧できる範囲を出力できる（報告者が自分でデータを活用する用途も想定）
//   ?scope=my       … 自分の報告書（下書きを含む）
//   ?scope=approver … 承認者として閲覧できる他の人の報告書（自分の承認順が来たもの・過去に承認または差戻ししたもの）
//   ?scope=all      … 全報告書（システム管理者）。status・plant で絞り込める（全報告書の画面の絞り込みと同じ）
//   ログイン中の利用者の権限で読み出すため、閲覧できない報告書は RLS で除かれる（画面で見られる範囲と同じ）
//   担当者名は個人情報にあたるため出力しない。Excel で開けるよう UTF-8（BOM 付き）で返す
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, type ReportStatus } from "@/lib/report";
import { docToText } from "@/lib/reportContent";
import { T } from "@/lib/db";
import type { JSONContent } from "@tiptap/react";

type Row = {
  id: string;
  owner_id: string;
  start_date: string | null;
  end_date: string | null;
  status: ReportStatus;
  submitted_at: string | null;
  plant: string | null;
  dept: string | null;
  visits: { sort_order: number; visit_date: string | null; customer_name: string; content: JSONContent | null }[];
  approval_history: { action: string; created_at: string }[];
};

const HEADER = ["報告書ID", "申請者", "工場（提出時）", "部署（提出時）", "出張開始日", "出張終了日", "状況", "提出日時", "最終承認日時",
  "訪問No", "訪問日", "訪問先名", "訪問内容", "写真の枚数"];

function dateTime(ts: string | null | undefined): string {
  return ts ? new Date(ts).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
}

// CSV の1項目：必ず " で囲む。Excel で式として動かないよう、= + - @ で始まる値の先頭に ' を付ける
function cell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, "\r\n")}"`;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  const { data: me } = await supabase.from(T.profiles).select("roles, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const scope = q.get("scope");
  const roles = me.roles as string[];
  if (!(scope === "my" || (scope === "approver" && roles.includes("approver")) || (scope === "all" && roles.includes("sysadmin")))) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let query = supabase.from(T.reports)
    .select(`id, owner_id, start_date, end_date, status, submitted_at, plant, dept,
             visits:${T.visits}(sort_order, visit_date, customer_name, content),
             approval_history:${T.approvalHistory}(action, created_at)`)
    .order("start_date", { ascending: false, nullsFirst: true });
  if (scope === "my") {
    query = query.eq("owner_id", user.id);
  } else if (scope === "approver") {
    query = query.neq("owner_id", user.id).neq("status", "draft");
  } else {
    query = query.neq("status", "draft");
    const status = q.get("status");
    const plant = q.get("plant");
    if (status && status in STATUS_LABEL) query = query.eq("status", status);
    if (plant) query = query.eq("plant", plant);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const reports = (data ?? []) as unknown as Row[];

  const ownerIds = [...new Set(reports.map((r) => r.owner_id))];
  const { data: people } = ownerIds.length
    ? await supabase.from(T.profiles).select("id, name").in("id", ownerIds)
    : { data: [] as { id: string; name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name as string]));

  const lines = [HEADER.map(cell).join(",")];
  for (const r of reports) {
    const approvedAt = r.status === "approved"
      ? r.approval_history.filter((h) => h.action === "approve").map((h) => h.created_at).sort().at(-1)
      : undefined;
    const base = [r.id, nameOf.get(r.owner_id) ?? "（不明）", r.plant ?? "", r.dept ?? "", r.start_date ?? "", r.end_date ?? "",
      STATUS_LABEL[r.status], dateTime(r.status === "draft" ? null : r.submitted_at), dateTime(approvedAt)];
    const visits = [...r.visits].sort((a, b) => a.sort_order - b.sort_order);
    if (!visits.length) lines.push([...base, "", "", "", "", ""].map(cell).join(","));
    visits.forEach((v, i) => {
      const text = docToText(v.content);
      lines.push([...base, i + 1, v.visit_date ?? "", v.customer_name, text, (text.match(/［写真］/g) ?? []).length].map(cell).join(","));
    });
  }

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).replaceAll("-", "");
  const label: Record<string, string> = { my: "自分", approver: "承認対象", all: "全件" };
  const fileName = `出張報告書_${label[scope]}_${today}.csv`;
  return new NextResponse("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
