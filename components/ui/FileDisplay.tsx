"use client";

import { getFileDisplayMeta } from "@/lib/media";

type FileDisplayProps = {
  url?: string | null;
  title?: string;
  className?: string;
};

export default function FileDisplay({ url, title, className = "" }: FileDisplayProps) {
  const file = getFileDisplayMeta(url);

  if (!file) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {file.isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.href}
          alt={title || file.label}
          className="max-h-80 w-full max-w-2xl rounded-[20px] border border-[#efe6ff] bg-white object-contain"
        />
      ) : null}
      {file.isPdf ? (
        <iframe
          src={file.href}
          title={title || file.label}
          className="h-[28rem] w-full max-w-3xl rounded-[20px] border border-[#efe6ff] bg-white"
        />
      ) : null}
      <a
        href={file.href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-2xl border border-[#e8ddff] bg-[#faf7ff] px-4 py-3 text-sm font-semibold text-[#6b00ff]"
      >
        {file.isPdf ? "Open PDF in new tab" : `Open ${file.label}`}
      </a>
      <p className="text-sm text-slate-600">{file.label}</p>
    </div>
  );
}
