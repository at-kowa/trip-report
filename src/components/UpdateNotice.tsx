"use client";

// 新しい版のお知らせ
//   5分おきと、タブに戻ったときに今公開されている版を確かめ、この画面の版と違えば上部にお知らせを出す
//   自動では読み込み直さない（自動保存がないため、入力中の内容を消さないように）
//   検知したあとは、リンクで別の画面へ移るときにページを丸ごと読み込み直し、最新の版に切り替える
//   （入力画面で保存していない場合は、ブラウザの「このサイトを離れますか？」の確認が出る）
import { useEffect, useState } from "react";
import { BUILT_COMMIT, isStale, markStale } from "@/lib/appUpdate";

const INTERVAL_MS = 5 * 60 * 1000;

export default function UpdateNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!BUILT_COMMIT) return;
    let checking = false;

    async function check() {
      if (checking || isStale()) return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (res.ok) {
          const { commit } = (await res.json()) as { commit: string };
          if (commit && commit !== BUILT_COMMIT) {
            markStale();
            setShow(true);
          }
        }
      } catch {
        // 通信できないときは何もしない（次の確認で再試行する）
      } finally {
        checking = false;
      }
    }

    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    // 新しい版を検知したあとは、同じサイト内のリンクをページの読み込み直しで開く
    const onClick = (e: MouseEvent) => {
      if (!isStale() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      location.href = url.href;
    };

    check();
    const timer = setInterval(check, INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("click", onClick, true);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!show) return null;
  return (
    <div className="update-notice no-print">
      新しい版のシステムが公開されました。入力中の内容を保存してから、再読み込みしてください。
      <button type="button" className="btn small primary" onClick={() => location.reload()}>再読み込み</button>
    </div>
  );
}
