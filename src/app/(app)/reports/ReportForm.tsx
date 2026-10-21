"use client";

// 出張報告書の入力・編集（新規作成と編集で共通）
//   自動保存は行わない。「下書き保存」（申請中は「保存」）または「提出する」で保存する
//   写真は挿入した時点では端末内に持ち、保存のときに Storage へアップロードする
//   本文から消した写真・削除した訪問先の写真は、保存のときに Storage と photos から削除する
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { createClient } from "@/lib/supabase/client";
import type { ReportStatus } from "@/lib/report";
import { EMPTY_DOC, isEmptyDoc, photoExt, photoIdsOf, stripPhotoSrc } from "@/lib/reportContent";
import StatusTag from "@/components/StatusTag";
import PrintReport from "@/components/PrintReport";
import VisitEditor from "@/components/VisitEditor";
import { T, F, PHOTO_BUCKET } from "@/lib/db";

export type FormVisit = {
  id: string;
  visit_date: string;
  customer_name: string;
  contact_name: string;
  content: JSONContent;   // 写真には表示用の src を付けた状態
};

export type FormReport = {
  id: string;
  isNew: boolean;
  status: ReportStatus;
  start_date: string;
  end_date: string;
  submitted_at?: string | null;   // PDF確認の提出日・申請者の印（申請中のみ）
  visits: FormVisit[];
};

function newVisit(): FormVisit {
  return { id: crypto.randomUUID(), visit_date: "", customer_name: "", contact_name: "", content: EMPTY_DOC };
}

function validate(start: string, end: string, visits: FormVisit[]): string[] {
  const e: string[] = [];
  if (!start || !end) e.push("出張期間を入力してください");
  else if (start > end) e.push("出張期間の終了日が開始日より前になっています");
  if (!visits.length) e.push("訪問先を1件以上入力してください");
  visits.forEach((v, i) => {
    const n = `訪問先 ${i + 1}`;
    if (!v.visit_date) e.push(`${n}：訪問日を入力してください`);
    else if (start && end && (v.visit_date < start || v.visit_date > end)) e.push(`${n}：訪問日が出張期間の外です`);
    if (!v.customer_name.trim()) e.push(`${n}：訪問先名を入力してください`);
    if (isEmptyDoc(v.content)) e.push(`${n}：訪問内容を入力してください`);
  });
  return e;
}

export default function ReportForm({ report, applicantName, rejectComment, suggestions, previewSteps }: {
  report: FormReport;
  applicantName: string;
  rejectComment: { name: string; comment: string } | null;
  suggestions: { customers: string[]; contacts: string[] };
  previewSteps: { step_no: number; name: string }[];   // PDF確認の承認欄
}) {
  const router = useRouter();
  const [start, setStart] = useState(report.start_date);
  const [end, setEnd] = useState(report.end_date);
  const [visits, setVisits] = useState<FormVisit[]>(report.visits.length ? report.visits : [newVisit()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const created = useRef(!report.isNew);                      // 報告書の行を作成済みか
  const pendingPhotos = useRef(new Map<string, File>());      // まだアップロードしていない写真（photoId → ファイル）
  const pending = report.status === "pending";

  // 保存せずに画面を離れようとしたら確認する
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  function updateVisit(i: number, patch: Partial<FormVisit>) {
    setVisits((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
    setDirty(true);
  }

  function removeVisit(i: number) {
    if (!confirm(`訪問先 ${i + 1} を削除しますか？`)) return;
    setVisits((vs) => vs.filter((_, j) => j !== i));
    setDirty(true);
  }

  function addPhoto(file: File) {
    const photoId = crypto.randomUUID();
    pendingPhotos.current.set(photoId, file);
    return { photoId, src: URL.createObjectURL(file) };
  }

  function showErrors(e: string[]) {
    setErrors(e);
    scrollTo(0, 0);
  }

  // 報告書・訪問先・写真を保存する
  async function persist() {
    const supabase = createClient();
    const id = report.id;
    const period = { start_date: start || null, end_date: end || null };

    if (!created.current) {
      const { error } = await supabase.from(T.reports).insert({ id, ...period });
      if (error) throw new Error(`報告書を保存できませんでした：${error.message}`);
      created.current = true;
    } else {
      const { data, error } = await supabase.from(T.reports).update(period).eq("id", id).select("id");
      if (error) throw new Error(`報告書を保存できませんでした：${error.message}`);
      if (!data.length) throw new Error("この報告書は編集できなくなっています（承認が進んだ可能性があります）。画面を開き直してください");
    }

    const { error: vErr } = await supabase.from(T.visits).upsert(visits.map((v, i) => ({
      id: v.id,
      report_id: id,
      sort_order: i,
      visit_date: v.visit_date || null,
      customer_name: v.customer_name.trim(),
      contact_name: v.contact_name.trim(),
      content: stripPhotoSrc(v.content),
    })));
    if (vErr) throw new Error(`訪問先を保存できませんでした：${vErr.message}`);

    // 新しく挿入した写真をアップロードする（失敗した写真は端末内に残し、次の保存で再送する）
    for (const v of visits) {
      for (const photoId of photoIdsOf(v.content)) {
        const file = pendingPhotos.current.get(photoId);
        if (!file) continue;
        const path = `${id}/${photoId}.${photoExt(file)}`;
        // 前回の保存でアップロードだけ済んでいた場合は「既にある」と返るので、そのまま登録へ進む
        const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type });
        if (upErr && !/exists|Duplicate/i.test(upErr.message)) throw new Error(`写真をアップロードできませんでした：${upErr.message}`);
        const { error: pErr } = await supabase.from(T.photos).insert({
          id: photoId, report_id: id, visit_id: v.id, storage_path: path, content_type: file.type, size_bytes: file.size,
        });
        if (pErr) throw new Error(`写真を登録できませんでした：${pErr.message}`);
        pendingPhotos.current.delete(photoId);
      }
    }

    // 本文から消えた写真を削除する
    const used = new Set(visits.flatMap((v) => photoIdsOf(v.content)));
    const { data: photos, error: lErr } = await supabase.from(T.photos).select("id, storage_path").eq("report_id", id);
    if (lErr) throw new Error(`写真の一覧を取得できませんでした：${lErr.message}`);
    const unused = (photos ?? []).filter((p) => !used.has(p.id));
    if (unused.length) {
      await supabase.storage.from(PHOTO_BUCKET).remove(unused.map((p) => p.storage_path));
      await supabase.from(T.photos).delete().in("id", unused.map((p) => p.id));
    }

    // 削除した訪問先
    const { error: dErr } = await supabase.from(T.visits).delete()
      .eq("report_id", id).not("id", "in", `(${visits.map((v) => v.id).join(",")})`);
    if (dErr) throw new Error(`訪問先を削除できませんでした：${dErr.message}`);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      showErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    // 申請中の報告書は承認者が見るため、保存の時点で入力チェックを行う
    if (pending) {
      const e = validate(start, end, visits);
      if (e.length) return showErrors(e);
    }
    run(async () => {
      await persist();
      setDirty(false);
      router.push(`/reports/${report.id}`);
      router.refresh();
    });
  }

  function submit() {
    const e = validate(start, end, visits);
    if (e.length) return showErrors(e);
    run(async () => {
      await persist();
      setDirty(false);
      const { error } = await createClient().rpc(F.submitReport, { p_report_id: report.id });
      if (error) throw new Error(`下書きとして保存しましたが、提出できませんでした：${error.message}`);
      router.push("/my");
      router.refresh();
    });
  }

  function discard() {
    if (!confirm("この下書きを破棄しますか？破棄すると元に戻せません。")) return;
    run(async () => {
      const supabase = createClient();
      const { data: photos } = await supabase.from(T.photos).select("storage_path").eq("report_id", report.id);
      if (photos?.length) await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
      const { error } = await supabase.from(T.reports).delete().eq("id", report.id);
      if (error) throw new Error(`下書きを破棄できませんでした：${error.message}`);
      setDirty(false);
      router.push("/my");
      router.refresh();
    });
  }

  function cancel() {
    if (dirty && !confirm("入力した内容は保存されません。よろしいですか？")) return;
    setDirty(false);
    router.push(report.isNew ? "/my" : `/reports/${report.id}`);
  }

  // PDF確認：保存していない入力中の内容のまま、PDF出力と同じ様式で印刷する
  const fileDate = start.replaceAll("-", "");
  const firstCustomer = visits.find((v) => v.customer_name.trim())?.customer_name.trim() ?? "";

  return (
    <>
      {/* 印刷時の既定のファイル名（例：20261005_出張報告書_架空商事_確認用） */}
      <title>{[fileDate, "出張報告書", firstCustomer, "確認用"].filter(Boolean).join("_")}</title>
      <PrintReport
        status={report.status}
        ownerName={applicantName}
        startDate={start || null}
        endDate={end || null}
        submittedAt={pending ? report.submitted_at ?? null : null}
        steps={previewSteps.map((s) => ({ ...s, approvedAt: null }))}
        visits={visits.map((v, i) => ({
          id: v.id, sort_order: i, visit_date: v.visit_date || null,
          customer_name: v.customer_name.trim(), contact_name: v.contact_name.trim(), content: v.content,
        }))}
      />
      <div className="screen-only">
      <h2>出張報告書 {report.isNew ? "新規作成" : "編集"} <StatusTag status={report.status} owner /></h2>
      {report.status === "rejected" && rejectComment && (
        <div className="errbox"><b>差戻しコメント（{rejectComment.name}）</b><br /><span style={{ whiteSpace: "pre-wrap" }}>{rejectComment.comment}</span></div>
      )}
      {pending && (
        <div className="card hint">提出済みですが、最初の承認者が承認する前のため編集できます。保存すると提出済みのまま内容が更新されます。</div>
      )}
      {errors.length > 0 && (
        <div className="errbox"><b>入力内容を確認してください</b><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
      )}

      <div className="card">
        <div className="row">
          <div className="field"><label>申請者</label><div>{applicantName}</div></div>
          <div className="field"><label className="req">出張期間（開始日）</label>
            <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setDirty(true); }} /></div>
          <div className="field"><label className="req">出張期間（終了日）</label>
            <input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setDirty(true); }} /></div>
        </div>
      </div>

      <h3>訪問先情報</h3>
      {visits.map((v, i) => (
        <div className="visit" key={v.id}>
          <div className="visit-head">
            訪問先 {i + 1}
            {visits.length > 1 && <button type="button" className="btn small ng" onClick={() => removeVisit(i)}>この訪問先を削除</button>}
          </div>
          <div className="row">
            <div className="field"><label className="req">訪問日</label>
              <input type="date" value={v.visit_date} onChange={(e) => updateVisit(i, { visit_date: e.target.value })} /></div>
            <div className="field" style={{ flex: 2, minWidth: 240 }}><label className="req">訪問先名</label>
              <input type="text" list="dl-customer" value={v.customer_name} placeholder="例：架空商事株式会社 大阪支店"
                onChange={(e) => updateVisit(i, { customer_name: e.target.value })} /></div>
            <div className="field" style={{ flex: 1, minWidth: 200 }}><label>担当者名</label>
              <input type="text" list="dl-contact" value={v.contact_name} placeholder="試作では架空の名前のみ"
                onChange={(e) => updateVisit(i, { contact_name: e.target.value })} /></div>
          </div>
          <div className="field"><label className="req">訪問内容</label>
            <VisitEditor content={v.content} onChange={(doc) => updateVisit(i, { content: doc })} onAddPhoto={addPhoto} />
            <span className="hint">写真はファイルをここへドラッグ＆ドロップするか「写真を挿入」で追加します。「写真を挿入」では、最後にカーソルを置いた位置に写真が入ります。写真は文字と同じく行の中に並び、幅が収まれば横に並びます。ドラッグで位置を移動でき、クリックすると右下のつまみで大きさの変更、Delete キーで削除ができます。</span>
          </div>
        </div>
      ))}
      <datalist id="dl-customer">{suggestions.customers.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="dl-contact">{suggestions.contacts.map((x) => <option key={x} value={x} />)}</datalist>
      <button type="button" className="btn" onClick={() => { setVisits((vs) => [...vs, newVisit()]); setDirty(true); }}>＋ 訪問先を追加</button>

      <div className="actions">
        {report.status === "draft" && !report.isNew && (
          <button type="button" className="btn ng" disabled={busy} onClick={discard}>下書きを破棄</button>
        )}
        <button type="button" className="btn" disabled={busy} onClick={cancel}>キャンセル</button>
        <span className="spacer" />
        <button type="button" className="btn" disabled={busy} onClick={() => print()} title="入力中の内容をPDF出力と同じ様式で確認します（保存はしません）">PDFで確認</button>
        <button type="button" className="btn" disabled={busy} onClick={save}>{pending ? "保存" : "下書き保存"}</button>
        {!pending && <button type="button" className="btn primary" disabled={busy} onClick={submit}>提出する</button>}
      </div>
      {busy && <p className="hint">保存しています…</p>}
      </div>
    </>
  );
}
