import { OWNER_STATUS_LABEL, STATUS_LABEL, type ReportStatus } from "@/lib/report";

// owner：申請者本人が見る画面では「申請中」を「提出済」と表示する
export default function StatusTag({ status, owner = false }: { status: ReportStatus; owner?: boolean }) {
  return <span className={`st ${status}`}>{(owner ? OWNER_STATUS_LABEL : STATUS_LABEL)[status]}</span>;
}
