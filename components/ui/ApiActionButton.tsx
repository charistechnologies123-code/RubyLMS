"use client";

import { useRouter } from "next/router";
import { useState } from "react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";

type ApiActionButtonProps = {
  action: string;
  method?: "PATCH" | "DELETE";
  payload?: Record<string, unknown>;
  successMessage: string;
  label: string;
  pendingLabel?: string;
  confirmMessage?: string;
  disabled?: boolean;
  tone?: "default" | "danger" | "success";
  redirectTo?: string;
};

export default function ApiActionButton({
  action,
  method = "PATCH",
  payload,
  successMessage,
  label,
  pendingLabel,
  confirmMessage,
  disabled = false,
  tone = "default",
  redirectTo,
}: ApiActionButtonProps) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const [loading, setLoading] = useState(false);

  async function handleAction() {
    if (disabled || loading) {
      return;
    }

    if (confirmMessage) {
      const confirmed = await confirm({
        title: tone === "danger" ? "Confirm deletion" : "Confirm action",
        message: confirmMessage,
        confirmLabel: tone === "danger" ? "Yes, continue" : "Continue",
        tone: tone === "danger" ? "danger" : "default",
      });

      if (!confirmed) {
        return;
      }
    }

    setLoading(true);

    const response = await fetch(action, {
      method,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "Action failed.");
      setLoading(false);
      return;
    }

    toast.success(successMessage);
    setLoading(false);
    if (redirectTo) {
      await router.push(redirectTo);
      return;
    }

    router.replace(router.asPath);
  }

  return (
    <button
      type="button"
      onClick={handleAction}
      disabled={disabled || loading}
      className={getClassName(tone)}
    >
      {loading ? pendingLabel ?? "Saving..." : label}
    </button>
  );
}

function getClassName(tone: ApiActionButtonProps["tone"]) {
  if (tone === "danger") {
    return "inline-flex rounded-2xl border border-[#ffd7d7] bg-[#fff5f5] px-5 py-3 text-sm font-semibold text-[#c62828] transition hover:bg-[#ffecec] disabled:cursor-not-allowed disabled:opacity-60";
  }

  if (tone === "success") {
    return "inline-flex rounded-2xl border border-[#d7f3df] bg-[#f3fff6] px-5 py-3 text-sm font-semibold text-[#1e7a35] transition hover:bg-[#e9ffef] disabled:cursor-not-allowed disabled:opacity-60";
  }

  return "inline-flex rounded-2xl border border-[#e8ddff] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#6b00ff] hover:text-[#6b00ff] disabled:cursor-not-allowed disabled:opacity-60";
}
