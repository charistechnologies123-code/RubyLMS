"use client";

import { useEffect, useId, useRef, useState } from "react";
import toast from "react-hot-toast";
import ImageUploadField from "@/components/ui/ImageUploadField";
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
  const selectionRangeRef = useRef<Range | null>(null);
  const [inlineImageValue, setInlineImageValue] = useState("");

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
    restoreSelection();
    document.execCommand(command, false, commandValue);
    syncValue();
    captureSelection();
  }

  function captureSelection() {
    const selection = window.getSelection();

    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      selectionRangeRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    const selection = window.getSelection();

    if (!selection || !selectionRangeRef.current) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(selectionRangeRef.current);
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

  function setAlignment(alignment: "left" | "center" | "right" | "justify") {
    const command =
      alignment === "left"
        ? "justifyLeft"
        : alignment === "center"
          ? "justifyCenter"
          : alignment === "right"
            ? "justifyRight"
            : "justifyFull";

    runCommand(command);
  }

  function setFontSize(size: string) {
    runCommand("fontSize", size);
  }

  function setFontFamily(fontFamily: string) {
    runCommand("fontName", fontFamily);
  }

  function setLineHeight(lineHeight: string) {
    editorRef.current?.focus();
    restoreSelection();
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;

    if (!anchorNode || !editorRef.current) {
      return;
    }

    const element =
      anchorNode instanceof Element ? anchorNode : anchorNode.parentElement;
    const block = element?.closest("p,div,li,h1,h2,h3,h4,h5,h6,blockquote");

    if (block && editorRef.current.contains(block)) {
      (block as HTMLElement).style.lineHeight = lineHeight;
      syncValue();
      captureSelection();
    }
  }

  function transformCase(mode: "uppercase" | "lowercase" | "capitalize") {
    const selection = window.getSelection()?.toString();

    if (!selection) {
      return;
    }

    const nextValue =
      mode === "uppercase"
        ? selection.toUpperCase()
        : mode === "lowercase"
          ? selection.toLowerCase()
          : selection.replace(/\b\w/g, (character) => character.toUpperCase());

    runCommand("insertText", nextValue);
  }

  function insertUploadedImage(imageUrl: string | undefined) {
    if (!imageUrl) {
      return;
    }

    editorRef.current?.focus();
    restoreSelection();
    const selection = window.getSelection();

    if (!selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "Inserted content";
    image.style.maxWidth = "100%";
    image.style.borderRadius = "18px";
    figure.appendChild(image);

    const paragraph = document.createElement("p");
    paragraph.appendChild(document.createElement("br"));

    range.insertNode(paragraph);
    range.insertNode(figure);
    range.setStartAfter(paragraph);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    syncValue();
    captureSelection();
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
      toast.error(error instanceof Error ? error.message : "Enter a valid embed URL.");
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
          <select
            className="rounded-2xl border border-[#e8ddff] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            defaultValue="Montserrat"
            onChange={(event) => setFontFamily(event.target.value)}
          >
            <option value="Montserrat">Montserrat</option>
            <option value="Georgia">Georgia</option>
            <option value="Arial">Arial</option>
            <option value="Courier New">Courier New</option>
          </select>
          <select
            className="rounded-2xl border border-[#e8ddff] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            defaultValue="3"
            onChange={(event) => setFontSize(event.target.value)}
          >
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="4">Large</option>
            <option value="5">XL</option>
          </select>
          <ToolbarButton label="P" onClick={() => applyBlock("P")} />
          <ToolbarButton label="H1" onClick={() => applyBlock("H1")} />
          <ToolbarButton label="H2" onClick={() => applyBlock("H2")} />
          <ToolbarButton label="H3" onClick={() => applyBlock("H3")} />
          <ToolbarButton label="H4" onClick={() => applyBlock("H4")} />
          <ToolbarButton label="H5" onClick={() => applyBlock("H5")} />
          <ToolbarButton label="H6" onClick={() => applyBlock("H6")} />
          <ToolbarButton label="Bold" onClick={() => runCommand("bold")} />
          <ToolbarButton label="Italic" onClick={() => runCommand("italic")} />
          <ToolbarButton label="Underline" onClick={() => runCommand("underline")} />
          <ToolbarButton label="Bullets" onClick={() => runCommand("insertUnorderedList")} />
          <ToolbarButton label="Numbers" onClick={() => runCommand("insertOrderedList")} />
          <ToolbarButton label="Indent" onClick={() => runCommand("indent")} />
          <ToolbarButton label="Outdent" onClick={() => runCommand("outdent")} />
          <ToolbarButton label="Left" onClick={() => setAlignment("left")} />
          <ToolbarButton label="Center" onClick={() => setAlignment("center")} />
          <ToolbarButton label="Right" onClick={() => setAlignment("right")} />
          <ToolbarButton label="Justify" onClick={() => setAlignment("justify")} />
          <ToolbarButton label="UPPER" onClick={() => transformCase("uppercase")} />
          <ToolbarButton label="lower" onClick={() => transformCase("lowercase")} />
          <ToolbarButton label="Cap" onClick={() => transformCase("capitalize")} />
          <select
            className="rounded-2xl border border-[#e8ddff] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            defaultValue="1.6"
            onChange={(event) => setLineHeight(event.target.value)}
          >
            <option value="1.3">Tight</option>
            <option value="1.6">Normal</option>
            <option value="2">Relaxed</option>
          </select>
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
          onBlur={captureSelection}
          onKeyUp={captureSelection}
          onMouseUp={captureSelection}
          className="rich-editor min-h-[280px] px-4 py-4 text-sm text-slate-900 outline-none"
        />
      </div>

      <div className="mt-3">
        <ImageUploadField
          label="Insert image into page body"
          name={`${name}InlineImage`}
          helperText="Upload an image and then place your cursor in the editor to insert it."
          emptyLabel="No image"
          maxFileSizeKb={750}
          previewClassName="h-20 w-28 rounded-[18px]"
          onValueChange={setInlineImageValue}
        />
        <div className="mt-2">
          <ToolbarButton
            label="Insert uploaded image"
            onClick={() => {
              insertUploadedImage(inlineImageValue);
            }}
          />
        </div>
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
