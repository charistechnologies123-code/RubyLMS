"use client";

import type { ChangeEvent } from "react";
import { useId, useState } from "react";
import toast from "react-hot-toast";

type ImageUploadFieldProps = {
  label: string;
  name: string;
  defaultValue?: string | null;
  helperText?: string;
  emptyLabel?: string;
  maxFileSizeKb?: number;
  previewClassName?: string;
};

export default function ImageUploadField({
  label,
  name,
  defaultValue,
  helperText = "Upload PNG, JPG, WEBP, or GIF.",
  emptyLabel = "No image",
  maxFileSizeKb = 750,
  previewClassName = "h-20 w-20 rounded-[24px]",
}: ImageUploadFieldProps) {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue ?? "");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > maxFileSizeKb * 1024) {
      toast.error(`${label} must be ${maxFileSizeKb}KB or smaller.`);
      event.target.value = "";
      return;
    }

    const nextValue = await readFileAsDataUrl(file);
    setValue(nextValue);
    event.target.value = "";
  }

  return (
    <div className="block">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b00ff]"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="mt-2 rounded-[24px] border border-dashed border-[#d8c6ff] bg-[#faf7ff] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className={`flex items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#6b00ff,#ff1e1e)] text-sm font-semibold text-white shadow-lg ${previewClassName}`}>
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt={`${label} preview`} className="h-full w-full object-cover" />
            ) : (
              emptyLabel
            )}
          </div>
          <div className="flex-1">
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-[#6b00ff]"
            >
              Choose image
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={handleFileChange}
            />
            <p className="mt-2 text-sm text-slate-600">{helperText}</p>
          </div>
        </div>
      </div>

      <input type="hidden" name={name} value={value} />
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read file."));
    };

    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}
