"use client";

// CSV 取り込み：ファイルを読み込み → 内容を確認 → 取り込む
import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkUserRows, decodeCsv, parseCsv } from "@/lib/csv";

type Kind = "users" | "routes";
type Preview = { line: number; cols: string[]; errors: string[]; warnings: string[] };
type Created = { line: number; email: string; name: string; action: string; tempPassword?: string };

const HEADERS: Record<Kind, string[]> = {
  users: ["氏名", "メールアドレス", "工場", "部署", "役割", "状態"],
  routes: ["申請者メール", "承認順", "承認者メール"],
};
const HELP: Record<Kind, string> = {
  users: "列：氏名, メールアドレス, 工場, 部署, 役割（申請者／承認者／管理者／システム管理者。複数は ; 区切り）, 状態（有効／無効。空欄は有効）。1行目は見出しです。Excel で保存した CSV もそのまま読み込めます。CSV に載っていない利用者は変更されません。",
  routes: "列：申請者メール, 承認順（1から連番）, 承認者メール。1行目は見出しです。1人の申請者につき承認者の数だけ行を並べます。CSV に載っている申請者の承認ルートだけが置き換わります。",
};

export default function CsvImport({ kind }: { kind: Kind }) {
  const router = useRouter();
  const [cells, setCells] = useState<string[][] | null>(null);
  const [preview, setPreview] = useState<Preview[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [created, setCreated] = useState<Created[]>([]);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const c = parseCsv(decodeCsv(await f.arrayBuffer()));
    setCells(c);
    setMessage(null);
    setCreated([]);
    // 利用者 CSV は画面でも確認する。承認ルートは登録済みの利用者との突き合わせが必要なため、取り込み時にサーバで確認する
    setPreview(kind === "users"
      ? checkUserRows(c).map((r, i) => ({ line: r.line, cols: c[i], errors: r.errors, warnings: r.warnings }))
      : c.map((cols, i) => ({ line: i + 2, cols, errors: [], warnings: [] })));
  }

  async function importCsv() {
    if (!cells) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/${kind}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cells }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      if (body.rows) setPreview(body.rows.map((r: Preview & { line: number }, i: number) => ({ line: r.line, cols: cells[i], errors: r.errors, warnings: r.warnings })));
      if (body.results) setCreated(body.results);
      setMessage({ ok: false, text: body.error ?? "取り込めませんでした" });
      return;
    }
    if (kind === "users") {
      setCreated(body.results);
      const n = body.results.filter((r: Created) => r.tempPassword).length;
      setMessage({ ok: true, text: `${body.results.length} 件を取り込みました（新規 ${n} 件）。` });
    } else {
      setMessage({ ok: true, text: `${body.count} 行を取り込みました。` });
    }
    setCells(null);
    setPreview([]);
    router.refresh();
  }

  const hasError = preview.some((p) => p.errors.length);
  const newcomers = created.filter((c) => c.tempPassword);

  return (
    <>
      <h3>CSV 取り込み</h3>
      <div className="card">
        <p className="hint">{HELP[kind]}</p>
        <label className="btn">CSV ファイルを選択<input type="file" accept=".csv,text/csv" hidden onChange={onFile} /></label>

        {message && <div className={message.ok ? "infobox" : "errbox"} style={{ marginTop: 12 }}>{message.text}</div>}

        {newcomers.length > 0 && (
          <div className="infobox">
            <b>新しく作成した利用者の仮パスワード</b>（本人に伝えてください。この画面を離れると再表示できません）
            <table className="list" style={{ marginTop: 8 }}>
              <thead><tr><th>行</th><th>氏名</th><th>メールアドレス</th><th>仮パスワード</th></tr></thead>
              <tbody>
                {newcomers.map((c) => (
                  <tr key={c.email}><td>{c.line}</td><td>{c.name}</td><td>{c.email}</td><td style={{ fontFamily: "Consolas, monospace" }}>{c.tempPassword}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {preview.length > 0 && (
          <>
            <h3>確認結果</h3>
            <table className="list">
              <thead><tr><th>行</th>{HEADERS[kind].map((h) => <th key={h}>{h}</th>)}<th>判定</th></tr></thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.line}>
                    <td>{p.line}</td>
                    {HEADERS[kind].map((_, i) => <td key={i}>{p.cols[i] ?? ""}</td>)}
                    <td>
                      {p.errors.map((e) => <div key={e} className="err">✕ {e}</div>)}
                      {!p.errors.length && p.warnings.map((w) => <div key={w} className="warn">⚠ {w}</div>)}
                      {!p.errors.length && !p.warnings.length && <span className="ok">{kind === "users" ? "OK" : "取り込み時に確認"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="actions">
              <span className="spacer" />
              <button className="btn primary" onClick={importCsv} disabled={busy || hasError} title={hasError ? "エラーを修正してから取り込んでください" : ""}>
                {busy ? "取り込み中…" : "取り込む"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
