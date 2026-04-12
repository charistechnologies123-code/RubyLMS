"use client";

import { useRouter } from "next/router";
import { useState } from "react";
import toast from "react-hot-toast";

type MarkAnnouncementReadButtonProps = {
  announcementId: string;
};

export default function MarkAnnouncementReadButton({
  announcementId,
}: MarkAnnouncementReadButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleMarkRead() {
    if (loading) {
      return;
    }

    setLoading(true);

    const response = await fetch("/api/announcements/read", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ announcementId }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(result.error ?? "Unable to mark announcement as read.");
      setLoading(false);
      return;
    }

    toast.success("Announcement marked as read.");
    setLoading(false);
    router.replace(router.asPath);
  }

  return (
    <button
      type="button"
      onClick={() => void handleMarkRead()}
      disabled={loading}
      className="inline-flex rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-sm font-semibold text-[#6b00ff] transition hover:border-[#6b00ff] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Saving..." : "Mark as Read"}
    </button>
  );
}
