"use client";

// 一覧の絞り込み（選ぶとすぐに表示が変わる。選んだ値は URL に残す）
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterField = {
  key: string;            // URL の項目名
  label: string;
  value: string;          // 今の値（"" は未指定）
  options: [string, string][];   // [値, 表示名]
};

export default function QueryFilters({ fields }: { fields: FilterField[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`${path}?${p.toString()}`);
  }

  return (
    <div className="row" style={{ marginBottom: 12 }}>
      {fields.map((f) => (
        <div className="field" key={f.key}><label>{f.label}</label>
          <select value={f.value} onChange={(e) => set(f.key, e.target.value)}>
            {f.options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
