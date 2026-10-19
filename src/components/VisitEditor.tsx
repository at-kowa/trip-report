"use client";

// 訪問内容のエディタ
//   装飾：太字・斜体・下線・取り消し線・文字の大きさ・文字色・蛍光ペン・配置（箇条書き・番号付き・見出しは使わない）
//   写真：ボタン（最後にカーソルを置いた位置）またはドラッグ＆ドロップ（ドロップした位置）で挿入する
//         文字と同じく行の中に並び、ドラッグで移動、右下のつまみで大きさ変更、選択して Delete で削除できる
import { useRef } from "react";
import { useEditor, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";

const INITIAL_WIDTH = 300;

// 写真：photos.id を photoId として持つ（src は表示のときだけ付ける）
const Photo = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      photoId: { default: null, renderHTML: (a) => (a.photoId ? { "data-photo-id": a.photoId } : {}) },
    };
  },
}).configure({
  inline: true,
  resize: { enabled: true, directions: ["bottom-right"], minWidth: 60, alwaysPreserveAspectRatio: true },
});

const extensions = [
  StarterKit.configure({
    heading: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false,
    blockquote: false, code: false, codeBlock: false, horizontalRule: false, link: false,
  }),
  TextStyle, Color, FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["paragraph"] }),
  Photo,
];

const FONT_SIZES = [
  { label: "小", value: "12px" },
  { label: "標準", value: "" },
  { label: "大", value: "18px" },
  { label: "特大", value: "24px" },
];

function imageFiles(list: FileList | null | undefined): File[] {
  return [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
}

export default function VisitEditor({ content, onChange, onAddPhoto }: {
  content: JSONContent;
  onChange: (doc: JSONContent) => void;
  // 写真ファイルを預けて、photoId と表示用の URL を受け取る（アップロードは保存時に行う）
  onAddPhoto: (file: File) => { photoId: string; src: string };
}) {
  // 複数枚は選んだ順に横に並べて挿入する
  function insertPhotos(editor: Editor, files: File[], pos?: number) {
    if (!files.length) return;
    const nodes = files.map((f) => ({ type: "image", attrs: { ...onAddPhoto(f), width: INITIAL_WIDTH } }));
    const chain = editor.chain().focus();
    (pos == null ? chain.insertContent(nodes) : chain.insertContentAt(pos, nodes)).run();
  }

  // ドロップ・貼り付けの処理から使う（useEditor の設定より後に決まるため参照で持つ）
  const ref = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,   // ツールバーの太字などの状態を表示に反映する
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: { class: "editor" },
      // PC のファイルをドロップした場合は写真として追加する（本文中の写真を動かした場合は移動になる）
      handleDrop: (view, event, _slice, moved) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (moved || !files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (ref.current) insertPhotos(ref.current, files, pos);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length) return false;
        if (ref.current) insertPhotos(ref.current, files);
        return true;
      },
    },
  });

  ref.current = editor;
  if (!editor) return <div className="editor" />;

  const btn = (label: React.ReactNode, title: string, run: () => void, active = false) => (
    <button type="button" className={`btn small${active ? " on" : ""}`} title={title}
      onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</button>
  );
  const c = () => editor.chain().focus();

  return (
    <>
      <div className="toolbar">
        {btn(<b>B</b>, "太字", () => c().toggleBold().run(), editor.isActive("bold"))}
        {btn(<i>I</i>, "斜体", () => c().toggleItalic().run(), editor.isActive("italic"))}
        {btn(<u>U</u>, "下線", () => c().toggleUnderline().run(), editor.isActive("underline"))}
        {btn(<s>S</s>, "取り消し線", () => c().toggleStrike().run(), editor.isActive("strike"))}
        <select className="btn small" value="" title="文字の大きさ"
          onChange={(e) => {
            const v = FONT_SIZES[Number(e.target.value)].value;
            (v ? c().setFontSize(v) : c().unsetFontSize()).run();
          }}>
          <option value="" disabled>文字の大きさ</option>
          {FONT_SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
        </select>
        <label className="btn small" title="文字色">
          文字色<input type="color" defaultValue="#c62828" onChange={(e) => c().setColor(e.target.value).run()} />
        </label>
        <label className="btn small" title="蛍光ペン">
          蛍光ペン<input type="color" defaultValue="#fff176" onChange={(e) => c().setHighlight({ color: e.target.value }).run()} />
        </label>
        {btn("左", "左揃え", () => c().setTextAlign("left").run())}
        {btn("中央", "中央揃え", () => c().setTextAlign("center").run())}
        {btn("右", "右揃え", () => c().setTextAlign("right").run())}
        {btn("装飾を解除", "装飾を解除", () => c().unsetAllMarks().unsetTextAlign().run())}
        <label className="btn small">
          写真を挿入
          <input type="file" accept="image/*" multiple hidden
            onChange={(e) => { insertPhotos(editor, imageFiles(e.target.files)); e.target.value = ""; }} />
        </label>
      </div>
      <EditorContent editor={editor} />
    </>
  );
}
