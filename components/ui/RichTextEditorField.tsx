"use client";

import { useEffect, useId, useRef } from "react";
import { toEmbeddableUrl } from "@/lib/media";

type RichTextEditorFieldProps = {
  label: string;
  name: string;
  initialValue?: string;
  required?: boolean;
  helperText?: string;
};

export default function RichTextEditorField({
  label,
  name,
  initialValue = "",
  required,
  helperText,
}: RichTextEditorFieldProps) {
  const editorId = useId();
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialValue) {
      editorRef.current.innerHTML = initialValue;
    }

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = initialValue;
    }
  }, [initialValue]);

  function syncValue() {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = editorRef.current?.innerHTML ?? "";
    }
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  function applyBlock(tagName: "H1" | "H2" | "H3" | "H4" | "H5" | "H6" | "P") {
    runCommand("formatBlock", tagName);
  }

  function insertLink() {
    const url = window.prompt("Enter link URL");

    if (!url) {
      return;
    }

    runCommand("createLink", url);
  }

  function insertEmbed() {
    const url = window.prompt("Enter embed URL");

    if (!url) {
      return;
    }

    let embedUrl: string;

    try {
      embedUrl = toEmbeddableUrl(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Enter a valid embed URL.");
      return;
    }

    runCommand(
      "insertHTML",
      `<div><iframe src="${embedUrl}" title="Embedded content" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:16px;"></iframe></div><p></p>`,
    );
  }

  function insertTable() {
    runCommand(
      "insertHTML",
      `<table border="1" style="width:100%;border-collapse:collapse;"><thead><tr><th>Heading 1</th><th>Heading 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></tbody></table><p></p>`,
    );
  }

  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {helperText ? <p className="mt-1 text-sm text-slate-500">{helperText}</p> : null}

      <div className="mt-3 rounded-[24px] border border-[#e8ddff] bg-white">
        <div className="flex flex-wrap gap-2 border-b border-[#f1e8ff] p-3">
          <ToolbarButton label="P" onClick={() => applyBlock("P")} />
          <ToolbarButton label="H1" onClick={() => applyBlock("H1")} />
          <ToolbarButton label="H2" onClick={() => applyBlock("H2")} />
          <ToolbarButton label="H3" onClick={() => applyBlock("H3")} />
          <ToolbarButton label="H4" onClick={() => applyBlock("H4")} />
          <ToolbarButton label="H5" onClick={() => applyBlock("H5")} />
          <ToolbarButton label="H6" onClick={() => applyBlock("H6")} />
          <ToolbarButton label="Bold" onClick={() => runCommand("bold")} />
          <ToolbarButton label="Italic" onClick={() => runCommand("italic")} />
          <ToolbarButton label="Bullets" onClick={() => runCommand("insertUnorderedList")} />
          <ToolbarButton label="Numbers" onClick={() => runCommand("insertOrderedList")} />
          <ToolbarButton label="Link" onClick={insertLink} />
          <ToolbarButton label="Table" onClick={insertTable} />
          <ToolbarButton label="Embed" onClick={insertEmbed} />
        </div>

        <div
          id={editorId}
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncValue}
          className="rich-editor min-h-[280px] px-4 py-4 text-sm text-slate-900 outline-none"
        />
      </div>

      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={initialValue} required={required} />
    </label>
  );
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-3 py-2 text-xs font-semibold text-slate-700"
    >
      {label}
    </button>
  );
}
