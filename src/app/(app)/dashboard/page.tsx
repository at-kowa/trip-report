// 出張実績ダッシュボード
//   全利用者が閲覧できる。一般の利用者は自部署・自工場、管理者と工場に属さない人（工場欄が「本社」）は全体・工場ごと
//   集計は dashboard_stats 関数で行う（提出時の所属で集計。下書きは除く。報告書の本文は返さない）
//   訪問先数の多い順に順位を付け（同数は出張回数で比較）、自分の行を強調表示する
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { F, T } from "@/lib/db";
import QueryFilters from "@/components/QueryFilters";

type Stat = {
  rank: number;
  owner_id: string;
  name: string;
  affiliation: string;
  current_plant: string;
  current_dept: string;
  is_active: boolean;
  trips: number;
  visits: number;
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ scope?: string; year?: string; month?: string }> }) {
  const sp = await searchParams;
  const me = await requireProfile();
  const supabase = await createClient();

  // 表示範囲の選択肢
  const fullView = me.roles.includes("admin") || me.plant === "本社";
  let scopes: [string, string][];
  if (fullView) {
    const { data: people } = await supabase.from(T.profiles).select("plant, roles").eq("is_active", true);
    const plants = [...new Set((people ?? []).filter((p) => (p.roles as string[]).includes("applicant")).map((p) => p.plant as string))].sort();
    scopes = [["all", "全体"], ...plants.map((p): [string, string] => [`plant:${p}`, p])];
  } else {
    scopes = [["dept", `自部署（${me.plant} ${me.dept}）`], ["plant", `自工場（${me.plant}）`]];
  }
  const scope = scopes.some(([v]) => v === sp.scope) ? sp.scope! : scopes[0][0];

  const thisYear = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo", year: "numeric" }));
  const years = [thisYear - 1, thisYear];
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : thisYear;
  const month = Number(sp.month) >= 1 && Number(sp.month) <= 12 ? Number(sp.month) : null;

  const plantOfScope = scope.startsWith("plant:") ? scope.slice(6) : null;
  const { data, error } = await supabase.rpc(F.dashboardStats, {
    p_scope: plantOfScope ? "plant" : scope,
    p_year: year,
    p_month: month,
    p_plant: plantOfScope,
  });
  const rows = (data ?? []) as Stat[];

  // 今はこの範囲に所属していない人（異動した人）には、現在の所属を添える
  const scopePlant = plantOfScope ?? me.plant;
  const moved = (r: Stat) =>
    scope === "all" ? false
    : scope === "dept" ? r.current_plant !== me.plant || r.current_dept !== me.dept
    : r.current_plant !== scopePlant;

  const maxV = Math.max(1, ...rows.map((r) => r.visits));
  const totTrips = rows.reduce((n, r) => n + r.trips, 0);
  const totVisits = rows.reduce((n, r) => n + r.visits, 0);
  const avg = rows.length ? (totVisits / rows.length).toFixed(1) : "0";
  const mine = rows.find((r) => r.owner_id === me.id);

  return (
    <>
      <h2>出張実績ダッシュボード</h2>
      <QueryFilters fields={[
        { key: "scope", label: "表示範囲", value: scope, options: scopes },
        { key: "year", label: "年", value: String(year), options: years.map((y): [string, string] => [String(y), String(y)]) },
        { key: "month", label: "月", value: month ? String(month) : "",
          options: [["", "全月"], ...Array.from({ length: 12 }, (_, i): [string, string] => [String(i + 1), `${i + 1}月`])] },
      ]} />
      {error && <div className="errbox">集計できませんでした：{error.message}</div>}
      <div className="kpi">
        {mine && (
          <>
            <div className="mine">自分の順位<b>{mine.rank} 位 <span className="hint">／ {rows.length} 人中</span></b></div>
            <div className="mine">自分の訪問先数<b>{mine.visits} <span className="hint">（平均 {avg}）</span></b></div>
          </>
        )}
        <div>出張回数（合計）<b>{totTrips}</b></div>
        <div>訪問先数（合計）<b>{totVisits}</b></div>
      </div>
      <table className="list">
        <thead>
          <tr>
            <th style={{ width: 60 }}>順位</th><th>営業担当者</th><th>所属</th>
            <th style={{ width: 90 }}>出張回数</th><th style={{ width: 90 }}>訪問先数</th><th>訪問先数（グラフ）</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((r) => {
            const isMe = r.owner_id === me.id;
            return (
              <tr key={r.owner_id} className={isMe ? "me" : ""}>
                <td>{r.rank}</td>
                <td>
                  {r.name}
                  {isMe && <>　<span className="st pending">あなた</span></>}
                  {!r.is_active && <> <span className="st draft">無効</span></>}
                </td>
                <td>
                  {r.affiliation}
                  {moved(r) && r.is_active && <><br /><span className="hint">現所属：{r.current_plant} {r.current_dept}</span></>}
                </td>
                <td>{r.trips}</td>
                <td>{r.visits}</td>
                <td><div className="bar" style={{ width: `${(r.visits / maxV) * 100}%`, opacity: isMe ? 1 : 0.55 }} /></td>
              </tr>
            );
          }) : (
            <tr><td colSpan={6} className="hint">この範囲に営業担当者はいません</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
