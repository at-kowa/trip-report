"use client";

// 一覧の行全体をクリックできるようにする
import { useRouter } from "next/navigation";

export default function RowLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <tr className={`click ${className}`} onClick={() => router.push(href)}>
      {children}
    </tr>
  );
}
