import { STATUS_LABEL, type ReportStatus } from "@/lib/report";

export default function StatusTag({ status }: { status: ReportStatus }) {
  return <span className={`st ${status}`}>{STATUS_LABEL[status]}</span>;
}
