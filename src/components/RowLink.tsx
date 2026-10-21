"use client";

// 一覧の行全体をクリックできるようにする
//   新しい版の公開を検知したあとは、ページを丸ごと読み込み直して開く（UpdateNotice 参照）
import { useRouter } from "next/navigation";
import { isStale } from "@/lib/appUpdate";

export default function RowLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr className={`click ${className}`} onClick={() => (isStale() ? (location.href = href) : router.push(href))}>
      {children}
    </tr>
  );
}
