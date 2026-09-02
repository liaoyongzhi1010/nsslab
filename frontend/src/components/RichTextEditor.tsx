import { useEffect, useRef, useState } from "react";
import { Bold, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2 } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function RichTextEditor({ value, onChange, onBlur, disabled = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
    setEmpty(!editor.textContent?.trim());
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setEmpty(!editor.textContent?.trim());
    onChange(editor.innerHTML);
  };

  const runCommand = (command: string, commandValue?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const addLink = () => {
    const url = window.prompt("请输入链接地址（http、https 或 mailto）：", "https://");
    if (url) runCommand("createLink", url);
  };

  const toolbarButton = (label: string, icon: React.ReactNode, command: string, commandValue?: string) => (
    <button type="button" title={label} aria-label={label} disabled={disabled} onMouseDown={(event) => { event.preventDefault(); runCommand(command, commandValue); }}>{icon}</button>
  );

  return <div className={`rich-text-editor ${disabled ? "disabled" : ""}`}>
    <div className="rich-text-toolbar" role="toolbar" aria-label="观察和感想格式工具栏">
      {toolbarButton("撤销", <Undo2 size={15} />, "undo")}
      {toolbarButton("重做", <Redo2 size={15} />, "redo")}
      <i />
      {toolbarButton("正文", <span>正文</span>, "formatBlock", "p")}
      {toolbarButton("三级标题", <Heading3 size={15} />, "formatBlock", "h3")}
      <i />
      {toolbarButton("加粗", <Bold size={15} />, "bold")}
      {toolbarButton("斜体", <Italic size={15} />, "italic")}
      {toolbarButton("下划线", <Underline size={15} />, "underline")}
      {toolbarButton("删除线", <Strikethrough size={15} />, "strikeThrough")}
      <i />
      {toolbarButton("无序列表", <List size={15} />, "insertUnorderedList")}
      {toolbarButton("有序列表", <ListOrdered size={15} />, "insertOrderedList")}
      {toolbarButton("引用", <Quote size={15} />, "formatBlock", "blockquote")}
      <button type="button" title="插入链接" aria-label="插入链接" disabled={disabled} onMouseDown={(event) => { event.preventDefault(); addLink(); }}><Link2 size={15} /></button>
      {toolbarButton("清除格式", <RemoveFormatting size={15} />, "removeFormat")}
    </div>
    <div
      ref={editorRef}
      className={`rich-text-surface ${empty ? "empty" : ""}`}
      contentEditable={!disabled}
      role="textbox"
      aria-label="观察和感想"
      aria-multiline="true"
      data-placeholder="例如：当 Top-K 从 5 提高到 20 时，引用覆盖率提升，但上下文噪声也明显增加……"
      suppressContentEditableWarning
      onInput={emitChange}
      onBlur={() => { emitChange(); onBlur?.(); }}
      onPaste={(event) => {
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
        emitChange();
      }}
    />
  </div>;
}
