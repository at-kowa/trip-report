// 訪問内容（エディタの文書データ）の扱い
//   写真は image ノードの photoId（photos.id）と幅・高さで参照する
//   src（表示用の期限付き URL・端末内の一時 URL）は表示のときだけ付け、保存しない
import type { JSONContent } from "@tiptap/react";

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function walk(node: JSONContent, fn: (n: JSONContent) => JSONContent): JSONContent {
  const n = fn(node);
  return n.content ? { ...n, content: n.content.map((c) => walk(c, fn)) } : n;
}

// 保存用：写真の src を取り除く
export function stripPhotoSrc(doc: JSONContent): JSONContent {
  return walk(doc, (n) => {
    if (n.type !== "image" || !n.attrs) return n;
    const { src: _src, ...attrs } = n.attrs;
    return { ...n, attrs };
  });
}

// 表示用：写真 ID から表示用の URL を付ける
export function withPhotoSrc(doc: JSONContent, urlOf: (photoId: string) => string | undefined): JSONContent {
  return walk(doc, (n) => (n.type === "image" && n.attrs?.photoId ? { ...n, attrs: { ...n.attrs, src: urlOf(n.attrs.photoId) ?? null } } : n));
}

// 本文中の写真 ID の一覧
export function photoIdsOf(doc: JSONContent): string[] {
  const ids: string[] = [];
  walk(doc, (n) => {
    if (n.type === "image" && n.attrs?.photoId) ids.push(n.attrs.photoId);
    return n;
  });
  return ids;
}

// 訪問内容が空か（文字も写真もない）
export function isEmptyDoc(doc: JSONContent | null | undefined): boolean {
  if (!doc) return true;
  let empty = true;
  walk(doc, (n) => {
    if (n.type === "image" || (n.type === "text" && n.text?.trim())) empty = false;
    return n;
  });
  return empty;
}

// 訪問内容を文字だけにする（CSV出力用）。段落・改行は改行に、写真は［写真］に置き換え、装飾は外す
export function docToText(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  const out = (n: JSONContent): string => {
    switch (n.type) {
      case "text": return n.text ?? "";
      case "hardBreak": return "\n";
      case "image": return "［写真］";
      case "paragraph": return (n.content ?? []).map(out).join("");
      default: return (n.content ?? []).map(out).join(n.type === "doc" ? "\n" : "");
    }
  };
  return out(doc).replace(/\n+$/, "");
}

// 写真ファイルの拡張子（Storage の置き場所に使う）
export function photoExt(file: File): string {
  const fromName = file.name.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  return file.type.split("/")[1]?.replace("jpeg", "jpg") || "img";
}
