"use client";

// 写真の拡大表示：囲んだ範囲の訪問内容の写真をクリックすると、画面いっぱいに拡大して表示する
//   閉じるのは画面のどこかをクリック、または Esc キー
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function PhotoZoom({ children }: { children: ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (src) dialog.current?.showModal();
  }, [src]);

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLImageElement && t.closest(".content")) setSrc(t.src);
  }

  return (
    <div className="zoomable" onClick={onClick}>
      {children}
      {src && (
        <dialog ref={dialog} className="photo-zoom" onClose={() => setSrc(null)} onClick={() => dialog.current?.close()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" />
          <div className="photo-zoom-hint">クリックまたは Esc キーで閉じる</div>
        </dialog>
      )}
    </div>
  );
}
