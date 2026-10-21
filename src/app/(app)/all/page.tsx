// 全報告書（システム管理者のみ）
//   下書きを除くすべての報告書を閲覧できる（RLS で判定）。閲覧のみで、承認・差戻し・編集はできない
//   原則として全件を表示する（表示が遅くなる場合はページ送りにする）
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { periodText, STATUS_LABEL, type ReportStatus } from "@/lib/report";
import { T } from "@/lib/db";
import StatusTag from "@/components/StatusTag";
import RowLink from "@/components/RowLink";
import QueryFilters from "@/components/QueryFilters";

type Row = {
  id: string;
  owner_id: string;
  start_date: string | null;
  end_date: string | null;
  status: ReportStatus;
  plant: string | null;
  dept: string | null;
  visits: { customer_name: string; sort_order: number }[];
};

const STATUSES: ReportStatus[] = ["pending", "rejected", "approved"];

export default async function AllReports({ searchParams }: { searchParams: Promise<{ status?: string; plant?: string }> }) {
  const sp = await searchParams;
  await requireRole("sysadmin");
  const supabase = await createClient();

  const { data, error } = await supabase.from(T.reports)
    .select(`id, owner_id, start_date, end_date, status, plant, dept, visits:${T.visits}(customer_name, sort_order)`)
    .neq("status", "draft")
    .order("start_date", { ascending: false });
  const all = (data ?? []) as unknown as Row[];

  const plants = [...new Set(all.map((r) => r.plant).filter((p): p is string => !!p))].sort();
  const status = STATUSES.includes(sp.status as ReportStatus) ? sp.status! : "";
  const plant = plants.includes(sp.plant ?? "") ? sp.plant! : "";
  const list = all.filter((r) => (!status || r.status === status) && (!plant || r.plant === plant));

  const ownerIds = [...new Set(list.map((r) => r.owner_id))];
  const { data: people } = ownerIds.length
    ? await supabase.from(T.profiles).select("id, name").in("id", ownerIds)
    : { data: [] as { id: string; name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name as string]));

  return (
    <>
      <h2>
        全報告書 <span className="hint" style={{ fontWeight: "normal" }}>{list.length} 件</span>
        {/* 今の絞り込みのまま、訪問先1件を1行にして書き出す */}
        <a className="btn" download
          href={`/api/reports/export?${new URLSearchParams({ scope: "all", ...(status && { status }), ...(plant && { plant }) })}`}>CSV出力</a>
      </h2>
      <QueryFilters fields={[
        { key: "status", label: "状況", value: status, options: [["", "すべて"], ...STATUSES.map((s): [string, string] => [s, STATUS_LABEL[s]])] },
        { key: "plant", label: "工場（提出時）", value: plant, options: [["", "すべて"], ...plants.map((p): [string, string] => [p, p])] },
      ]} />
      {error && <div className="errbox">報告書を読み込めませんでした：{error.message}</div>}
      <table className="list">
        <thead>
          <tr><th style={{ width: 160 }}>申請者</th><th style={{ width: 200 }}>所属（提出時）</th><th style={{ width: 200 }}>出張期間</th><th>訪問先</th><th style={{ width: 90 }}>状況</th></tr>
        </thead>
        <tbody>
          {list.length ? list.map((r) => (
            <RowLink key={r.id} href={`/reports/${r.id}`}>
              <td>{nameOf.get(r.owner_id) ?? "（不明）"}</td>
              <td>{r.plant} {r.dept}</td>
              <td>{periodText(r.start_date, r.end_date)}</td>
              <td>{[...r.visits].sort((a, b) => a.sort_order - b.sort_order).map((v, i) => <div key={i}>{v.customer_name}</div>)}</td>
              <td><StatusTag status={r.status} /></td>
            </RowLink>
          )) : (
            <tr><td colSpan={5} className="hint">該当する報告書はありません</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
