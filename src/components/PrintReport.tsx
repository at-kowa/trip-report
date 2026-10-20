// PDF出力（印刷）用の体裁：社内の「出張報告書」の様式に合わせる（画面には表示しない）
//   承認欄は最終承認者を左に並べ、承認済みの欄に「承認」と日付を入れる。承認履歴（コメント等）は載せない
import { STATUS_LABEL, type ReportStatus } from "@/lib/report";
import type { VisitRow } from "@/lib/reportServer";
import VisitContent from "@/components/VisitContent";

type Props = {
  status: ReportStatus;
  ownerName: string;
  startDate: string | null;
  endDate: string | null;
  submittedAt: string | null;
  steps: { step_no: number; name: string; approvedAt: string | null }[];
  visits: VisitRow[];
};

// 和暦の日付（例：令和8年10月5日）
export function warekiText(value: string | null): string {
  if (!value) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+09:00`) : new Date(value);
  return d.toLocaleDateString("ja-JP-u-ca-japanese", { timeZone: "Asia/Tokyo", era: "long", year: "numeric", month: "long", day: "numeric" });
}

function shortDate(ts: string): string {
  return new Date(ts).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
}

export default function PrintReport({ status, ownerName, startDate, endDate, submittedAt, steps, visits }: Props) {
  const customers = [...new Set(visits.map((v) => v.customer_name).filter(Boolean))];
  const stamps = [...steps].sort((a, b) => b.step_no - a.step_no);

  return (
    <div className="print-only print-report">
      {status !== "approved" && <div className="pr-status">（{STATUS_LABEL[status]}・内容確認用）</div>}
      <h1 className="pr-title">出 張 報 告 書</h1>

      <div className="pr-head">
        <div className="pr-lead">下記のとおり報告致します。</div>
        {stamps.length > 0 && (
          <table className="pr-stamps">
            <tbody>
              <tr>{stamps.map((s) => <th key={s.step_no}>{s.name}</th>)}</tr>
              <tr>
                {stamps.map((s) => (
                  <td key={s.step_no}>{s.approvedAt && <span className="pr-seal">承認<br />{shortDate(s.approvedAt)}</span>}</td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="pr-sign">
        <span>提出日<u>{warekiText(submittedAt) || "　　　　　　　"}</u></span>
        <span>氏名<u>{ownerName}</u></span>
      </div>

      <table className="pr-basic">
        <tbody>
          <tr><th>出張先・会社名</th><td>{customers.join("、")}</td></tr>
          <tr><th>出張期間</th><td>{warekiText(startDate)}　〜　{warekiText(endDate)}</td></tr>
        </tbody>
      </table>

      <div className="pr-body">
        {visits.map((v, i) => (
          <section key={v.id} className="pr-visit">
            <div className="pr-visit-head">
              ・訪問先{i + 1}　{v.customer_name || "（訪問先名未入力）"}
              {v.contact_name && <>（{v.contact_name}）</>}
              <span className="pr-visit-date">訪問日　{warekiText(v.visit_date) || "未入力"}</span>
            </div>
            <VisitContent doc={v.content} />
          </section>
        ))}
        {!visits.length && <p>訪問先はまだ入力されていません。</p>}
      </div>
    </div>
  );
}
