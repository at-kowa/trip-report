// 訪問内容の表示（エディタの文書データをそのまま画面の要素に変換する。HTML として埋め込まない）
import type { CSSProperties, ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";

function marked(text: ReactNode, marks: JSONContent["marks"], key: number): ReactNode {
  let out = text;
  const style: CSSProperties = {};
  for (const m of marks ?? []) {
    switch (m.type) {
      case "bold": out = <b>{out}</b>; break;
      case "italic": out = <i>{out}</i>; break;
      case "underline": out = <u>{out}</u>; break;
      case "strike": out = <s>{out}</s>; break;
      case "highlight": out = <mark style={{ backgroundColor: m.attrs?.color ?? undefined }}>{out}</mark>; break;
      case "textStyle":
        if (m.attrs?.color) style.color = m.attrs.color;
        if (m.attrs?.fontSize) style.fontSize = m.attrs.fontSize;
        break;
    }
  }
  return Object.keys(style).length ? <span key={key} style={style}>{out}</span> : <span key={key}>{out}</span>;
}

function render(node: JSONContent, key: number): ReactNode {
  const children = node.content?.map(render);
  switch (node.type) {
    case "doc": return <>{children}</>;
    case "paragraph":
      return <p key={key} style={node.attrs?.textAlign ? { textAlign: node.attrs.textAlign } : undefined}>{children?.length ? children : <br />}</p>;
    case "text": return marked(node.text, node.marks, key);
    case "hardBreak": return <br key={key} />;
    case "image":
      return node.attrs?.src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img key={key} src={node.attrs.src} alt="" style={{ width: node.attrs.width ?? undefined }} />
        : <span key={key} className="hint">［写真を表示できません］</span>;
    default: return null;
  }
}

export default function VisitContent({ doc }: { doc: JSONContent }) {
  return <div className="content">{render(doc, 0)}</div>;
}
