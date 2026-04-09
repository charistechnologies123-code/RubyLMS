"use client";

import { useRouter } from "next/router";
import { useState } from "react";
import toast from "react-hot-toast";

export default function MarkAllReadButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(result.error ?? "Unable to update notifications.");
      setSubmitting(false);
      return;
    }

    toast.success("Notifications marked as read.");
    setSubmitting(false);
    router.replace(router.asPath);
  }

  return (
    <button
      onClick={handleClick}
      disabled={submitting}
      className="rounded-2xl border border-[#e9ddff] bg-white px-4 py-3 text-sm font-semibold text-[#6b00ff] disabled:opacity-60"
    >
      {submitting ? "Updating..." : "Mark all as read"}
    </button>
  );
}
