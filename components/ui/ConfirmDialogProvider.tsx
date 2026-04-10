"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider.");
  }

  return context;
}

export default function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const value = useMemo<ConfirmDialogContextValue>(
    () => ({
      confirm(options) {
        return new Promise<boolean>((resolve) => {
          setDialog({
            open: true,
            title: options.title ?? "Confirm action",
            message: options.message,
            confirmLabel: options.confirmLabel ?? "Continue",
            cancelLabel: options.cancelLabel ?? "Cancel",
            tone: options.tone ?? "default",
          });
          setResolver(() => resolve);
        });
      },
    }),
    [],
  );

  function closeDialog(result: boolean) {
    resolver?.(result);
    setDialog(null);
    setResolver(null);
  }

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {dialog?.open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close confirmation dialog"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => closeDialog(false)}
          />
          <div className="relative w-full max-w-md rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#fff8fb_100%)] p-6 shadow-[0_30px_80px_rgba(33,8,66,0.28)]">
            <div className={`mb-4 inline-flex rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${dialog.tone === "danger" ? "bg-[#fff1f1] text-[#b42318]" : "bg-[#f4edff] text-[#6b00ff]"}`}>
              {dialog.tone === "danger" ? "Please confirm" : "Confirm action"}
            </div>
            <h2 className="text-2xl font-semibold text-slate-950">{dialog.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{dialog.message}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => closeDialog(true)}
                className={
                  dialog.tone === "danger"
                    ? "inline-flex rounded-2xl bg-[linear-gradient(135deg,#d92d20,#f97066)] px-5 py-3 text-sm font-semibold text-white"
                    : "inline-flex rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8e42ff)] px-5 py-3 text-sm font-semibold text-white"
                }
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}
