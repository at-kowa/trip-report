// 報告書の状況など、画面で共通に使う定義
export type ReportStatus = "draft" | "pending" | "rejected" | "approved";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "下書き",
  pending: "申請中",
  rejected: "差戻し",
  approved: "承認済",
};

// 承認ルートの各承認者の状態：承認済み／承認待ち（今の順番）／未到達
export type StepState = "done" | "now" | "";

export function stepState(status: ReportStatus, currentStep: number | null, stepNo: number): StepState {
  if (status === "approved") return "done";
  if (status !== "pending" || currentStep == null) return "";
  if (stepNo < currentStep) return "done";
  return stepNo === currentStep ? "now" : "";
}

// 出張期間の表示（下書きでは未入力のことがある）
export function periodText(start: string | null, end: string | null): string {
  if (!start && !end) return "（期間未入力）";
  return `${start ?? "?"} 〜 ${end ?? "?"}`;
}

// 日時の表示（日本時間）
export function dateTimeText(ts: string): string {
  return new Date(ts).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// 承認履歴の操作の表示名
export const ACTION_LABEL: Record<string, string> = { submit: "提出", approve: "承認", reject: "差戻し", withdraw: "取り下げ" };
