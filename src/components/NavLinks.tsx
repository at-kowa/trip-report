"use client";

// メニュー（表示中の画面を強調する）
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; count?: number };

export default function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={path.startsWith(it.href) ? "on" : ""}>
          {it.label}
          {it.count ? <span className="badge">{it.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
