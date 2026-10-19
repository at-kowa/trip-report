// CSV の読み取りと内容チェック（画面での事前確認と、サーバでの取り込み前の確認の両方で使う）
import type { Role } from "@/lib/auth";

// Excel で保存した CSV は Shift_JIS。UTF-8 として読めなければ Shift_JIS で読み直す
export function decodeCsv(buf: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("shift_jis").decode(buf);
  }
  return text.replace(/^﻿/, "");
}

// 1行目は見出しとして読み飛ばす。ダブルクォートで囲んだ値（中にカンマを含む値）にも対応する
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows.slice(1).map((r) => r.map((v) => v.trim()));
}

export const ROLE_FROM_LABEL: Record<string, Role> = {
  申請者: "applicant",
  承認者: "approver",
  管理者: "admin",
  システム管理者: "sysadmin",
};

export type UserRow = {
  line: number;          // CSV の行番号（見出しが1行目）
  name: string;
  email: string;
  plant: string;
  dept: string;
  roles: Role[];
  active: boolean;
  errors: string[];
  warnings: string[];
};

const MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// 利用者 CSV：氏名, メールアドレス, 工場, 部署, 役割（; 区切り）, 状態（有効／無効。空欄は有効）
export function checkUserRows(cells: string[][]): UserRow[] {
  const seen = new Map<string, number>();
  return cells.map((c, i) => {
    const [name = "", emailRaw = "", plant = "", dept = "", rolesRaw = "", state = ""] = c;
    const email = emailRaw.toLowerCase();
    const line = i + 2;
    const errors: string[] = [];
    if (!name) errors.push("氏名が空です");
    if (!plant || !dept) errors.push("工場・部署を入力してください");
    if (!MAIL_RE.test(email)) errors.push("メールアドレスの形式が正しくありません");
    else if (seen.has(email)) errors.push(`${seen.get(email)} 行目とメールアドレスが重複しています`);
    else seen.set(email, line);
    const labels = rolesRaw.split(/[;；]/).map((s) => s.trim()).filter(Boolean);
    const bad = labels.filter((l) => !ROLE_FROM_LABEL[l]);
    if (!labels.length || bad.length) errors.push(`役割が正しくありません：${bad.join("・") || "空欄"}`);
    if (state && state !== "有効" && state !== "無効") errors.push(`状態は「有効」か「無効」で入力してください：${state}`);
    return {
      line, name, email, plant, dept,
      roles: [...new Set(labels.map((l) => ROLE_FROM_LABEL[l]).filter(Boolean))],
      active: state !== "無効",
      errors,
      warnings: [],
    };
  });
}

export type RouteRow = {
  line: number;
  applicantEmail: string;
  stepNo: number;
  approverEmail: string;
  errors: string[];
  warnings: string[];
};

// 承認ルート CSV：申請者メール, 承認順（1から連番）, 承認者メール
// 利用者として登録済みか・無効でないかは、登録済みの利用者一覧（email → 有効かどうか）で確認する
export function checkRouteRows(cells: string[][], users: Map<string, boolean>): RouteRow[] {
  const rows: RouteRow[] = cells.map((c, i) => {
    const [a = "", n = "", b = ""] = c;
    const errors: string[] = [];
    const warnings: string[] = [];
    const applicantEmail = a.toLowerCase();
    const approverEmail = b.toLowerCase();
    if (!users.has(applicantEmail)) errors.push("申請者が利用者に登録されていません");
    if (!users.has(approverEmail)) errors.push("承認者が利用者に登録されていません");
    else if (!users.get(approverEmail)) errors.push("承認者が無効になっています");
    if (!/^\d+$/.test(n)) errors.push("承認順は数字で入力してください");
    if (applicantEmail && applicantEmail === approverEmail) warnings.push("申請者自身が承認者に含まれています");
    return { line: i + 2, applicantEmail, stepNo: Number(n), approverEmail, errors, warnings };
  });
  const byApplicant = new Map<string, RouteRow[]>();
  rows.forEach((r) => byApplicant.set(r.applicantEmail, [...(byApplicant.get(r.applicantEmail) ?? []), r]));
  byApplicant.forEach((rs) => {
    const nums = rs.map((r) => r.stepNo).sort((x, y) => x - y);
    if (nums.some((v, i) => v !== i + 1)) rs.forEach((r) => r.errors.push("承認順が1からの連番になっていません"));
  });
  return rows;
}
