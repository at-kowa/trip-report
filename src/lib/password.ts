// 管理者が設定するパスワードの確認（画面とサーバの両方で使う）
// 8～72文字（72文字は認証の上限）、半角の英数字と記号のみ（空白・全角は不可）
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function checkPassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `パスワードは${PASSWORD_MIN}文字以上にしてください`;
  if (pw.length > PASSWORD_MAX) return `パスワードは${PASSWORD_MAX}文字以内にしてください`;
  if (!/^[\x21-\x7e]+$/.test(pw)) return "パスワードは半角の英数字と記号で入力してください（空白・全角は使えません）";
  return null;
}
