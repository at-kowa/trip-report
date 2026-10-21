// 新しい版の公開を検知したかどうか（画面側で共有する）
//   検知したあとの画面移動は、ページを丸ごと読み込み直して最新の版に切り替える
let stale = false;

export function markStale() {
  stale = true;
}

export function isStale() {
  return stale;
}

// この画面を作った版（ビルド時に決まる）
export const BUILT_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "";
