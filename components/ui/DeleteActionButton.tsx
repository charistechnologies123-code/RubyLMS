"use client";

import { useRouter } from "next/router";
import { useState } from "react";
import toast from "react-hot-toast";

type DeleteActionButtonProps = {
  action: string;
  successMessage: string;
  confirmMessage: string;
  label?: string;
  disabled?: boolean;
};

export default function DeleteActionButton({
  action,
  successMessage,
  confirmMessage,
  label = "Delete user",
  disabled = false,
}: DeleteActionButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (disabled || deleting) {
      return;
    }

    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    const response = await fetch(action, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "Unable to delete.");
      setDeleting(false);
      return;
    }

    toast.success(successMessage);
    setDeleting(false);
    router.replace(router.asPath);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={disabled || deleting}
      className="inline-flex rounded-2xl border border-[#ffd7d7] bg-[#fff5f5] px-5 py-3 text-sm font-semibold text-[#c62828] transition hover:bg-[#ffecec] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {deleting ? "Deleting..." : label}
    </button>
  );
}
